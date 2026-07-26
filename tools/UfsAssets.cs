using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace Ufs
{
    public class ObjInfo
    {
        public long PathId;
        public long ByteStart;
        public int ByteSize;
        public int ClassId;
    }

    public class TrInfo
    {
        public long Id, Go, Father;
        public float Px, Py, Pz, Rx, Ry, Rz, Rw, Sx, Sy, Sz;
        public bool Rect;
        public float Ax, Ay, Sw, Sh;
    }

    public class TexInfo
    {
        public long PathId;
        public string Name;
        public int Width, Height, Format, MipCount, DataSize;
        public long InlineOffset;
        public string StreamPath;
        public long StreamOffset;
        public int StreamSize;
    }

    public class Reader
    {
        byte[] b; int p;
        public Reader(byte[] data) { b = data; p = 0; }
        public int Pos { get { return p; } set { p = value; } }
        public int Len { get { return b.Length; } }
        public bool Can(int n) { return p + n <= b.Length; }
        public int I32() { int v = BitConverter.ToInt32(b, p); p += 4; return v; }
        public uint U32() { uint v = BitConverter.ToUInt32(b, p); p += 4; return v; }
        public long I64() { long v = BitConverter.ToInt64(b, p); p += 8; return v; }
        public float F32() { float v = BitConverter.ToSingle(b, p); p += 4; return v; }
        public byte U8() { return b[p++]; }
        public void Skip(int n) { p += n; }
        public void Align() { if (p % 4 != 0) p += 4 - (p % 4); }
        public string Str()
        {
            int n = I32();
            if (n < 0 || n > 4000 || p + n > b.Length) throw new Exception("bad string len " + n);
            string s = Encoding.UTF8.GetString(b, p, n);
            p += n; Align();
            return s;
        }
    }

    public class SerializedFile
    {
        public string Path;
        public FileStream Fs;
        public long DataOffset;
        public List<ObjInfo> Objects = new List<ObjInfo>();
        public Dictionary<long, ObjInfo> ById = new Dictionary<long, ObjInfo>();
        public List<string> Externals = new List<string>();
        public string UnityVersion;

        static uint BE(byte[] a, int o)
        {
            return ((uint)a[o] << 24) | ((uint)a[o + 1] << 16) | ((uint)a[o + 2] << 8) | a[o + 3];
        }

        public SerializedFile(string path)
        {
            Path = path;
            Fs = File.OpenRead(path);
            byte[] head = new byte[20];
            Fs.Read(head, 0, 20);
            uint metadataSize = BE(head, 0);
            uint fileSize = BE(head, 4);
            uint version = BE(head, 8);
            DataOffset = BE(head, 12);
            byte[] meta = new byte[metadataSize + 64];
            Fs.Position = 20;
            Fs.Read(meta, 0, meta.Length);
            Reader r = new Reader(meta);
            // unity version cstring
            StringBuilder sb = new StringBuilder();
            while (true) { byte c = r.U8(); if (c == 0) break; sb.Append((char)c); }
            UnityVersion = sb.ToString();
            r.I32();          // target platform
            r.U8();           // enableTypeTree (0)
            int typeCount = r.I32();
            int[] typeClass = new int[typeCount];
            for (int i = 0; i < typeCount; i++)
            {
                int cls = r.I32();
                r.U8();       // isStripped
                r.Skip(2);    // scriptTypeIndex
                if (cls == 114) r.Skip(16);
                r.Skip(16);
                typeClass[i] = cls;
            }
            int objectCount = r.I32();
            for (int i = 0; i < objectCount; i++)
            {
                r.Align();
                ObjInfo o = new ObjInfo();
                o.PathId = r.I64();
                o.ByteStart = r.I32();
                o.ByteSize = r.I32();
                o.ClassId = typeClass[r.I32()];
                Objects.Add(o);
                ById[o.PathId] = o;
            }
            int scriptCount = r.I32();
            for (int i = 0; i < scriptCount; i++) { r.I32(); r.Align(); r.I64(); }
            int extCount = r.I32();
            for (int i = 0; i < extCount; i++)
            {
                StringBuilder t = new StringBuilder();
                while (true) { byte c = r.U8(); if (c == 0) break; t.Append((char)c); }
                r.Skip(16);
                r.I32();
                StringBuilder pn = new StringBuilder();
                while (true) { byte c = r.U8(); if (c == 0) break; pn.Append((char)c); }
                Externals.Add(pn.ToString());
            }
        }

        public byte[] Read(ObjInfo o)
        {
            Fs.Position = DataOffset + o.ByteStart;
            byte[] d = new byte[o.ByteSize];
            int got = 0;
            while (got < d.Length) { int n = Fs.Read(d, got, d.Length - got); if (n <= 0) break; got += n; }
            return d;
        }

        public void Close() { Fs.Close(); }
    }

    public class Extractor
    {
        public static string Esc(string s)
        {
            StringBuilder sb = new StringBuilder();
            foreach (char c in s)
            {
                if (c == '"' || c == '\\') { sb.Append('\\').Append(c); }
                else if (c < 32) { sb.Append("\\u").Append(((int)c).ToString("x4")); }
                else sb.Append(c);
            }
            return sb.ToString();
        }

        static string F(float v)
        {
            if (float.IsNaN(v) || float.IsInfinity(v)) return "0";
            return v.ToString("0.###", CultureInfo.InvariantCulture);
        }

        public static string ClassHist(string file)
        {
            SerializedFile sf = new SerializedFile(file);
            var h = new Dictionary<int, int>();
            foreach (ObjInfo o in sf.Objects) { if (h.ContainsKey(o.ClassId)) h[o.ClassId]++; else h[o.ClassId] = 1; }
            StringBuilder sb = new StringBuilder();
            sb.Append("objects=").Append(sf.Objects.Count).Append(" | ");
            foreach (var kv in h) sb.Append(kv.Key).Append(":").Append(kv.Value).Append(" ");
            sf.Close();
            return sb.ToString();
        }

        /// Sucht in allen MonoBehaviours einer Datei nach PPtr-Verweisen (fileID, pathID)
        /// auf die angegebenen Ziel-pathIDs. Liefert Klasse und Größe des Verweisenden.
        public static string FindRefs(string file, int fileId, long[] targets)
        {
            SerializedFile sf = new SerializedFile(file);
            var set = new HashSet<long>(targets);
            var hits = new List<string>();
            foreach (ObjInfo o in sf.Objects)
            {
                if (o.ClassId != 114) continue;
                byte[] d = sf.Read(o);
                for (int p = 0; p + 12 <= d.Length; p += 4)
                {
                    if (BitConverter.ToInt32(d, p) != fileId) continue;
                    long pid = BitConverter.ToInt64(d, p + 4);
                    if (!set.Contains(pid)) continue;
                    hits.Add("obj=" + o.PathId + " size=" + o.ByteSize + " ref=" + pid + " at=" + p);
                    break;
                }
            }
            sf.Close();
            return "treffer=" + hits.Count + "\n" + string.Join("\n", hits.ToArray());
        }

        /// Listet MonoBehaviours mit eigenem Namen (ScriptableObjects, also
        /// Datenobjekte ohne GameObject) – dort liegen in Unity üblicherweise
        /// Ausrüstungs- und Item-Definitionen.
        public static string ListScriptables(string file, string nameRegex)
        {
            SerializedFile sf = new SerializedFile(file);
            Regex rx = new Regex(nameRegex, RegexOptions.IgnoreCase);
            StringBuilder j = new StringBuilder();
            j.Append('[');
            bool first = true;
            foreach (ObjInfo o in sf.Objects)
            {
                if (o.ClassId != 114) continue;
                try
                {
                    byte[] d = sf.Read(o);
                    Reader r = new Reader(d);
                    long go = 0;
                    r.I32(); go = r.I64();           // m_GameObject
                    if (go != 0) continue;           // an ein GameObject gehängt -> kein Datenobjekt
                    r.I32();                         // m_Enabled + align
                    r.I32(); r.I64();                // m_Script
                    string nm = r.Str();
                    if (nm.Length == 0 || !rx.IsMatch(nm)) continue;
                    if (!first) j.Append(',');
                    first = false;
                    j.Append("{\"id\":").Append(o.PathId).Append(",\"name\":\"").Append(Esc(nm))
                     .Append("\",\"size\":").Append(o.ByteSize).Append('}');
                }
                catch { }
            }
            j.Append(']');
            sf.Close();
            return j.ToString();
        }

        public static long[] IdsOfClass(string file, int cls, int max)
        {
            SerializedFile sf = new SerializedFile(file);
            var list = new List<long>();
            foreach (ObjInfo o in sf.Objects) { if (o.ClassId == cls) { list.Add(o.PathId); if (list.Count >= max) break; } }
            sf.Close();
            return list.ToArray();
        }

        // Raw hex of the first N bytes of a given object (for layout reverse engineering).
        public static string Hex(string file, long id, int n)
        {
            SerializedFile sf = new SerializedFile(file);
            ObjInfo o;
            if (!sf.ById.TryGetValue(id, out o)) { sf.Close(); return "not found"; }
            byte[] d = sf.Read(o);
            StringBuilder sb = new StringBuilder();
            sb.Append("cls=").Append(o.ClassId).Append(" size=").Append(o.ByteSize).Append(" ");
            int take = Math.Min(n, d.Length);
            for (int i = 0; i < take; i++) sb.Append(d[i].ToString("x2"));
            sf.Close();
            return sb.ToString();
        }

        // Resolve arbitrary pathIDs: report class, and for GameObject/Transform the name + world position.
        public static string Info(string file, long[] ids)
        {
            SerializedFile sf = new SerializedFile(file);
            var trById = new Dictionary<long, TrInfo>();
            var trByGo = new Dictionary<long, TrInfo>();
            var goName = new Dictionary<long, string>();

            foreach (ObjInfo o in sf.Objects)
            {
                if (o.ClassId == 1)
                {
                    try
                    {
                        Reader r = new Reader(sf.Read(o));
                        int n = r.I32();
                        if (n < 0 || n > 500) continue;
                        r.Skip(n * 12);
                        r.I32();
                        goName[o.PathId] = r.Str();
                    }
                    catch { }
                }
                else if (o.ClassId == 4 || o.ClassId == 224)
                {
                    try
                    {
                        Reader r = new Reader(sf.Read(o));
                        r.I32();
                        TrInfo t = new TrInfo();
                        t.Id = o.PathId; t.Go = r.I64();
                        t.Rx = r.F32(); t.Ry = r.F32(); t.Rz = r.F32(); t.Rw = r.F32();
                        t.Px = r.F32(); t.Py = r.F32(); t.Pz = r.F32();
                        t.Sx = r.F32(); t.Sy = r.F32(); t.Sz = r.F32();
                        int cc = r.I32();
                        if (cc < 0 || cc > 200000) continue;
                        r.Skip(cc * 12); r.I32(); t.Father = r.I64();
                        trById[t.Id] = t; trByGo[t.Go] = t;
                    }
                    catch { }
                }
            }

            StringBuilder j = new StringBuilder();
            j.Append('[');
            bool first = true;
            foreach (long id in ids)
            {
                ObjInfo o;
                if (!first) j.Append(',');
                first = false;
                if (!sf.ById.TryGetValue(id, out o)) { j.Append("{\"id\":").Append(id).Append(",\"cls\":-1}"); continue; }
                j.Append("{\"id\":").Append(id).Append(",\"cls\":").Append(o.ClassId).Append(",\"size\":").Append(o.ByteSize);
                long go = 0;
                if (o.ClassId == 1) go = id;
                else
                {
                    TrInfo t;
                    if (trById.TryGetValue(id, out t)) go = t.Go;
                    else
                    {
                        try { Reader r = new Reader(sf.Read(o)); r.I32(); go = r.I64(); } catch { }
                    }
                }
                string nm;
                if (goName.TryGetValue(go, out nm)) j.Append(",\"name\":\"").Append(Esc(nm)).Append('"');
                TrInfo tr;
                if (trByGo.TryGetValue(go, out tr))
                {
                    float x = tr.Px, y = tr.Py, z = tr.Pz;
                    TrInfo cur = tr; int guard = 0;
                    while (cur.Father != 0 && guard++ < 64)
                    {
                        TrInfo par;
                        if (!trById.TryGetValue(cur.Father, out par)) break;
                        x *= par.Sx; y *= par.Sy; z *= par.Sz;
                        float qx = par.Rx, qy = par.Ry, qz = par.Rz, qw = par.Rw;
                        float ix = qw * x + qy * z - qz * y;
                        float iy = qw * y + qz * x - qx * z;
                        float iz = qw * z + qx * y - qy * x;
                        float iw = -qx * x - qy * y - qz * z;
                        x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
                        y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
                        z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
                        x += par.Px; y += par.Py; z += par.Pz;
                        cur = par;
                    }
                    j.Append(",\"x\":").Append(F(x)).Append(",\"y\":").Append(F(y)).Append(",\"z\":").Append(F(z));
                }
                j.Append('}');
            }
            j.Append(']');
            sf.Close();
            return j.ToString();
        }

        public static string Run(string file, string nameRegex, bool dumpTextures, int hexBytes)
        {
            SerializedFile sf = new SerializedFile(file);
            Regex rx = new Regex(nameRegex);

            var goName = new Dictionary<long, string>();
            var goComps = new Dictionary<long, long[]>();
            var trById = new Dictionary<long, TrInfo>();
            var trByGo = new Dictionary<long, TrInfo>();
            var textures = new List<TexInfo>();

            foreach (ObjInfo o in sf.Objects)
            {
                if (o.ClassId == 1)
                {
                    byte[] d = sf.Read(o);
                    try
                    {
                        Reader r = new Reader(d);
                        int n = r.I32();
                        if (n < 0 || n > 500) continue;
                        long[] comps = new long[n];
                        for (int i = 0; i < n; i++) { r.I32(); comps[i] = r.I64(); }
                        r.I32(); // layer
                        string nm = r.Str();
                        if (rx.IsMatch(nm)) { goName[o.PathId] = nm; goComps[o.PathId] = comps; }
                    }
                    catch { }
                }
                else if (o.ClassId == 4 || o.ClassId == 224)
                {
                    byte[] d = sf.Read(o);
                    try
                    {
                        Reader r = new Reader(d);
                        r.I32();
                        TrInfo t = new TrInfo();
                        t.Id = o.PathId;
                        t.Go = r.I64();
                        t.Rx = r.F32(); t.Ry = r.F32(); t.Rz = r.F32(); t.Rw = r.F32();
                        t.Px = r.F32(); t.Py = r.F32(); t.Pz = r.F32();
                        t.Sx = r.F32(); t.Sy = r.F32(); t.Sz = r.F32();
                        int cc = r.I32();
                        if (cc < 0 || cc > 200000) continue;
                        r.Skip(cc * 12);
                        r.I32(); t.Father = r.I64();
                        t.Rect = (o.ClassId == 224);
                        if (t.Rect && r.Can(40))
                        {
                            r.Skip(16);
                            t.Ax = r.F32(); t.Ay = r.F32();
                            t.Sw = r.F32(); t.Sh = r.F32();
                        }
                        trById[t.Id] = t;
                        trByGo[t.Go] = t;
                    }
                    catch { }
                }
                else if (dumpTextures && o.ClassId == 28)
                {
                    byte[] d = sf.Read(o);
                    try
                    {
                        Reader r = new Reader(d);
                        TexInfo t = new TexInfo();
                        t.PathId = o.PathId;
                        t.Name = r.Str();
                        // Unity 2017.4 late patches: m_ForcedFallbackFormat (int) + m_DownscaleFallback (bool, aligned)
                        int probe = r.Pos;
                        int w0 = r.I32(), h0 = r.I32();
                        if (w0 >= 8 && w0 <= 16384 && h0 >= 8 && h0 <= 16384) { r.Pos = probe; }
                        else { r.Pos = probe + 8; }
                        t.Width = r.I32(); t.Height = r.I32();
                        int complete = r.I32();
                        t.Format = r.I32();
                        t.MipCount = r.I32();
                        r.U8(); r.U8(); r.Align();      // isReadable, readAllowed
                        r.I32();                        // imageCount
                        r.I32();                        // textureDimension
                        r.Skip(24);                     // texture settings
                        r.I32();                        // lightmapFormat
                        r.I32();                        // colorSpace
                        t.DataSize = r.I32();
                        t.InlineOffset = sf.DataOffset + o.ByteStart + r.Pos;
                        r.Skip(t.DataSize); r.Align();
                        if (r.Can(8))
                        {
                            t.StreamOffset = r.U32();
                            t.StreamSize = (int)r.U32();
                            try { t.StreamPath = r.Str(); } catch { t.StreamPath = ""; }
                        }
                        else { t.StreamPath = ""; }
                        if (t.Width > 0 && t.Width <= 16384 && t.Height > 0 && t.Height <= 16384)
                            textures.Add(t);
                    }
                    catch { }
                }
            }

            StringBuilder j = new StringBuilder();
            j.Append("{\"file\":\"").Append(Esc(System.IO.Path.GetFileName(file))).Append("\",\"unity\":\"").Append(sf.UnityVersion).Append("\"");
            j.Append(",\"externals\":[");
            for (int i = 0; i < sf.Externals.Count; i++) { if (i > 0) j.Append(','); j.Append('"').Append(Esc(sf.Externals[i])).Append('"'); }
            j.Append("]");

            j.Append(",\"objects\":[");
            bool first = true;
            foreach (var kv in goName)
            {
                long go = kv.Key;
                TrInfo t;
                float wx = 0, wy = 0, wz = 0, ax = 0, ay = 0, sw = 0, sh = 0;
                bool isRect = false;
                if (trByGo.TryGetValue(go, out t))
                {
                    float x = t.Px, y = t.Py, z = t.Pz;
                    TrInfo cur = t; int guard = 0;
                    while (cur.Father != 0 && guard++ < 64)
                    {
                        TrInfo par;
                        if (!trById.TryGetValue(cur.Father, out par)) break;
                        x *= par.Sx; y *= par.Sy; z *= par.Sz;
                        float qx = par.Rx, qy = par.Ry, qz = par.Rz, qw = par.Rw;
                        float ix = qw * x + qy * z - qz * y;
                        float iy = qw * y + qz * x - qx * z;
                        float iz = qw * z + qx * y - qy * x;
                        float iw = -qx * x - qy * y - qz * z;
                        x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
                        y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
                        z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
                        x += par.Px; y += par.Py; z += par.Pz;
                        cur = par;
                    }
                    wx = x; wy = y; wz = z;
                    ax = t.Ax; ay = t.Ay; sw = t.Sw; sh = t.Sh; isRect = t.Rect;
                }
                if (!first) j.Append(',');
                first = false;
                j.Append("{\"name\":\"").Append(Esc(kv.Value)).Append("\",\"id\":").Append(go);
                j.Append(",\"x\":").Append(F(wx)).Append(",\"y\":").Append(F(wy)).Append(",\"z\":").Append(F(wz));
                if (t != null)
                {
                    j.Append(",\"lsx\":").Append(F(t.Sx)).Append(",\"lsy\":").Append(F(t.Sy));
                    j.Append(",\"father\":").Append(t.Father);
                }
                if (isRect)
                {
                    j.Append(",\"rect\":1,\"ax\":").Append(F(ax)).Append(",\"ay\":").Append(F(ay));
                    j.Append(",\"sw\":").Append(F(sw)).Append(",\"sh\":").Append(F(sh));
                }
                j.Append(",\"comps\":[");
                long[] cs = goComps[go];
                bool f2 = true;
                foreach (long cid in cs)
                {
                    ObjInfo co;
                    if (!sf.ById.TryGetValue(cid, out co)) continue;
                    if (!f2) j.Append(',');
                    f2 = false;
                    j.Append("{\"cls\":").Append(co.ClassId).Append(",\"id\":").Append(cid).Append(",\"size\":").Append(co.ByteSize);
                    if (hexBytes > 0 && co.ClassId == 114)
                    {
                        byte[] cb = sf.Read(co);
                        int take = Math.Min(hexBytes, cb.Length);
                        StringBuilder hx = new StringBuilder();
                        for (int k = 0; k < take; k++) hx.Append(cb[k].ToString("x2"));
                        j.Append(",\"hex\":\"").Append(hx).Append('"');
                    }
                    j.Append('}');
                }
                j.Append("]}");
            }
            j.Append("]");

            if (dumpTextures)
            {
                j.Append(",\"textures\":[");
                for (int i = 0; i < textures.Count; i++)
                {
                    TexInfo t = textures[i];
                    if (i > 0) j.Append(',');
                    j.Append("{\"id\":").Append(t.PathId).Append(",\"name\":\"").Append(Esc(t.Name)).Append('"');
                    j.Append(",\"w\":").Append(t.Width).Append(",\"h\":").Append(t.Height);
                    j.Append(",\"fmt\":").Append(t.Format).Append(",\"mips\":").Append(t.MipCount);
                    j.Append(",\"size\":").Append(t.DataSize).Append(",\"off\":").Append(t.InlineOffset);
                    j.Append(",\"sp\":\"").Append(Esc(t.StreamPath == null ? "" : t.StreamPath)).Append('"');
                    j.Append(",\"so\":").Append(t.StreamOffset).Append(",\"ss\":").Append(t.StreamSize).Append('}');
                }
                j.Append("]");
            }
            j.Append("}");
            sf.Close();
            return j.ToString();
        }
    }
}
