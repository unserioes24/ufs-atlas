import { readFileSync, writeFileSync } from 'node:fs'

/**
 * Vite always writes `<script type="module">` into the HTML, even when the
 * bundle itself is a classic script. Browsers refuse module scripts over
 * file://, so the offline build gets a plain `<script defer>` instead.
 */
const file = 'dist-offline/index.html'
const before = readFileSync(file, 'utf8')

const after = before
  .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, '<script defer src="$1"></script>')
  .replace(/ crossorigin(?=[ >])/g, '')

if (after === before) {
  console.error('offline-html: nothing to rewrite — did the Vite output change?')
  process.exit(1)
}

writeFileSync(file, after)
console.log('offline-html: script tag rewritten for file:// use')
