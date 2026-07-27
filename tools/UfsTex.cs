using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

namespace Ufs
{
    public class TexExport
    {
        // Unity TextureFormat: 3=RGB24, 4=RGBA32, 5=ARGB32, 7=RGB565, 10=DXT1(BC1), 12=DXT5(BC3)
        public static string Save(string dataFile, long offset, int size, int w, int h, int fmt, string outPng)
        {
            byte[] raw = new byte[size];
            using (FileStream fs = File.OpenRead(dataFile))
            {
                fs.Position = offset;
                int got = 0;
                while (got < size) { int n = fs.Read(raw, got, size - got); if (n <= 0) break; got += n; }
                if (got < size) return "short read " + got + "/" + size;
            }

            byte[] rgba = new byte[w * h * 4];   // BGRA order for System.Drawing
            switch (fmt)
            {
                case 3: Rgb24(raw, rgba, w, h); break;
                case 4: Rgba32(raw, rgba, w, h); break;
                case 5: Argb32(raw, rgba, w, h); break;
                case 10: Bc1(raw, rgba, w, h); break;
                case 12: Bc3(raw, rgba, w, h); break;
                default: return "unsupported format " + fmt;
            }

            // Unity stores textures bottom-up -> flip
            byte[] flipped = new byte[rgba.Length];
            int stride = w * 4;
            for (int y = 0; y < h; y++) Array.Copy(rgba, y * stride, flipped, (h - 1 - y) * stride, stride);

            using (Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
            {
                BitmapData bd = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                Marshal.Copy(flipped, 0, bd.Scan0, flipped.Length);
                bmp.UnlockBits(bd);
                if (outPng.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase))
                {
                    ImageCodecInfo enc = null;
                    foreach (ImageCodecInfo c in ImageCodecInfo.GetImageEncoders())
                        if (c.MimeType == "image/jpeg") enc = c;
                    EncoderParameters ps = new EncoderParameters(1);
                    ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 84L);
                    using (Bitmap flat = new Bitmap(w, h, PixelFormat.Format24bppRgb))
                    using (Graphics gr = Graphics.FromImage(flat))
                    {
                        gr.Clear(Color.Black);
                        gr.DrawImage(bmp, 0, 0, w, h);
                        flat.Save(outPng, enc, ps);
                    }
                }
                else bmp.Save(outPng, ImageFormat.Png);
            }
            return "ok " + w + "x" + h + " fmt" + fmt;
        }

