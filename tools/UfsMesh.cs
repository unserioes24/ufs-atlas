using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace Ufs
{
    /// Liest Unity-Meshes (Klasse 43, Unity 2017.4, ohne Type-Tree) und exportiert
    /// Positionen, UVs und Indizes in ein kompaktes Binärformat für den WebGL-Viewer.
    public class MeshTool
    {
        public class MeshInfo
        {
            public long PathId;
            public string Name;
            public int VertexCount;
            public int IndexCount;
            public int SubMeshes;
            public string Error;
        }

        // Reihenfolge der Vertex-Kanäle in Unity 5.x/2017.x
        const int CH_VERTEX = 0, CH_UV0 = 4;

        static int FormatSize(int fmt)
        {
            switch (fmt)
            {
                case 0: return 4;   // Float
                case 1: return 2;   // Float16
                case 2: return 1;   // Color (UNorm8)
                case 3: return 1;   // UNorm8
                case 4: return 1;   // SNorm8
                case 5: return 2;   // UNorm16
                case 6: return 2;   // SNorm16
                case 7: return 1;   // UInt8
                case 8: return 1;   // SInt8
                case 9: return 2;   // UInt16
                case 10: return 2;  // SInt16
                case 11: return 4;  // UInt32
                case 12: return 4;  // SInt32
                default: return 0;
            }
        }

        static float ReadHalf(byte[] b, int o)
        {
            ushort h = BitConverter.ToUInt16(b, o);
            int sign = (h >> 15) & 1, exp = (h >> 10) & 0x1F, man = h & 0x3FF;
            if (exp == 0)
            {
                if (man == 0) return sign == 1 ? -0f : 0f;
                float v = man / 1024f * (float)Math.Pow(2, -14);
                return sign == 1 ? -v : v;
            }
            if (exp == 31) return sign == 1 ? float.NegativeInfinity : float.PositiveInfinity;
            float r = (1f + man / 1024f) * (float)Math.Pow(2, exp - 15);
            return sign == 1 ? -r : r;
        }

        static float ReadComponent(byte[] b, int o, int fmt)
        {
            switch (fmt)
            {
                case 0: return BitConverter.ToSingle(b, o);
                case 1: return ReadHalf(b, o);
                case 2:
                case 3: return b[o] / 255f;
                case 4: return Math.Max(-1f, (sbyte)b[o] / 127f);
                case 5: return BitConverter.ToUInt16(b, o) / 65535f;
                case 6: return Math.Max(-1f, (short)BitConverter.ToUInt16(b, o) / 32767f);
                default: return 0f;
            }
        }

        /// Parst ein Mesh. Liefert null bei unbekanntem Aufbau.
        public static MeshInfo Read(SerializedFile sf, ObjInfo o, out float[] pos, out float[] uv, out int[] idx)
        {
            pos = null; uv = null; idx = null;
            MeshInfo mi = new MeshInfo();
            mi.PathId = o.PathId;
            byte[] d = sf.Read(o);
            Reader r = new Reader(d);
            try
            {
                mi.Name = r.Str();

                int subCount = r.I32();
                if (subCount < 0 || subCount > 256) { mi.Error = "submesh " + subCount; return mi; }
                mi.SubMeshes = subCount;
                var firstByte = new uint[subCount];
                var idxCount = new uint[subCount];
                var baseVertex = new uint[subCount];
                for (int i = 0; i < subCount; i++)
                {
                    firstByte[i] = r.U32();
                    idxCount[i] = r.U32();
                    r.I32();                       // topology
                    baseVertex[i] = r.U32();       // 2017.3+
                    r.U32(); r.U32();              // firstVertex, vertexCount
                    r.Skip(24);                    // AABB
                }

                // BlendShapeData
                int bsVerts = r.I32();
                if (bsVerts < 0 || bsVerts > 4000000) { mi.Error = "blendshape"; return mi; }
                r.Skip(bsVerts * 40);
                int bsShapes = r.I32();
                if (bsShapes < 0 || bsShapes > 100000) { mi.Error = "shapes"; return mi; }
                for (int i = 0; i < bsShapes; i++) { r.Skip(8); r.U8(); r.U8(); r.Align(); }
                int bsChan = r.I32();
                if (bsChan < 0 || bsChan > 100000) { mi.Error = "channels"; return mi; }
                for (int i = 0; i < bsChan; i++) { r.Str(); r.U32(); r.I32(); r.I32(); }
                int bsW = r.I32();
                if (bsW < 0 || bsW > 1000000) { mi.Error = "weights"; return mi; }
                r.Skip(bsW * 4);

                int bindPose = r.I32();
                if (bindPose < 0 || bindPose > 100000) { mi.Error = "bindpose"; return mi; }
                r.Skip(bindPose * 64);
                int boneHashes = r.I32();
                if (boneHashes < 0 || boneHashes > 100000) { mi.Error = "bones"; return mi; }
                r.Skip(boneHashes * 4);
                r.U32();                           // rootBoneNameHash
                r.U8();                            // meshCompression
                r.U8(); r.U8(); r.U8();            // isReadable, keepVertices, keepIndices
                r.Align();
                int indexFormat = r.I32();         // 0 = UInt16, 1 = UInt32

                int ibSize = r.I32();
                if (ibSize < 0 || ibSize > 80000000) { mi.Error = "indexbuffer"; return mi; }
                byte[] ib = new byte[ibSize];
                Array.Copy(d, r.Pos, ib, 0, ibSize);
                r.Skip(ibSize); r.Align();

                // m_Skin: vector<BoneWeights4>, je Eintrag 4 float + 4 int = 32 Byte
                int skin = r.I32();
                if (skin < 0 || skin > 5000000 || !r.Can(skin * 32)) { mi.Error = "skin " + skin; return mi; }
                r.Skip(skin * 32);

                // VertexData: je nach Unity-Patch steht davor noch m_CurrentChannels.
                // Beide Varianten probieren und die plausible übernehmen.
                int vdStart = r.Pos;
                int vCount = 0, chCount = 0, vbSize = 0;
                int[] chStream = null, chOffset = null, chFormat = null, chDim = null;
                bool okLayout = false;
                for (int variant = 0; variant < 2 && !okLayout; variant++)
                {
                    r.Pos = vdStart;
                    if (variant == 0) r.U32();                 // m_CurrentChannels
                    if (!r.Can(8)) continue;
                    vCount = r.I32();
                    if (vCount <= 0 || vCount > 5000000) continue;
                    chCount = r.I32();
                    if (chCount <= 0 || chCount > 32 || !r.Can(chCount * 4 + 4)) continue;
                    chStream = new int[chCount]; chOffset = new int[chCount];
                    chFormat = new int[chCount]; chDim = new int[chCount];
                    bool bad = false;
                    for (int i = 0; i < chCount; i++)
                    {
                        chStream[i] = r.U8(); chOffset[i] = r.U8(); chFormat[i] = r.U8();
                        chDim[i] = r.U8() & 0x0F;
                        if (chStream[i] > 7 || chFormat[i] > 12 || chDim[i] > 4) bad = true;
                    }
                    if (bad) continue;
                    vbSize = r.I32();
                    if (vbSize <= 0 || vbSize > 200000000 || !r.Can(vbSize)) continue;
                    okLayout = true;
                }
                if (!okLayout) { mi.Error = "vertexdata nicht erkannt"; return mi; }
                mi.VertexCount = vCount;
                byte[] vb;
                if (vbSize > 0)
                {
                    vb = new byte[vbSize];
                    Array.Copy(d, r.Pos, vb, 0, vbSize);
                    r.Skip(vbSize); r.Align();
                }
                else
                {
                    mi.Error = "vertexdaten liegen im Stream";
                    return mi;
                }

                // Strides je Stream aus den Kanälen ableiten
                int maxStream = 0;
                for (int i = 0; i < chCount; i++) if (chDim[i] > 0 && chStream[i] > maxStream) maxStream = chStream[i];
                var stride = new int[maxStream + 1];
                for (int i = 0; i < chCount; i++)
                {
                    if (chDim[i] <= 0) continue;
                    int end = chOffset[i] + FormatSize(chFormat[i]) * chDim[i];
                    if (end > stride[chStream[i]]) stride[chStream[i]] = end;
                }
                for (int s = 0; s <= maxStream; s++) if (stride[s] % 4 != 0) stride[s] += 4 - (stride[s] % 4);
                var streamStart = new int[maxStream + 1];
                int acc = 0;
                for (int s = 0; s <= maxStream; s++)
                {
                    streamStart[s] = acc;
                    acc += stride[s] * vCount;
                    if (acc % 16 != 0) acc += 16 - (acc % 16);
                }

                if (chCount <= CH_VERTEX || chDim[CH_VERTEX] < 3) { mi.Error = "keine Positionen"; return mi; }

                pos = new float[vCount * 3];
                for (int v = 0; v < vCount; v++)
                {
                    int b0 = streamStart[chStream[CH_VERTEX]] + v * stride[chStream[CH_VERTEX]] + chOffset[CH_VERTEX];
                    int fs = FormatSize(chFormat[CH_VERTEX]);
                    if (b0 + fs * 3 > vb.Length) { mi.Error = "position out of range"; return mi; }
                    pos[v * 3] = ReadComponent(vb, b0, chFormat[CH_VERTEX]);
                    pos[v * 3 + 1] = ReadComponent(vb, b0 + fs, chFormat[CH_VERTEX]);
                    pos[v * 3 + 2] = ReadComponent(vb, b0 + fs * 2, chFormat[CH_VERTEX]);
                }

                // Kanalreihenfolge in Unity 5.x/2017: 0 Position, 1 Normal, 2 Farbe,
                // 3 UV0 … 6 UV3, 7 Tangente. Ab 2018 rutscht UV0 auf Index 4.
                int uvCh = chCount <= 8 ? 3 : CH_UV0;
                if (chCount > uvCh && chDim[uvCh] >= 2)
                {
                    uv = new float[vCount * 2];
                    int fs = FormatSize(chFormat[uvCh]);
                    for (int v = 0; v < vCount; v++)
                    {
                        int b0 = streamStart[chStream[uvCh]] + v * stride[chStream[uvCh]] + chOffset[uvCh];
                        if (b0 + fs * 2 > vb.Length) { uv = null; break; }
                        uv[v * 2] = ReadComponent(vb, b0, chFormat[uvCh]);
                        uv[v * 2 + 1] = ReadComponent(vb, b0 + fs, chFormat[uvCh]);
                    }
                }

                // Indizes des größten Submesh
                int best = 0;
                for (int i = 1; i < subCount; i++) if (idxCount[i] > idxCount[best]) best = i;
                int step = indexFormat == 1 ? 4 : 2;
                int n = (int)idxCount[best];
                if (n <= 0 || (int)firstByte[best] + n * step > ib.Length) { mi.Error = "indexbereich"; return mi; }
                idx = new int[n];
                for (int i = 0; i < n; i++)
                {
                    int off = (int)firstByte[best] + i * step;
                    idx[i] = (step == 2 ? BitConverter.ToUInt16(ib, off) : (int)BitConverter.ToUInt32(ib, off)) + (int)baseVertex[best];
                    if (idx[i] < 0 || idx[i] >= vCount) { mi.Error = "index " + idx[i] + " von " + vCount; return mi; }
                }
                mi.IndexCount = n;
                return mi;
            }
            catch (Exception ex)
            {
                mi.Error = ex.GetType().Name;
                return mi;
            }
        }

        /// Ordnet jedem Fisch-Prefab das Mesh seines Renderers zu.
        /// Sucht im Teilbaum des Prefabs nach SkinnedMeshRenderer (137) bzw.
        /// MeshFilter (33) und liest daraus den Verweis auf ein Mesh (43).
        public static string MapFishMeshes(string file, string nameRegex)
        {
            SerializedFile sf = new SerializedFile(file);
            var goName = new Dictionary<long, string>();
            var goComps = new Dictionary<long, long[]>();
            var trByGo = new Dictionary<long, long>();          // go -> transform
            var trGo = new Dictionary<long, long>();            // transform -> go
            var trKids = new Dictionary<long, long[]>();
            var meshVerts = new Dictionary<long, int>();

            foreach (ObjInfo o in sf.Objects)
            {
                if (o.ClassId == 1)
                {
                    try
                    {
                        Reader r = new Reader(sf.Read(o));
                        int n = r.I32();
                        if (n < 0 || n > 500) continue;
                        long[] cs = new long[n];
                        for (int i = 0; i < n; i++) { r.I32(); cs[i] = r.I64(); }
                        r.I32();
                        goName[o.PathId] = r.Str();
                        goComps[o.PathId] = cs;
                    }
                    catch { }
                }
                else if (o.ClassId == 4)
                {
                    try
                    {
                        Reader r = new Reader(sf.Read(o));
                        r.I32();
                        long go = r.I64();
                        r.Skip(40);
                        int cc = r.I32();
                        if (cc < 0 || cc > 100000) continue;
                        long[] kids = new long[cc];
                        for (int i = 0; i < cc; i++) { r.I32(); kids[i] = r.I64(); }
                        trByGo[go] = o.PathId; trGo[o.PathId] = go; trKids[o.PathId] = kids;
                    }
                    catch { }
                }
                else if (o.ClassId == 43)
                {
                    float[] p; float[] u; int[] ix;
                    MeshInfo mi = Read(sf, o, out p, out u, out ix);
                    if (mi.VertexCount > 0) meshVerts[o.PathId] = mi.VertexCount;
                }
            }

            var rx = new System.Text.RegularExpressions.Regex(nameRegex);
            StringBuilder j = new StringBuilder();
            j.Append('[');
            bool first = true;
            foreach (var kv in goName)
            {
                if (!rx.IsMatch(kv.Value)) continue;
                long root;
                if (!trByGo.TryGetValue(kv.Key, out root)) continue;

                // Teilbaum einsammeln
                var stack = new Stack<long>();
                stack.Push(root);
                long bestMesh = 0; int bestV = 0; int guard = 0;
                while (stack.Count > 0 && guard++ < 20000)
                {
                    long tr = stack.Pop();
                    long[] kids;
                    if (trKids.TryGetValue(tr, out kids)) foreach (long k in kids) stack.Push(k);
                    long go;
                    if (!trGo.TryGetValue(tr, out go)) continue;
                    long[] comps;
                    if (!goComps.TryGetValue(go, out comps)) continue;
                    foreach (long cid in comps)
                    {
                        ObjInfo co;
                        if (!sf.ById.TryGetValue(cid, out co)) continue;
                        if (co.ClassId != 137 && co.ClassId != 33) continue;
                        byte[] d = sf.Read(co);
                        for (int p = 0; p + 12 <= d.Length; p += 4)
                        {
                            if (BitConverter.ToInt32(d, p) != 0) continue;
                            long mid = BitConverter.ToInt64(d, p + 4);
                            int vc;
                            if (!meshVerts.TryGetValue(mid, out vc)) continue;
                            if (vc > bestV) { bestV = vc; bestMesh = mid; }
                        }
                    }
                }
                if (bestMesh == 0) continue;

                // Textur über die Materialien des Renderers bestimmen
                long bestTex = 0; int bestTexScore = -1;
                var stack2 = new Stack<long>();
                stack2.Push(root);
                int guard2 = 0;
                while (stack2.Count > 0 && guard2++ < 20000)
                {
                    long tr = stack2.Pop();
                    long[] kids;
                    if (trKids.TryGetValue(tr, out kids)) foreach (long k in kids) stack2.Push(k);
                    long go;
                    if (!trGo.TryGetValue(tr, out go)) continue;
                    long[] comps;
                    if (!goComps.TryGetValue(go, out comps)) continue;
                    foreach (long cid in comps)
                    {
                        ObjInfo co;
                        if (!sf.ById.TryGetValue(cid, out co)) continue;
                        if (co.ClassId != 137 && co.ClassId != 23) continue;
                        byte[] d = sf.Read(co);
                        for (int p = 0; p + 12 <= d.Length; p += 4)
                        {
                            if (BitConverter.ToInt32(d, p) != 0) continue;
                            long matId = BitConverter.ToInt64(d, p + 4);
                            ObjInfo mo;
                            if (!sf.ById.TryGetValue(matId, out mo) || mo.ClassId != 21) continue;
                            // Im Material gezielt die Eigenschaft _MainTex suchen:
                            // int32 Länge (8) + "_MainTex" + PPtr(int fileID, long pathID)
                            byte[] md = sf.Read(mo);
                            for (int q = 0; q + 24 <= md.Length; q += 4)
                            {
                                if (BitConverter.ToInt32(md, q) != 8) continue;
                                if (md[q + 4] != (byte)'_' || md[q + 5] != (byte)'M' || md[q + 6] != (byte)'a' ||
                                    md[q + 7] != (byte)'i' || md[q + 8] != (byte)'n' || md[q + 9] != (byte)'T' ||
                                    md[q + 10] != (byte)'e' || md[q + 11] != (byte)'x') continue;
                                if (BitConverter.ToInt32(md, q + 12) != 0) continue;
                                long texId = BitConverter.ToInt64(md, q + 16);
                                ObjInfo to;
                                if (!sf.ById.TryGetValue(texId, out to) || to.ClassId != 28) continue;
                                if (bestTexScore < 100) { bestTexScore = 100; bestTex = texId; }
                            }
                        }
                    }
                }

                if (!first) j.Append(',');
                first = false;
                j.Append("{\"fish\":\"").Append(Extractor.Esc(kv.Value)).Append('"')
                 .Append(",\"mesh\":").Append(bestMesh).Append(",\"v\":").Append(bestV)
                 .Append(",\"tex\":").Append(bestTex).Append('}');
            }
            j.Append(']');
            sf.Close();
            return j.ToString();
        }

        /// Listet alle Meshes einer Datei mit Namen und Zählwerten.
        public static string List(string file)
        {
            SerializedFile sf = new SerializedFile(file);
            StringBuilder j = new StringBuilder();
            j.Append('[');
            bool first = true;
            foreach (ObjInfo o in sf.Objects)
            {
                if (o.ClassId != 43) continue;
                float[] p; float[] u; int[] ix;
                MeshInfo mi = Read(sf, o, out p, out u, out ix);
                if (!first) j.Append(',');
                first = false;
                j.Append("{\"id\":").Append(mi.PathId)
                 .Append(",\"name\":\"").Append(Extractor.Esc(mi.Name == null ? "" : mi.Name)).Append('"')
                 .Append(",\"v\":").Append(mi.VertexCount)
                 .Append(",\"i\":").Append(mi.IndexCount)
                 .Append(",\"uv\":").Append(u == null ? 0 : 1)
                 .Append(",\"err\":\"").Append(Extractor.Esc(mi.Error == null ? "" : mi.Error)).Append("\"}");
            }
            j.Append(']');
            sf.Close();
            return j.ToString();
        }

        /// Exportiert ein Mesh als kompakte Binärdatei:
        /// "UFSM" | u16 version | u16 vertexCount | u32 indexCount | 6 float bounds
        /// | int16 positions (quantisiert) | uint16 uvs | uint16 indices
        public static string Export(string file, long pathId, string outFile, int maxVerts)
        {
            SerializedFile sf = new SerializedFile(file);
            ObjInfo o;
            if (!sf.ById.TryGetValue(pathId, out o) || o.ClassId != 43) { sf.Close(); return "nicht gefunden"; }
            float[] pos, uv; int[] idx;
            MeshInfo mi = Read(sf, o, out pos, out uv, out idx);
            sf.Close();
            if (pos == null || idx == null) return "fehler: " + mi.Error;
            if (mi.VertexCount > maxVerts) return "zu gross: " + mi.VertexCount;
            if (mi.VertexCount > 65535) return "zu viele vertices";

            float minX = float.MaxValue, minY = float.MaxValue, minZ = float.MaxValue;
            float maxX = float.MinValue, maxY = float.MinValue, maxZ = float.MinValue;
            for (int v = 0; v < mi.VertexCount; v++)
            {
                float x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
                if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
            }
            float sx = Math.Max(1e-6f, maxX - minX), sy = Math.Max(1e-6f, maxY - minY), sz = Math.Max(1e-6f, maxZ - minZ);

            using (var fs = File.Create(outFile))
            using (var w = new BinaryWriter(fs))
            {
                w.Write(new char[] { 'U', 'F', 'S', 'M' });
                w.Write((ushort)1);
                w.Write((ushort)mi.VertexCount);
                w.Write((uint)idx.Length);
                w.Write(minX); w.Write(minY); w.Write(minZ);
                w.Write(sx); w.Write(sy); w.Write(sz);
                for (int v = 0; v < mi.VertexCount; v++)
                {
                    w.Write((short)Math.Round((pos[v * 3] - minX) / sx * 32000f - 16000f));
                    w.Write((short)Math.Round((pos[v * 3 + 1] - minY) / sy * 32000f - 16000f));
                    w.Write((short)Math.Round((pos[v * 3 + 2] - minZ) / sz * 32000f - 16000f));
                }
                for (int v = 0; v < mi.VertexCount; v++)
                {
                    float u = uv == null ? 0f : uv[v * 2];
                    float vv = uv == null ? 0f : uv[v * 2 + 1];
                    u = u - (float)Math.Floor(u); vv = vv - (float)Math.Floor(vv);
                    w.Write((ushort)Math.Min(65535, Math.Max(0, (int)Math.Round(u * 65535f))));
                    w.Write((ushort)Math.Min(65535, Math.Max(0, (int)Math.Round(vv * 65535f))));
                }
                for (int i = 0; i < idx.Length; i++) w.Write((ushort)idx[i]);
            }
            return "ok v=" + mi.VertexCount + " i=" + idx.Length;
        }
    }
}
