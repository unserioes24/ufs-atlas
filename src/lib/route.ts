/**
 * The address bar is the state: #koeder, #arten/<key>, #revier/<id>/spot3,
 * #angler/<name>/<tab>, #gruppen/<id>, #statistik, #start.
 *
 * Two directions have to be kept apart. Reading happens on hashchange, so the
 * browser's back button lands where you expect. Writing happens whenever the
 * view changes: the first write only replaces, otherwise opening the page would
 * already leave a second entry in the history.
 */
import { GUIDE } from '../data'

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

/**
 * Read the hash. `apiAvailable` decides what an empty address means: the start
 * page introduces the service, and without a server there is nothing to
 * introduce – then the guide opens on the fisheries.
 */
export function parseHash(hash: string, apiAvailable: boolean): Route {
  const parts = decodeURIComponent((hash || '').replace(/^#/, '')).split('/')
  const head = (parts[0] || '').toLowerCase()

  if ((head === 'start' || head === '') && apiAvailable) return { view: 'start' }
  if (head === 'koeder') return { view: 'bait' }
  if (head === 'angler' && parts[1]) {
    return { view: 'angler', angler: parts[1], anglerTab: parts[2] || 'uebersicht' }
  }
  if (head === 'gruppen') {
    return { view: 'gruppen', groupId: parts[1] ? Number(parts[1]) : null }
  }
  if (head === 'anmelden') return { view: 'anmelden' }
  if (head === 'statistik') return { view: 'stats', statsTab: parts[1] || 'reviere' }
  if (head === 'arten') {
    return { view: 'arten', species: parts[1] ? parts[1].toUpperCase() : null }
  }
  if (head === 'gesamt') return { view: 'map', map: '__all__' }
  if (head === 'revier' && parts[1]) {
    const m = GUIDE.maps.find((x) => x.id === parts[1])
    if (m) {
      const sp = /^spot(\d+)$/i.exec(parts[2] || '')
      return { view: 'map', map: m.id, spot: sp ? parseInt(sp[1]!, 10) : null }
    }
  }
  return { view: 'map' }
}

/** Build the hash a state should be reachable under. */
export function buildHash(r: Route): string {
  switch (r.view) {
    case 'start':
      return '#start'
    case 'bait':
      return '#koeder'
    case 'angler':
      return r.angler
        ? '#angler/' +
            encodeURIComponent(r.angler) +
            (r.anglerTab && r.anglerTab !== 'uebersicht' ? '/' + r.anglerTab : '')
        : '#angler'
    case 'gruppen':
      return '#gruppen' + (r.groupId ? '/' + r.groupId : '')
    case 'anmelden':
      return '#anmelden'
    case 'stats':
      return '#statistik'
    case 'arten':
      return '#arten' + (r.species ? '/' + r.species : '')
    default:
      return r.map === '__all__'
        ? '#gesamt'
        : '#revier/' + (r.map ?? '') + (r.spot ? '/spot' + r.spot : '')
  }
}
