/**
 * The shape a profile has once it comes back from the server, plus the tables
 * the profile pages are built from.
 *
 * The figures are what a save-file import wrote into the account. Everything
 * here is read-only for the browser; nothing is derived that the server did not
 * already agree with.
 */
import { FISHERIES, GUIDE } from '../data'
import { DASH, fmtNum, fmtTime } from './format'
import type { Key } from '../i18n'
import type { RodSet, SkillState } from './savegame'

export interface SpeciesRecord {
  count: number
  best: number
  length: number
  sum: number
  fishery?: string | null
}

export interface ProfileTotals {
  fish: number
  bites: number
  weight: number
  time: number
}

export interface PublicProfile {
  anglerName?: string | null
  version?: string | null
  updatedAt: string
  level: number
  score: number
  exp: number
  money: number
  luck: number
  strength: number
  speciesCount: number
  fisheriesComplete: number
  totals: ProfileTotals
  biggest: {
    weight: number
    weightSpecies?: string | null
    length: number
    lengthSpecies?: string | null
  }
  topSpecies: { weight: number; key?: string | null }
  species: Record<string, SpeciesRecord>
  fisheries: Record<string, FisheryRecord>
  owned?: Record<string, number>
  /** Rod sets, skills: what the save file carried. Older profiles have none. */
  sets?: RodSet[]
  skills?: SkillState[]
  skillPoints?: number
}

export interface FisheryRecord {
  fish: number
  bites: number
  weight: number
  time: number
  score: number
  bigW: number
  bigL: number
}

export interface ProfileGroup {
  id: number
  name: string
  members: number
  owner: boolean
  ownerName: string
}

export interface ProfileResponse {
  user: { id: number; name: string }
  self: boolean
  following: boolean
  followers: number
  follows: number
  groups?: ProfileGroup[]
  profile: PublicProfile | null
  me?: { user: { name: string }; profile: PublicProfile | null } | null
  meta: { totalSpecies: number; totalFisheries: number }
}

/** The address a profile is reachable under – the part worth passing on. */
export function profileUrl(name: string): string {
  return location.origin + location.pathname + '#angler/' + encodeURIComponent(name)
}

const kg1 = (v: number) => fmtNum(v, 1) + ' kg'
const kg2 = (v: number) => (v ? v.toFixed(2) + ' kg' : DASH)
const plain = (v: number) => fmtNum(v)
const cm = (v: number) => (v ? Math.round(v * 100) + ' cm' : DASH)

export interface DuelRow {
  /** Dictionary key of the row label. */
  label: Key
  value: (p: PublicProfile) => number
  format: (v: number) => string
  /** Dictionary key of the explanation, empty when there is none. */
  hint: Key | ''
}

/**
 * The figures the comparison puts side by side, row by row. The explanation
 * matters for the derived ones – without it "points per hour" is a riddle.
 */
export const DUEL_GROUPS: Array<{ label: Key; rows: DuelRow[] }> = [
  {
    label: 'duel.progress',
    rows: [
      { label: 'duel.speciesCaught', value: (p) => p.speciesCount, format: plain, hint: '' },
      {
        label: 'stats.fisheriesComplete',
        value: (p) => p.fisheriesComplete,
        format: plain,
        hint: 'overview.completeSub',
      },
      {
        label: 'duel.fisheriesVisited',
        value: (p) => Object.keys(p.fisheries || {}).length,
        format: plain,
        hint: 'duel.atLeastOneBite',
      },
      { label: 'stats.level', value: (p) => p.level, format: plain, hint: '' },
      { label: 'stats.points', value: (p) => p.score, format: plain, hint: '' },
    ],
  },
  {
    label: 'duel.yield',
    rows: [
      { label: 'stats.catches', value: (p) => p.totals.fish, format: plain, hint: '' },
      { label: 'stats.bites', value: (p) => p.totals.bites, format: plain, hint: '' },
      { label: 'stats.totalWeight', value: (p) => p.totals.weight, format: kg1, hint: '' },
      { label: 'stats.time', value: (p) => p.totals.time, format: fmtTime, hint: '' },
    ],
  },
  {
    label: 'duel.records',
    rows: [
      { label: 'duel.heaviestFish', value: (p) => p.biggest.weight, format: kg2, hint: '' },
      { label: 'duel.longestFish', value: (p) => p.biggest.length, format: cm, hint: '' },
      {
        label: 'duel.weightOneSpecies',
        value: (p) => p.topSpecies.weight,
        format: kg1,
        hint: 'duel.sumStrongest',
      },
    ],
  },
  {
    label: 'duel.efficiency',
    rows: [
      {
        label: 'duel.bitesUsed',
        value: (p) => (p.totals.bites ? (p.totals.fish / p.totals.bites) * 100 : 0),
        format: (v) => fmtNum(v, 1) + ' %',
        hint: 'duel.catchesPerBite',
      },
      {
        label: 'duel.catchesPerHour',
        value: (p) => (p.totals.time ? p.totals.fish / (p.totals.time / 3600) : 0),
        format: (v) => fmtNum(v, 1),
        hint: '',
      },
      {
        label: 'duel.weightPerCatch',
        value: (p) => (p.totals.fish ? p.totals.weight / p.totals.fish : 0),
        format: kg2,
        hint: '',
      },
      {
        label: 'duel.pointsPerHour',
        value: (p) => (p.totals.time ? p.score / (p.totals.time / 3600) : 0),
        format: (v) => fmtNum(v, 0),
        hint: '',
      },
    ],
  },
]

export type DuelFilter = 'alle' | 'diff' | 'both' | 'his' | 'mine' | 'lead' | 'behind'

export const DUEL_FILTERS: Array<{ key: DuelFilter; label: Key }> = [
  { key: 'alle', label: 'duel.filterAll' },
  { key: 'diff', label: 'duel.filterDiff' },
  { key: 'both', label: 'duel.filterBoth' },
  { key: 'his', label: 'duel.filterHis' },
  { key: 'mine', label: 'duel.filterMine' },
  { key: 'lead', label: 'duel.filterLead' },
  { key: 'behind', label: 'duel.filterBehind' },
]

export interface FisheryProgress {
  id: string
  name: string
  water: string
  total: number
  done: number
  missing: string[]
  fish: number
  bites: number
  weight: number
  time: number
  score: number
  bigW: number
  bigL: number
}

/**
 * Progress per fishery, derived from a profile. The species list of a fishery
 * comes from the game files; caught is whatever turns up in the profile.
 */
export function fisheryStats(p: PublicProfile): FisheryProgress[] {
  return Object.keys(FISHERIES).map((id) => {
    const m = GUIDE.maps.find((x) => x.id === id)
    const keys = FISHERIES[id]!.species.map((g) => g.s)
    const st = p.fisheries?.[id] ?? null
    return {
      id,
      name: m ? m.name : id,
      water: m ? m.water : '',
      total: keys.length,
      done: keys.filter((k) => p.species[k]).length,
      missing: keys.filter((k) => !p.species[k]),
      fish: st ? st.fish : 0,
      bites: st ? st.bites : 0,
      weight: st ? st.weight : 0,
      time: st ? st.time : 0,
      score: st ? st.score : 0,
      bigW: st ? st.bigW : 0,
      bigL: st ? st.bigL : 0,
    }
  })
}

/** One value in the comparison: wins, loses, or level. */
export function duelClass(a: number | null | undefined, b: number | null | undefined): string {
  if ((a || 0) === (b || 0)) return ''
  return (a || 0) > (b || 0) ? 'win' : 'lose'
}
