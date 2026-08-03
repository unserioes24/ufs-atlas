import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The guide is a single page without server rendering. What ships is the result
 * in `dist/`; in production it lands in the same directory as the API, so the
 * paths stay relative to the root.
 *
 * The game data is large and rarely changes. It goes into bundles of its own, so
 * a code change does not send the whole block over the wire again.
 */

/** The version from package.json, so the footer can name the release. */
export const VERSION = String(
  (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version?: string
  }).version ?? '0.0.0',
)

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
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
