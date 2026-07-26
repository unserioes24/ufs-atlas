using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace Ufs
{
    public class Fishery
    {
        static string F(float v)
        {
            if (float.IsNaN(v) || float.IsInfinity(v)) return "0";
            return v.ToString("0.###", CultureInfo.InvariantCulture);
        }

        class Tr
        {
            public long Id, Go, Father;
            public float Px, Py, Pz, Rx, Ry, Rz, Rw, Sx, Sy, Sz;
            public bool Rect;
            public float Ax, Ay, Sw, Sh;
            public long[] Children;
        }

        public static string Run(string file)
        {
            SerializedFile sf = new SerializedFile(file);
            var goName = new Dictionary<long, string>();
            var goComps = new Dictionary<long, long[]>();
            var trById = new Dictionary<long, Tr>();
            var trByGo = new Dictionary<long, Tr>();

            foreach (ObjInfo o in sf.Objects)
            {
                if (o.ClassId == 1)
                {
                    try
                    {
                        Reader r = new Reader(sf.Read(o));
                        int n = r.I32();
                        if (n < 0 || n > 500) continue;
                        long[] comps = new long[n];
                        for (int i = 0; i < n; i++) { r.I32(); comps[i] = r.I64(); }
                        r.I32();
                        string nm = r.Str();
                        goName[o.PathId] = nm;
                        goComps[o.PathId] = comps;
                    }
                    catch { }
                }
                else if (o.ClassId == 4 || o.ClassId == 224)
                {
                    try
                    {
                        Reader r = new Reader(sf.Read(o));
                        r.I32();
                        Tr t = new Tr();
                        t.Id = o.PathId; t.Go = r.I64();
                        t.Rx = r.F32(); t.Ry = r.F32(); t.Rz = r.F32(); t.Rw = r.F32();
                        t.Px = r.F32(); t.Py = r.F32(); t.Pz = r.F32();
                        t.Sx = r.F32(); t.Sy = r.F32(); t.Sz = r.F32();
                        int cc = r.I32();
                        if (cc < 0 || cc > 200000) continue;
                        t.Children = new long[cc];
                        for (int i = 0; i < cc; i++) { r.I32(); t.Children[i] = r.I64(); }
                        r.I32(); t.Father = r.I64();
                        t.Rect = (o.ClassId == 224);
                        if (t.Rect && r.Can(40))
                        {
                            r.Skip(16);
                            t.Ax = r.F32(); t.Ay = r.F32(); t.Sw = r.F32(); t.Sh = r.F32();
                        }
                        trById[t.Id] = t; trByGo[t.Go] = t;
                    }
                    catch { }
                }
            }

            Func<Tr, float[]> world = delegate (Tr t)
            {
                float x = t.Px, y = t.Py, z = t.Pz;
                Tr cur = t; int guard = 0;
                while (cur.Father != 0 && guard++ < 64)
                {
                    Tr par;
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
                return new float[] { x, y, z };
            };

            // --- collect groups ---
            var buttons = new List<long>();      // gameObject ids
            var spawners = new List<long>();
            var quickJumps = new Dictionary<long, long>();  // transform id -> go id
            long mapImageGo = 0;
            Regex rxSpawner = new Regex("^FishSpawner_");
            foreach (var kv in goName)
            {
                string n = kv.Value;
                if (n.StartsWith("MapButton")) buttons.Add(kv.Key);
                else if (rxSpawner.IsMatch(n)) spawners.Add(kv.Key);
                else if (n.StartsWith("QuickJump") && n != "QuickJumps")
                {
                    Tr t;
                    if (trByGo.TryGetValue(kv.Key, out t)) quickJumps[t.Id] = kv.Key;
                }
                else if (n == "MapImage" && mapImageGo == 0) mapImageGo = kv.Key;
            }

            // --- Karten-Tafeln ---
            // Jede Szene hat getrennte Tafeln für Sommer (MapParentNormal) und Eisfischen
            // (MapParentIce). Buttons hängen direkt an der Tafel, das MapImage liegt eine
            // Ebene tiefer unter MapBackground.
            var panelOfButton = new Dictionary<long, long>();   // buttonGo -> Tafel-Transform
            foreach (long bgo in buttons)
            {
                Tr t;
                if (trByGo.TryGetValue(bgo, out t)) panelOfButton[bgo] = t.Father;
            }
            var imageOfPanel = new Dictionary<long, long>();    // Tafel-Transform -> MapImage-GameObject
            foreach (var kv in goName)
            {
                if (kv.Value != "MapImage") continue;
                Tr t;
                if (!trByGo.TryGetValue(kv.Key, out t)) continue;
                Tr bg;
                if (!trById.TryGetValue(t.Father, out bg)) continue;
                if (!imageOfPanel.ContainsKey(bg.Father)) imageOfPanel[bg.Father] = kv.Key;
            }
            var panelName = new Dictionary<long, string>();
            foreach (var kv in panelOfButton)
            {
                if (panelName.ContainsKey(kv.Value)) continue;
                Tr pt;
                string nm = "";
                if (trById.TryGetValue(kv.Value, out pt)) goName.TryGetValue(pt.Go, out nm);
                panelName[kv.Value] = nm == null ? "" : nm;
            }

            // --- map image rect (erste Tafel, für Rückwärtskompatibilität) ---
            float imgAx = 0, imgAy = 0, imgW = 0, imgH = 0, imgS = 1;
            if (mapImageGo != 0)
            {
                Tr t;
                if (trByGo.TryGetValue(mapImageGo, out t))
                {
                    imgAx = t.Ax; imgAy = t.Ay; imgW = t.Sw; imgH = t.Sh; imgS = t.Sx;
                }
            }

            // --- button -> quickjump target ---
            var btnTarget = new Dictionary<long, long>();  // buttonGo -> quickJump go
            foreach (long bgo in buttons)
            {
                long[] comps;
                if (!goComps.TryGetValue(bgo, out comps)) continue;
                foreach (long cid in comps)
                {
                    ObjInfo co;
                    if (!sf.ById.TryGetValue(cid, out co) || co.ClassId != 114) continue;
                    if (co.ByteSize > 4096) continue;
                    byte[] d = sf.Read(co);
                    bool found = false;
                    for (int p = 28; p + 12 <= d.Length && !found; p += 4)
                    {
                        if (BitConverter.ToInt32(d, p) != 0) continue;
                        long pid = BitConverter.ToInt64(d, p + 4);
                        if (pid == 0) continue;
                        long qgo;
                        if (quickJumps.TryGetValue(pid, out qgo)) { btnTarget[bgo] = qgo; found = true; break; }
                        // fallback: any world Transform target that is not part of the map UI
                        Tr tt;
                        if (co.ByteSize <= 120 && trById.TryGetValue(pid, out tt) && !tt.Rect)
                        {
                            string tn;
                            if (goName.TryGetValue(tt.Go, out tn) && !tn.StartsWith("Map"))
                            { btnTarget[bgo] = tt.Go; found = true; break; }
                        }
                    }
                    if (found) break;
                }
            }

            // --- button ordering by UI sibling index ---
            var order = new Dictionary<long, int>();
            foreach (long bgo in buttons)
            {
                Tr t;
                if (!trByGo.TryGetValue(bgo, out t)) continue;
                Tr par;
                if (t.Father != 0 && trById.TryGetValue(t.Father, out par) && par.Children != null)
                {
                    for (int i = 0; i < par.Children.Length; i++)
                        if (par.Children[i] == t.Id) { order[bgo] = i; break; }
                }
            }

            var sorted = new List<long>(buttons);
            sorted.Sort(delegate (long a, long b)
            {
                int oa = order.ContainsKey(a) ? order[a] : 9999;
                int ob = order.ContainsKey(b) ? order[b] : 9999;
                if (oa != ob) return oa.CompareTo(ob);
                return a.CompareTo(b);
            });

            StringBuilder j = new StringBuilder();
            j.Append("{\"file\":\"").Append(Path.GetFileName(file)).Append('"');
            j.Append(",\"mapImage\":{\"ax\":").Append(F(imgAx)).Append(",\"ay\":").Append(F(imgAy));
            j.Append(",\"w\":").Append(F(imgW)).Append(",\"h\":").Append(F(imgH)).Append(",\"scale\":").Append(F(imgS)).Append("}");

            // Tafeln in stabiler Reihenfolge: erst die mit den meisten Buttons.
            var panelIds = new List<long>();
            foreach (var kv in panelOfButton) if (!panelIds.Contains(kv.Value)) panelIds.Add(kv.Value);
            panelIds.Sort(delegate (long a, long b)
            {
                int ca = 0, cb = 0;
                foreach (var kv in panelOfButton) { if (kv.Value == a) ca++; if (kv.Value == b) cb++; }
                if (ca != cb) return cb.CompareTo(ca);
                return a.CompareTo(b);
            });

            j.Append(",\"panels\":[");
            for (int pi = 0; pi < panelIds.Count; pi++)
            {
                long pid = panelIds[pi];
                if (pi > 0) j.Append(',');
                string pn;
                panelName.TryGetValue(pid, out pn);
                j.Append("{\"name\":\"").Append(Extractor.Esc(pn == null ? "" : pn)).Append('"');

                long imgGo;
                float ax = 0, ay = 0, iw = 0, ih = 0, isc = 1;
                if (imageOfPanel.TryGetValue(pid, out imgGo))
                {
                    Tr it;
                    if (trByGo.TryGetValue(imgGo, out it)) { ax = it.Ax; ay = it.Ay; iw = it.Sw; ih = it.Sh; isc = it.Sx; }
                }
                j.Append(",\"mapImage\":{\"ax\":").Append(F(ax)).Append(",\"ay\":").Append(F(ay));
                j.Append(",\"w\":").Append(F(iw)).Append(",\"h\":").Append(F(ih)).Append(",\"scale\":").Append(F(isc)).Append("}");

                j.Append(",\"spots\":[");
                int n = 0;
                foreach (long bgo in sorted)
                {
                    long bp;
                    if (!panelOfButton.TryGetValue(bgo, out bp) || bp != pid) continue;
                    Tr t;
                    trByGo.TryGetValue(bgo, out t);
                    if (n > 0) j.Append(',');
                    n++;
                    j.Append("{\"n\":").Append(n).Append(",\"name\":\"").Append(Extractor.Esc(goName[bgo])).Append('"');
                    if (t != null) { j.Append(",\"ax\":").Append(F(t.Ax)).Append(",\"ay\":").Append(F(t.Ay)); }
                    long q;
                    if (btnTarget.TryGetValue(bgo, out q))
                    {
                        Tr qt;
                        if (trByGo.TryGetValue(q, out qt))
                        {
                            float[] w = world(qt);
                            j.Append(",\"target\":\"").Append(Extractor.Esc(goName[q])).Append('"');
                            j.Append(",\"wx\":").Append(F(w[0])).Append(",\"wy\":").Append(F(w[1])).Append(",\"wz\":").Append(F(w[2]));
                        }
                    }
                    j.Append('}');
                }
                j.Append("]}");
            }
            j.Append(']');

            // Der GameController der Szene listet die Zusatzarten des
            // New-Fish-Species-DLC, die keine eigenen Spawner in der Szene haben.
            j.Append(",\"extraFish\":[");
            bool fx = true;
            foreach (var kv in goName)
            {
                if (kv.Value != "GameController") continue;
                long[] cps2;
                if (!goComps.TryGetValue(kv.Key, out cps2)) continue;
                foreach (long cid in cps2)
                {
                    ObjInfo co;
                    if (!sf.ById.TryGetValue(cid, out co) || co.ClassId != 114) continue;
                    byte[] d = sf.Read(co);
                    for (int p = 0; p + 12 <= d.Length; p += 4)
                    {
                        int fid = BitConverter.ToInt32(d, p);
                        if (fid < 1 || fid > sf.Externals.Count) continue;
                        long pp = BitConverter.ToInt64(d, p + 4);
                        if (pp <= 0) continue;
                        if (!fx) j.Append(',');
                        fx = false;
                        j.Append('"').Append(fid).Append(':').Append(pp).Append('"');
                    }
                }
            }
            j.Append(']');

            j.Append(",\"externals\":[");
            for (int i = 0; i < sf.Externals.Count; i++) { if (i > 0) j.Append(','); j.Append('"').Append(Extractor.Esc(sf.Externals[i])).Append('"'); }
            j.Append(']');

            j.Append(",\"spawners\":[");
            bool first = true;
            foreach (long sgo in spawners)
            {
                Tr t;
                if (!trByGo.TryGetValue(sgo, out t)) continue;
                float[] w = world(t);
                string nm = goName[sgo];
                int par = nm.IndexOf(" (");
                string species = par > 0 ? nm.Substring(0, par) : nm;
                species = species.Substring("FishSpawner_".Length);

                // spawner MonoBehaviour: PPtr fish, PPtr[] altFish, int count, ..., float radius, float prob
                int refFile = 0; long refPath = 0; int cnt = 0; float radius = 0, prob = 0;
                var alts = new List<string>();
                long[] cps;
                if (goComps.TryGetValue(sgo, out cps))
                {
                    foreach (long cid in cps)
                    {
                        ObjInfo co;
                        if (!sf.ById.TryGetValue(cid, out co) || co.ClassId != 114) continue;
                        if (co.ByteSize < 100 || co.ByteSize > 260) continue;
                        byte[] d = sf.Read(co);
                        try
                        {
                            Reader r = new Reader(d);
                            r.Skip(28);                 // header + empty m_Name
                            int magic = r.I32();
                            if (magic != 132) continue;
                            refFile = r.I32(); refPath = r.I64();
                            int na = r.I32();
                            if (na < 0 || na > 32) continue;
                            for (int k = 0; k < na; k++) { int ff = r.I32(); long pp = r.I64(); alts.Add(ff + ":" + pp); }
                            cnt = r.I32();
                            r.Skip(24);
                            if (r.Can(8)) { radius = r.F32(); prob = r.F32(); }
                            break;
                        }
                        catch { }
                    }
                }

                if (!first) j.Append(',');
                first = false;
                j.Append("{\"s\":\"").Append(Extractor.Esc(species)).Append('"');
                j.Append(",\"x\":").Append(F(w[0])).Append(",\"y\":").Append(F(w[1])).Append(",\"z\":").Append(F(w[2]));
                j.Append(",\"ref\":\"").Append(refFile).Append(':').Append(refPath).Append('"');
                if (alts.Count > 0)
                {
                    j.Append(",\"alt\":[");
                    for (int k = 0; k < alts.Count; k++) { if (k > 0) j.Append(','); j.Append('"').Append(alts[k]).Append('"'); }
                    j.Append(']');
                }
                j.Append(",\"n\":").Append(cnt).Append(",\"r\":").Append(F(radius)).Append(",\"p\":").Append(F(prob));
                j.Append('}');
            }
            j.Append(']');
            j.Append('}');
            sf.Close();
            return j.ToString();
        }
    }
}
