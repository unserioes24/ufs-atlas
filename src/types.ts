/**
 * Die Form der beiden Datenquellen. Beide entstehen außerhalb des Programms:
 * `guide.json` aus der Community-Recherche, `gamedata.json` aus den
 * Spieldateien über `tools/extract.ps1`. Was hier steht, ist also eine
 * Beschreibung dessen, was dort schon liegt – kein Wunschzettel.
 */

// ------------------------------------------------------------- Spieldaten

/** Ein Punkt der Beißzeitkurve: [Stunde 0–24, Bereitschaft 0–1]. */
export type CurvePoint = [number, number]

export interface Species {
  en?: string
  de?: string
  info?: string
  /** Gewicht in kg, Länge in cm. */
  wMin?: number
  wMax?: number
  lMin?: number
  lMax?: number
  /** Beißbereitschaft über 24 Stunden. */
  act?: CurvePoint[]
  /** Beste Ködervorliebe je Angelart: Fliege, Kunstköder, Naturköder, Boilie. */
  m?: [number, number, number, number]
  /** Faktor je Führung beim Spinnfischen, ohne den Eintrag „keine“. */
  spin?: number[]
  /** Wetterkurven, nur die bespielten. */
  bite?: Partial<Record<'wind' | 'cloudiness' | 'rain', CurvePoint[]>>
}

export interface SpotEntry {
  /** Artenschlüssel. */
  s: string
  /** Fische an diesem Spot. */
  f: number
  /** Entfernung in Metern. */
  d: number
}

export interface Spot {
  n: number
  /** Lage auf dem Kartenbild, 0–1. Fehlt bei Offshore-Revieren. */
  u?: number
  v?: number
  /** Lage in der Spielwelt. */
  wx?: number
  wz?: number
  fish: SpotEntry[]
}

export interface FisherySpecies {
  s: string
  points: number
  fish: number
  spots: number[]
  /** Arten aus dem New-Fish-Species-DLC haben keine festen Spawnpunkte. */
  dlc?: boolean
}

/** Ein Schwarmpunkt auf der Karte: [Artenschlüssel, u, v]. */
export type Dot = [string, number, number]

export interface Fishery {
  level: number
  /** Bild des Kartenbretts. Offshore-Reviere zeigen keins. */
  map: string | null
  mapW: number
  mapH: number
  save: string
  /** Ließ sich die Spielwelt auf das Kartenbild abbilden? */
  fitOk: boolean
  spots: Spot[]
  species: FisherySpecies[]
  dots: Dot[]
}

export interface Bait {
  en: string
  de: string
  kind: BaitKind
  /** „Index:Prozent“ über die Liste `baitSpecies`. */
  i: string
}

export type BaitKind = 'natural' | 'boilie' | 'fly' | 'lure'

/** Vector2 aus den Spieldaten: [von, bis]. */
export type Range = [number, number]

export interface Hooks {
  steps: number
  label: string[]
  /** Spaltbreite in Metern. */
  gap: number[]
  /** Ködergröße gegen Fischlänge in Metern. */
  baitLength: Range[]
  /** Fischgewicht in kg je Stufe. */
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

export interface GameData {
  generated: string
  source: string
  species: Record<string, Species>
  fisheries: Record<string, Fishery>
  glossary: Glossary
  baitSpecies: string[]
  baits: Record<string, Bait>
  hooks: Hooks | null
}

// ----------------------------------------------------------- Guide-Daten

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
 * Eine Quelle der Recherche. Titel und Adresse stehen so, wie die Seite selbst
 * heißt. Die Notiz gibt es zweisprachig, die Kategorie als Wörterbuchschlüssel –
 * beides wird im Guide gepflegt, nicht im Programm.
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

// ------------------------------------------------- Eigener Stand im Browser

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
  /** Zeitpunkt der letzten eigenen Änderung, für den Abgleich mit dem Server. */
  updatedAt: string | null
}

/**
 * Was ein Spielstand-Import im Browser hinterlässt. Die Formen kommen
 * unverändert aus dem Parser; die Statistikseite liest sie so, wie sie sind.
 */
export interface SaveStats {
  player: import('./lib/savegame').PlayerInfo | null
  fisheries: Record<string, import('./lib/savegame').FisheryStats>
  bests: Record<string, BestCatch>
  total: number
}
