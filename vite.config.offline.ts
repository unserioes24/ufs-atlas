import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * A build that opens straight from disk.
 *
 * Browsers refuse `<script type="module">` over file://, so this variant emits
 * one classic script instead of ES modules. Everything else is the same, only
 * bigger: no code splitting, no shared chunks.
 *
 * Used for `npm run build:offline`, which lands in dist-offline/. Accounts and
 * groups need the server and stay hidden there.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-offline',
    sourcemap: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/ufs-atlas.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
