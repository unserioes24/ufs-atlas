using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace Ufs
{
    /// <summary>
    /// Reads a scene's FishSpawners using the class's real field layout, the way
    /// Assembly-CSharp.dll spells it out:
    ///
    ///     Fish.Species species;      // [ReadOnly] enum, int32
    ///     Fish         fishPrefab;   // PPtr
    ///     List&lt;Fish&gt;   fishPrefabs;  // int32 Anzahl + PPtr je Eintrag
    ///     List&lt;Fish&gt;   fishPrefabsDLC;
    ///     int          count;
    ///     bool  fastDurabilityDrain, hideOtherDuringFight, wasUsed,
    ///           spawnersParent, alwaysSpawn, spawnAtStart;
    ///     float maxFishAwayDistance, fishSizeMultiplier;
    ///
    /// An earlier version had missed the list of DLC species and concluded from
    /// that the New Fish Species DLC has no spawn points at all.
    /// </summary>
    public class SpawnerDlc
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
        }

        class Parsed
        {
            public int Species;
            public string Main;
            public List<string> Prefabs = new List<string>();
            public List<string> Dlc = new List<string>();
            public int Count;
            public float Radius;
            public bool Ok;
        }

        /// <summary>Takes a MonoBehaviour block apart along the layout above.</summary>
        static Parsed Parse(byte[] d)
        {
            Parsed p = new Parsed();
            try
            {
                Reader r = new Reader(d);
                r.Skip(12);                 // PPtr m_GameObject
                r.Skip(4);                  // m_Enabled + Ausrichtung
                r.Skip(12);                 // PPtr m_Script
                r.Str();                    // m_Name (leer bei Szenenobjekten)

                p.Species = r.I32();
                if (p.Species < 0 || p.Species > 200) return p;

                p.Main = Ptr(r);

                int n = r.I32();
                if (n < 0 || n > 64) return p;
                for (int i = 0; i < n; i++) p.Prefabs.Add(Ptr(r));

                int m = r.I32();
                if (m < 0 || m > 64) return p;
                for (int i = 0; i < m; i++) p.Dlc.Add(Ptr(r));

                p.Count = r.I32();
                if (p.Count < 0 || p.Count > 500) return p;

                r.Skip(6);                  // sechs bool
                r.Skip(2);                  // Ausrichtung auf 4 Byte
                p.Radius = r.F32();         // maxFishAwayDistance
                r.F32();                    // fishSizeMultiplier
                p.Ok = true;
            }
            catch { }
            return p;
        }

        static string Ptr(Reader r)
        {
            int file = r.I32();
            long path = r.I64();
            return file + ":" + path;
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
                        goName[o.PathId] = r.Str();
                        goComps[o.PathId] = comps;
                    }
                    catch { }
                }
                else if (o.ClassId == 4)
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
                        for (int i = 0; i < cc; i++) { r.I32(); r.I64(); }
                        r.I32(); t.Father = r.I64();
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

            StringBuilder j = new StringBuilder();
            j.Append("{\"file\":\"").Append(Path.GetFileName(file)).Append('"');
            j.Append(",\"externals\":[");
            for (int i = 0; i < sf.Externals.Count; i++)
            {
                if (i > 0) j.Append(',');
                j.Append('"').Append(Extractor.Esc(sf.Externals[i])).Append('"');
            }
            j.Append("],\"spawners\":[");

            bool first = true;
            foreach (var kv in goName)
            {
                if (!kv.Value.StartsWith("FishSpawner_")) continue;
                long[] cps;
                if (!goComps.TryGetValue(kv.Key, out cps)) continue;

                Parsed best = null;
                foreach (long cid in cps)
                {
                    ObjInfo co;
                    if (!sf.ById.TryGetValue(cid, out co) || co.ClassId != 114) continue;
                    Parsed p = Parse(sf.Read(co));
                    if (p.Ok) { best = p; break; }
                }
                if (best == null) continue;

                Tr t;
                float[] w = new float[] { 0, 0, 0 };
                if (trByGo.TryGetValue(kv.Key, out t)) w = world(t);

                string nm = kv.Value;
                int par = nm.IndexOf(" (");
                string label = (par > 0 ? nm.Substring(0, par) : nm).Substring("FishSpawner_".Length);

                if (!first) j.Append(',');
                first = false;
                j.Append("{\"label\":\"").Append(Extractor.Esc(label)).Append('"');
                j.Append(",\"species\":").Append(best.Species);
                j.Append(",\"x\":").Append(F(w[0])).Append(",\"y\":").Append(F(w[1])).Append(",\"z\":").Append(F(w[2]));
                j.Append(",\"n\":").Append(best.Count).Append(",\"r\":").Append(F(best.Radius));
                j.Append(",\"main\":\"").Append(best.Main).Append('"');
                j.Append(",\"prefabs\":[");
                for (int i = 0; i < best.Prefabs.Count; i++)
                {
                    if (i > 0) j.Append(',');
                    j.Append('"').Append(best.Prefabs[i]).Append('"');
                }
                j.Append("],\"dlc\":[");
                for (int i = 0; i < best.Dlc.Count; i++)
                {
                    if (i > 0) j.Append(',');
                    j.Append('"').Append(best.Dlc[i]).Append('"');
                }
                j.Append("]}");
            }
            j.Append("]}");
            sf.Close();
            return j.ToString();
        }
    }
}
