/**
 * The shape of the two data sources. Both are produced outside the program:
 * `guide.json` from the community research, `gamedata.json` from the game
 * files via `tools/extract.ps1`. What is described here reflects what those
 * files already hold – it is not a wish list.
 */

// ------------------------------------------------------------- Game data

/** A point on the bite curve: [hour 0–24, readiness 0–1]. */
export type CurvePoint = [number, number]

export interface Species {
  en?: string
  de?: string
  info?: string
  /** Weight in kg, length in cm. */
  wMin?: number
  wMax?: number
  lMin?: number
  lMax?: number
  /** Readiness to bite across 24 hours. */
  act?: CurvePoint[]
  /** Best bait preference per method: fly, lure, natural bait, boilie. */
  m?: [number, number, number, number]
  /** Factor per retrieve when spin fishing, excluding the "none" entry. */
  spin?: number[]
  /** Weather curves, only the ones the game actually uses. */
  bite?: Partial<Record<'wind' | 'cloudiness' | 'rain', CurvePoint[]>>
}

export interface SpotEntry {
  /** Species key. */
  s: string
  /** Fish at this spot. */
  f: number
  /** Distance in metres. */
  d: number
}

export interface Spot {
  n: number
  /** Position on the map image, 0–1. Missing for offshore fisheries. */
  u?: number
  v?: number
  /** Position in the game world. */
  wx?: number
  wz?: number
  fish: SpotEntry[]
}

export interface FisherySpecies {
  s: string
  points: number
  fish: number
  spots: number[]
  /** Species from the New Fish Species DLC have no fixed spawn points. */
  dlc?: boolean
}

/** A shoal marker on the map: [species key, u, v]. */
export type Dot = [string, number, number]

export interface Fishery {
  level: number
  /** Image of the map board. Offshore fisheries show none. */
  map: string | null
  mapW: number
  mapH: number
  save: string
  /** Could the game world be mapped onto the map image? */
  fitOk: boolean
  spots: Spot[]
  species: FisherySpecies[]
  dots: Dot[]
}

export interface Bait {
  en: string
  de: string
  kind: BaitKind
  /** "index:percent" into the `baitSpecies` list. */
  i: string
}

export type BaitKind = 'natural' | 'boilie' | 'fly' | 'lure'

/** Vector2 from the game data: [from, to]. */
export type Range = [number, number]

export interface Hooks {
  steps: number
  label: string[]
  /** Gap width in metres. */
  gap: number[]
  /** Bait size relative to fish length, in metres. */
  baitLength: Range[]
  /** Fish weight in kg per step. */
  hook: Range[]
  lure: Range[]
  fly: Range[]
}

export interface GlossaryItem {
  en: string
  de: string
  key: string
}

export interface GlossaryCategory {
  key: string
  title: string
  note: string
  items: GlossaryItem[]
}

export interface Glossary {
  bait: Record<string, string>
  lure: Record<string, string>
  method: Record<string, string>
  categories: GlossaryCategory[]
}

/**
 * A skill of the tree, named the way the game names it. How many steps it has
 * is not in here: the localisation names only the first step of several of
 * them, so the save file is what the count comes from.
 */
export interface SkillInfo {
  key: string
  en: string
  de: string
  descEn: string
  descDe: string
}

export interface GameData {
  generated: string
  source: string
  species: Record<string, Species>
  fisheries: Record<string, Fishery>
  glossary: Glossary
  baitSpecies: string[]
  baits: Record<string, Bait>
  hooks: Hooks | null
  skills: SkillInfo[]
}

// ----------------------------------------------------------- Guide data

export interface GuideMap {
  id: string
  name: string
  group: string
  region: string
  water: string
  style: string
  summary: string
  sources: string[]
  accent: string
  variant: string | null
  status: 'playable' | 'announced'
}

export interface GuideFish {
  id: string
  mapId: string
  name: string
  de: string
  spots: string
  hook: string
  bait: string
  groundbait: string
  depth: string
  method: string
  retrieve: string
  time: string
  notes: string
  confidence: 'hoch' | 'mittel' | 'niedrig'
  sources: string[]
  dlc: string | null
  tags: string[]
}

/**
 * One source behind the research. Title and address are given exactly as the
 * page itself states them. The note comes in both languages, the category as a
 * dictionary key – both are maintained in the guide, not in the program.
 */
export interface SourceEntry {
  title: string
  url?: string
  note?: string
  noteEn?: string
  type?: string
  typeKey?: string
}

export interface GuideData {
  maps: GuideMap[]
  fish: GuideFish[]
  sources: Record<string, SourceEntry>
  generated: string
  scope: string
}

// --------------------------------------------- Your own state in the browser

export interface BestCatch {
  count: number
  weight: number
  length: number
  sum: number
  fishery?: string | null
}

export interface LocalState {
  caught: Record<string, boolean>
  bests: Record<string, BestCatch>
  stats: SaveStats | null
  /** When you last changed something; used when comparing against the server. */
  updatedAt: string | null
}

/**
 * What a save-file import leaves behind in the browser. The shapes come
 * straight from the parser; the statistics page reads them as they are.
 */
export interface SaveStats {
  player: import('./lib/savegame').PlayerInfo | null
  fisheries: Record<string, import('./lib/savegame').FisheryStats>
  bests: Record<string, BestCatch>
  total: number
}