        // Decode, auto-crop to visible content, keep the upper half when the
        // UV sheet holds two mirrored body copies, downscale and save as JPEG.
        public static string SaveFishCrop(string dataFile, long offset, int size, int w, int h, int fmt, string outJpg, int maxW)
        {
            byte[] raw = new byte[size];
            using (FileStream fs = File.OpenRead(dataFile))
            {
                fs.Position = offset;
                int got = 0;
                while (got < size) { int n = fs.Read(raw, got, size - got); if (n <= 0) break; got += n; }
                if (got < size) return "short read";
            }
            byte[] rgba = new byte[w * h * 4];
            switch (fmt)
            {
                case 3: Rgb24(raw, rgba, w, h); break;
                case 4: Rgba32(raw, rgba, w, h); break;
                case 5: Argb32(raw, rgba, w, h); break;
                case 10: Bc1(raw, rgba, w, h); break;
                case 12: Bc3(raw, rgba, w, h); break;
                default: return "unsupported format " + fmt;
            }
            byte[] flipped = new byte[rgba.Length];
            int stride = w * 4;
            for (int y = 0; y < h; y++) Array.Copy(rgba, y * stride, flipped, (h - 1 - y) * stride, stride);

            // content bounding box: pixel is content when clearly brighter than the black backdrop
            int x0 = w, y0 = h, x1 = -1, y1 = -1;
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    int o = (y * w + x) * 4;
                    int lum = (flipped[o] + flipped[o + 1] + flipped[o + 2]) / 3;
                    if (lum > 40)
                    {
                        if (x < x0) x0 = x;
                        if (x > x1) x1 = x;
                        if (y < y0) y0 = y;
                        if (y > y1) y1 = y;
                    }
                }
            if (x1 < x0 || y1 < y0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
            int cw = x1 - x0 + 1, ch = y1 - y0 + 1;
            if ((double)ch / cw > 0.36 && ch > 80) ch = (int)(ch * 0.52);   // keep the upper body only

            using (Bitmap full = new Bitmap(w, h, PixelFormat.Format32bppArgb))
            {
                BitmapData bd = full.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                Marshal.Copy(flipped, 0, bd.Scan0, flipped.Length);
                full.UnlockBits(bd);

                double sc = Math.Min(1.0, (double)maxW / cw);
                int ow = Math.Max(1, (int)(cw * sc)), oh = Math.Max(1, (int)(ch * sc));
                using (Bitmap outb = new Bitmap(ow, oh, PixelFormat.Format24bppRgb))
                using (Graphics gr = Graphics.FromImage(outb))
                {
                    gr.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    gr.Clear(Color.FromArgb(8, 16, 23));
                    gr.DrawImage(full, new Rectangle(0, 0, ow, oh), new Rectangle(x0, y0, cw, ch), GraphicsUnit.Pixel);
                    ImageCodecInfo enc = null;
                    foreach (ImageCodecInfo c in ImageCodecInfo.GetImageEncoders()) if (c.MimeType == "image/jpeg") enc = c;
                    EncoderParameters ps = new EncoderParameters(1);
                    ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 80L);
                    outb.Save(outJpg, enc, ps);
                    return "ok " + ow + "x" + oh;
                }
            }
        }

        /// Like Save, but without cropping and scaled down to maxDim, for callers whose
        /// UVs need the full texture.
        public static string SaveScaled(string dataFile, long offset, int size, int w, int h, int fmt, string outJpg, int maxDim)
        {
            byte[] raw = new byte[size];
            using (FileStream fs = File.OpenRead(dataFile))
            {
                fs.Position = offset;
                int got = 0;
                while (got < size) { int n = fs.Read(raw, got, size - got); if (n <= 0) break; got += n; }
                if (got < size) return "short read";
            }
            byte[] rgba = new byte[w * h * 4];
            switch (fmt)
            {
                case 3: Rgb24(raw, rgba, w, h); break;
                case 4: Rgba32(raw, rgba, w, h); break;
                case 5: Argb32(raw, rgba, w, h); break;
                case 10: Bc1(raw, rgba, w, h); break;
                case 12: Bc3(raw, rgba, w, h); break;
                default: return "unsupported format " + fmt;
            }
            byte[] flipped = new byte[rgba.Length];
            int stride = w * 4;
            for (int y = 0; y < h; y++) Array.Copy(rgba, y * stride, flipped, (h - 1 - y) * stride, stride);

            double sc = Math.Min(1.0, (double)maxDim / Math.Max(w, h));
            int ow = Math.Max(1, (int)(w * sc)), oh = Math.Max(1, (int)(h * sc));
            using (Bitmap full = new Bitmap(w, h, PixelFormat.Format32bppArgb))
            {
                BitmapData bd = full.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                Marshal.Copy(flipped, 0, bd.Scan0, flipped.Length);
                full.UnlockBits(bd);
                using (Bitmap outb = new Bitmap(ow, oh, PixelFormat.Format24bppRgb))
                using (Graphics gr = Graphics.FromImage(outb))
                {
                    gr.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    gr.Clear(Color.Black);
                    gr.DrawImage(full, 0, 0, ow, oh);
                    ImageCodecInfo enc = null;
                    foreach (ImageCodecInfo c in ImageCodecInfo.GetImageEncoders()) if (c.MimeType == "image/jpeg") enc = c;
                    EncoderParameters ps = new EncoderParameters(1);
                    ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 82L);
                    outb.Save(outJpg, enc, ps);
                }
            }
            return "ok " + ow + "x" + oh;
        }

        static void Rgb24(byte[] s, byte[] d, int w, int h)
        {
            for (int i = 0, j = 0, k = 0; i < w * h; i++, j += 3, k += 4)
            {
                if (j + 2 >= s.Length) break;
                d[k] = s[j + 2]; d[k + 1] = s[j + 1]; d[k + 2] = s[j]; d[k + 3] = 255;
            }
        }
        static void Rgba32(byte[] s, byte[] d, int w, int h)
        {
            for (int i = 0, j = 0; i < w * h; i++, j += 4)
            {
                if (j + 3 >= s.Length) break;
                d[j] = s[j + 2]; d[j + 1] = s[j + 1]; d[j + 2] = s[j]; d[j + 3] = s[j + 3];
            }
        }
        static void Argb32(byte[] s, byte[] d, int w, int h)
        {
            for (int i = 0, j = 0; i < w * h; i++, j += 4)
            {
                if (j + 3 >= s.Length) break;
                d[j] = s[j + 3]; d[j + 1] = s[j + 2]; d[j + 2] = s[j + 1]; d[j + 3] = s[j];
            }
        }

        static void Color565(ushort c, out byte r, out byte g, out byte b)
        {
            r = (byte)(((c >> 11) & 31) * 255 / 31);
            g = (byte)(((c >> 5) & 63) * 255 / 63);
            b = (byte)((c & 31) * 255 / 31);
        }

        static void DecodeColorBlock(byte[] s, int off, byte[] d, int w, int h, int bx, int by, bool bc1Alpha)
        {
            ushort c0 = BitConverter.ToUInt16(s, off);
            ushort c1 = BitConverter.ToUInt16(s, off + 2);
            uint bits = BitConverter.ToUInt32(s, off + 4);
            byte[] r = new byte[4], g = new byte[4], b = new byte[4], a = new byte[4];
            Color565(c0, out r[0], out g[0], out b[0]);
            Color565(c1, out r[1], out g[1], out b[1]);
            a[0] = a[1] = a[2] = a[3] = 255;
            if (c0 > c1 || !bc1Alpha)
            {
                r[2] = (byte)((2 * r[0] + r[1]) / 3); g[2] = (byte)((2 * g[0] + g[1]) / 3); b[2] = (byte)((2 * b[0] + b[1]) / 3);
                r[3] = (byte)((r[0] + 2 * r[1]) / 3); g[3] = (byte)((g[0] + 2 * g[1]) / 3); b[3] = (byte)((b[0] + 2 * b[1]) / 3);
            }
            else
            {
                r[2] = (byte)((r[0] + r[1]) / 2); g[2] = (byte)((g[0] + g[1]) / 2); b[2] = (byte)((b[0] + b[1]) / 2);
                r[3] = 0; g[3] = 0; b[3] = 0; a[3] = 0;
            }
            for (int py = 0; py < 4; py++)
                for (int px = 0; px < 4; px++)
                {
                    int idx = (int)((bits >> (2 * (4 * py + px))) & 3);
                    int x = bx + px, y = by + py;
                    if (x >= w || y >= h) continue;
                    int o = (y * w + x) * 4;
                    d[o] = b[idx]; d[o + 1] = g[idx]; d[o + 2] = r[idx];
                    if (d[o + 3] == 0 && !bc1Alpha) { } // alpha set by caller for BC3
                    if (bc1Alpha) d[o + 3] = a[idx];
                }
        }

        static void Bc1(byte[] s, byte[] d, int w, int h)
        {
            int bw = (w + 3) / 4, bh = (h + 3) / 4;
            for (int by = 0; by < bh; by++)
                for (int bx = 0; bx < bw; bx++)
                {
                    int off = (by * bw + bx) * 8;
                    if (off + 8 > s.Length) return;
                    DecodeColorBlock(s, off, d, w, h, bx * 4, by * 4, true);
                }
        }

        static void Bc3(byte[] s, byte[] d, int w, int h)
        {
            int bw = (w + 3) / 4, bh = (h + 3) / 4;
            for (int by = 0; by < bh; by++)
                for (int bx = 0; bx < bw; bx++)
                {
                    int off = (by * bw + bx) * 16;
                    if (off + 16 > s.Length) return;
                    byte a0 = s[off], a1 = s[off + 1];
                    byte[] at = new byte[8];
                    at[0] = a0; at[1] = a1;
                    if (a0 > a1)
                    {
                        for (int i = 0; i < 6; i++) at[2 + i] = (byte)(((6 - i) * a0 + (1 + i) * a1) / 7);
                    }
                    else
                    {
                        for (int i = 0; i < 4; i++) at[2 + i] = (byte)(((4 - i) * a0 + (1 + i) * a1) / 5);
                        at[6] = 0; at[7] = 255;
                    }
                    ulong abits = 0;
                    for (int i = 0; i < 6; i++) abits |= ((ulong)s[off + 2 + i]) << (8 * i);
                    DecodeColorBlock(s, off + 8, d, w, h, bx * 4, by * 4, false);
                    for (int py = 0; py < 4; py++)
                        for (int px = 0; px < 4; px++)
                        {
                            int x = bx * 4 + px, y = by * 4 + py;
                            if (x >= w || y >= h) continue;
                            int ai = (int)((abits >> (3 * (4 * py + px))) & 7);
                            d[(y * w + x) * 4 + 3] = at[ai];
                        }
                }
        }
    }
}
