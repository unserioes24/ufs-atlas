/**
 * Checks the address table: every address has to land in the right view, and
 * every state has to come back out as its canonical address.
 *
 * Reading and writing are plain functions, so this needs no browser. Only
 * `location` has to exist before src/lib/route.ts is loaded.
 *
 *   node scripts/route-check.mjs
 */
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

globalThis.location = { protocol: 'https:', pathname: '/', hash: '' }

const out = join(mkdtempSync(join(tmpdir(), 'ufs-route-')), 'route.mjs')
await build({
  entryPoints: [join(root, 'src/lib/route.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: out,
  loader: { '.json': 'json' },
  logLevel: 'error',
})
const route = await import(pathToFileURL(out).href)

/** [address, expected canonical address, expected view] */
const CASES = [
  ['/', '/', 'start'],
  ['/fisheries', '/fisheries', 'map'],
  ['/fisheries/moraine', '/fisheries/moraine', 'map'],
  ['/fisheries/moraine/spot-3', '/fisheries/moraine/spot-3', 'map'],
  ['/species', '/species', 'arten'],
  ['/species/pike', '/species/pike', 'arten'],
  ['/species/brown-trout', '/species/brown-trout', 'arten'],
  ['/baits', '/baits', 'bait'],
  ['/stats', '/stats', 'stats'],
  ['/groups', '/groups', 'gruppen'],
  ['/groups/12', '/groups/12', 'gruppen'],
  ['/sign-in', '/sign-in', 'anmelden'],
  ['/anglers/Kai', '/anglers/Kai', 'angler'],
  ['/anglers/Kai/compare', '/anglers/Kai/compare', 'angler'],
  ['/anglers/Kai/records', '/anglers/Kai/records', 'angler'],
  // the old German addresses have to rewrite to the new ones
  ['/revier/moraine', '/fisheries/moraine', 'map'],
  ['/revier/moraine/spot3', '/fisheries/moraine/spot-3', 'map'],
  ['/koeder', '/baits', 'bait'],
  ['/arten', '/species', 'arten'],
  ['/arten/PIKE', '/species/pike', 'arten'],
  ['/gesamt', '/fisheries', 'map'],
  ['/statistik', '/stats', 'stats'],
  ['/gruppen/12', '/groups/12', 'gruppen'],
  ['/anmelden', '/sign-in', 'anmelden'],
  ['/start', '/', 'start'],
  ['/angler/Kai/vergleich', '/anglers/Kai/compare', 'angler'],
  // anything unknown falls back to the overview instead of a blank page
  ['/does-not-exist', '/fisheries', 'map'],
  ['/fisheries/nope', '/fisheries', 'map'],
]

let bad = 0
for (const [from, want, wantView] of CASES) {
  const parts = from.replace(/^\/+|\/+$/g, '')
  const r = route.parseSegments(parts ? parts.split('/') : [''], true)
  const got = '/' + route.routeSegments(r).filter(Boolean).join('/')
  const ok = got === want && r.view === wantView
  if (!ok) bad++
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${from.padEnd(28)} -> ${got.padEnd(28)} ${r.view}` +
      (ok ? '' : `   want ${want} / ${wantView}`),
  )
}

// Without an API the start page has nothing to introduce.
const offline = route.parseSegments([''], false)
const offlineOk = offline.view === 'map'
if (!offlineOk) bad++
console.log(`${offlineOk ? 'ok  ' : 'FAIL'} empty address without API   -> ${offline.view}`)

rmSync(dirname(out), { recursive: true, force: true })
console.log(bad ? `\n${bad} of ${CASES.length + 1} failed` : `\nall ${CASES.length + 1} ok`)
process.exit(bad ? 1 : 0)
