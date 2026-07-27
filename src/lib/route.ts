/**
 * The address bar is the state. Every view is a path of its own, so it can be
 * indexed, linked and bookmarked:
 *
 *   /                        the start page
 *   /fisheries               all fisheries at a glance
 *   /fisheries/moraine       one fishery
 *   /fisheries/moraine/spot-3
 *   /species                 the species list
 *   /species/brown-trout     one species
 *   /baits  /stats  /groups  /groups/12  /anglers/<name>  /anglers/<name>/records
 *
 * Addresses are English and lower case with hyphens, whatever language the
 * interface is showing – an address is not interface text, and one that changes
 * under the reader is a broken bookmark.
 *
 * The older German addresses and the hash form both still parse, and the first
 * render rewrites them to the canonical path. Opened straight from disk there
 * is no server to route paths, so there the hash stays.
 *
 * Reading happens on popstate and hashchange, so the back button lands where
 * you expect. Writing happens whenever the view changes: the first write only
 * replaces, otherwise opening the page would already leave a second entry.
 */
import { GUIDE, SPECIES } from '../data'

export type View =
  | 'start'
  | 'map'
  | 'bait'
  | 'arten'
  | 'stats'
  | 'angler'
  | 'gruppen'
  | 'anmelden'

export interface Route {
  view: View
  map?: string
  spot?: number | null
  species?: string | null
  angler?: string
  anglerTab?: string
  groupId?: number | null
  statsTab?: string
}

/** Paths only work where a server can route them back to index.html. */
export const USE_PATHS = location.protocol === 'http:' || location.protocol === 'https:'

/** First segment of an address -> view. The German forms are the old ones. */
const HEADS: Record<string, View> = {
  '': 'start',
  start: 'start',
  fisheries: 'map',
  revier: 'map',
  gesamt: 'map',
  species: 'arten',
  arten: 'arten',
  baits: 'bait',
  koeder: 'bait',
  stats: 'stats',
  statistik: 'stats',
  anglers: 'angler',
  angler: 'angler',
  groups: 'gruppen',
  gruppen: 'gruppen',
  'sign-in': 'anmelden',
  anmelden: 'anmelden',
}

/** The tabs of a profile, in the address and in the state. */
const PROFILE_TABS: Record<string, string> = {
  overview: 'uebersicht',
  fisheries: 'reviere',
  records: 'arten',
  missing: 'offen',
  compare: 'vergleich',
  followers: 'follower',
  groups: 'gruppen',
  settings: 'konto',
}
const PROFILE_TAB_PATHS = Object.fromEntries(
  Object.entries(PROFILE_TABS).map(([path, tab]) => [tab, path]),
)

/** BROWN_TROUT <-> brown-trout. The key stays the truth, the slug is the face. */
export function speciesSlug(key: string): string {
  return key.toLowerCase().replace(/_/g, '-')
}
const SLUG_TO_KEY = new Map(Object.keys(SPECIES).map((k) => [speciesSlug(k), k]))

function keyFromSlug(slug: string): string | null {
  const s = slug.toLowerCase()
  return SLUG_TO_KEY.get(s) ?? SLUG_TO_KEY.get(s.replace(/_/g, '-')) ?? null
}

/**
 * Turn the segments of an address into a route. `apiAvailable` decides what an
 * empty address means: the start page introduces the service, and without a
 * server there is nothing to introduce – then the guide opens on the fisheries.
 */
export function parseSegments(parts: string[], apiAvailable: boolean): Route {
  const head = (parts[0] || '').toLowerCase()
  const view = HEADS[head]

  if (view === 'start') return apiAvailable ? { view: 'start' } : { view: 'map' }
  if (view === 'bait') return { view: 'bait' }
  if (view === 'anmelden') return { view: 'anmelden' }
  if (view === 'stats') return { view: 'stats', statsTab: parts[1] || 'reviere' }

  if (view === 'angler' && parts[1]) {
    const tab = (parts[2] || '').toLowerCase()
    return {
      view: 'angler',
      angler: parts[1],
      anglerTab: PROFILE_TABS[tab] ?? (tab || 'uebersicht'),
    }
  }
  if (view === 'gruppen') {
    return { view: 'gruppen', groupId: parts[1] ? Number(parts[1]) : null }
  }
  if (view === 'arten') {
    const raw = parts[1]
    return { view: 'arten', species: raw ? (keyFromSlug(raw) ?? raw.toUpperCase()) : null }
  }
  if (view === 'map') {
    // /gesamt was the old address of the overview; /fisheries is the new one.
    if (head === 'gesamt' || !parts[1]) return { view: 'map', map: '__all__' }
    const m = GUIDE.maps.find((x) => x.id === parts[1])
    if (m) {
      const sp = /^spot-?(\d+)$/i.exec(parts[2] || '')
      return { view: 'map', map: m.id, spot: sp ? parseInt(sp[1]!, 10) : null }
    }
    return { view: 'map', map: '__all__' }
  }
  // Anything unknown: the overview rather than a blank page.
  return { view: 'map', map: '__all__' }
}

/**
 * Read the current address. A hash wins when there is one – old bookmarks and
 * links from before the switch still have to land right.
 */
export function parseLocation(apiAvailable: boolean): Route {
  const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''))
  if (hash) return parseSegments(hash.split('/'), apiAvailable)
  const path = decodeURIComponent(location.pathname).replace(/^\/+|\/+$/g, '')
  return parseSegments(path ? path.split('/') : [''], apiAvailable)
}

/** The canonical segments of a state, without any separator. */
export function routeSegments(r: Route): string[] {
  switch (r.view) {
    case 'start':
      return []
    case 'bait':
      return ['baits']
    case 'angler': {
      if (!r.angler) return ['anglers']
      const tab = PROFILE_TAB_PATHS[r.anglerTab ?? 'uebersicht']
      return ['anglers', encodeURIComponent(r.angler)].concat(
        tab && tab !== 'overview' ? [tab] : [],
      )
    }
    case 'gruppen':
      return ['groups'].concat(r.groupId ? [String(r.groupId)] : [])
    case 'anmelden':
      return ['sign-in']
    case 'stats':
      return ['stats']
    case 'arten':
      return ['species'].concat(r.species ? [speciesSlug(r.species)] : [])
    default:
      return r.map === '__all__'
        ? ['fisheries']
        : ['fisheries', r.map ?? ''].concat(r.spot ? ['spot-' + r.spot] : [])
  }
}

/** The address to write: a path where a server routes, a hash where none does. */
export function buildAddress(r: Route): string {
  const segments = routeSegments(r).filter(Boolean).join('/')
  if (!USE_PATHS) return '#' + segments
  return '/' + segments
}

/** Is the browser already showing this address? */
export function isCurrent(address: string): boolean {
  if (!USE_PATHS) return location.hash === address
  const here = location.pathname.replace(/\/+$/, '') || '/'
  const there = address.replace(/\/+$/, '') || '/'
  return here === there && !location.hash
}
