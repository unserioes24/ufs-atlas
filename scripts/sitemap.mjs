/**
 * Writes public/sitemap.xml from the guide and the game data.
 *
 * Every view of the guide is a path of its own, so each fishery, species and
 * the bait page get an entry. What needs an account - profiles, groups, the
 * sign-in - stays out: those pages say nothing to a visitor who is not signed
 * in, and a profile belongs to whoever holds the address.
 *
 * Run through `npm run build`; the file lands beside robots.txt.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))

const SITE = process.env.UFS_SITE ?? 'https://ufs-atlas.de'
const guide = read('src/data/guide.json')
const game = read('src/data/gamedata.json')

/** Newest of the two data stamps – that is when the content last changed. */
const stamp = [guide.generated, game.generated].filter(Boolean).sort().pop()

const slug = (key) => key.toLowerCase().replaceAll('_', '-')

const paths = ['/', '/fisheries', '/species', '/baits', '/privacy']
for (const m of guide.maps) {
  if (m.status === 'playable') paths.push('/fisheries/' + m.id)
}
for (const key of Object.keys(game.species)) paths.push('/species/' + slug(key))

const body = paths
  .map(
    (p) =>
      '  <url>\n' +
      `    <loc>${SITE}${p}</loc>\n` +
      (stamp ? `    <lastmod>${stamp}</lastmod>\n` : '') +
      '  </url>',
  )
  .join('\n')

writeFileSync(
  join(root, 'public/sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    '\n</urlset>\n',
)

console.log(`sitemap.xml: ${paths.length} addresses`)
