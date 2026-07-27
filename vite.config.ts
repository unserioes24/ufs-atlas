import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Der Guide ist eine einzelne Seite ohne Server-Rendering. Ausgeliefert wird
 * das Ergebnis aus `dist/`; im Betrieb landet es im selben Verzeichnis wie die
 * API, deshalb bleiben die Pfade relativ zum Wurzelverzeichnis.
 *
 * Die Spieldaten sind groß und ändern sich selten. Sie kommen deshalb in
 * eigene Bündel, damit ein Codewechsel nicht den ganzen Datenblock erneut
 * über die Leitung schickt.
 */
export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so dist/index.html also opens straight from disk
  // with file:// — without a server the guide still works, only accounts and
  // groups are missing.
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/data/gamedata.json')) return 'gamedata'
          if (id.includes('/src/data/guide.json')) return 'guide'
          if (id.includes('node_modules/react')) return 'react'
          return undefined
        },
      },
    },
  },
  server: {
    port: 5173,
    // Im Entwicklungsbetrieb zeigt die Oberfläche auf die laufende API.
    proxy: {
      '/api': {
        target: process.env.UFS_API ?? 'https://ufs-atlas.de',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
