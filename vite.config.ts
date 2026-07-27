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
  // Absolute asset paths. Every view is a path of its own (/fisheries/moraine),
  // and a relative path would send the browser looking for the bundle inside
  // that folder. The offline build in vite.config.offline.ts keeps them
  // relative — there the page only ever sits at one level.
  base: '/',
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
