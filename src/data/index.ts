import gamedataRaw from './gamedata.json'
import guideRaw from './guide.json'
import type { Bait, BaitKind, GameData, GuideData, Hooks, Species } from '../types'

/**
 * Access to the two data sources. Anything that can be worked out once is built
 * here at load time: the name indexes, the reverse bait view and the size
 * steps. Pages receive ready-made structures.
 */

export const GAME = gamedataRaw as unknown as GameData
export const GUIDE = guideRaw as unknown as GuideData

export const SPECIES = GAME.species
export const FISHERIES = GAME.fisheries
export const HOOKS: Hooks | null = GAME.hooks

/** Lower-case the string and strip anything that is not a letter or a digit. */
export function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// -------------------------------------------------------------- Species names

const enIndex: Record<string, string> = {}
const deIndex: Record<string, string> = {}
for (const [key, s] of Object.entries(SPECIES)) {
  if (s.en && !enIndex[norm(s.en)]) enIndex[norm(s.en)] = key
  if (s.de && !deIndex[norm(s.de)]) deIndex[norm(s.de)] = key
}

/** The guide calls a few species by a different name than the game does. */
const NAME_ALIAS: Record<string, string> = {
  apapa: 'APAPA', // "Apapá" in the game
  grayling: 'WHITE_GRAYLING', // Baikal, "White Grayling" in the game
  commonbleak: 'BLEAK',
  longfineel: 'LONGFIN_EEL', // "New Zealand longfin eel" in the game
  redlionfish: 'COMMON_LIONFISH',
  graysnapper: 'GREY_SNAPER', // the game's own spelling
}

/** Species that appear twice in the game data – one per fishery generation. */
const EQUIV: string[][] = [
  ['GREAT_BARRACUDA', 'BARRACUDA'],
  ['GRAY_SNAPPER_C', 'GREY_SNAPER'],
  ['GIANT_GROUPER', 'GIANT_GROUPER_D'],
  ['BLACKTIP_REEF_SHARK', 'BLACKTIP_SHARK_D'],
]

/** Map a guide entry to the species key used by the game data. */
export function speciesKey(name: string, de: string, mapId?: string): string | null {
  const key =
    NAME_ALIAS[norm(name)] ??
    NAME_ALIAS[norm(de)] ??
    enIndex[norm(name)] ??
    deIndex[norm(de)] ??
    enIndex[norm(de)] ??
    deIndex[norm(name)] ??
    null
  if (!key || !mapId) return key

  // If the key matches nothing in this fishery, fall back to its twin species.
  const fy = FISHERIES[mapId]
  if (!fy) return key
  const here = new Set(fy.species.map((g) => g.s))
  if (here.has(key)) return key
  for (const pair of EQUIV) {
    if (!pair.includes(key)) continue
    for (const cand of pair) if (here.has(cand)) return cand
  }
  return key
}

export function speciesName(key: string, lang: string): string {
  const s: Species | undefined = SPECIES[key]
  if (!s) return key
  return (lang === 'en' ? s.en : s.de) || s.en || s.de || key
}

// -------------------------------------------------------------------- Baits

export interface BaitEntry {
  key: string
  en: string
  de: string
  kind: BaitKind
  /** Lure type out of the Bait component: SPINNER, SPOON, WOBBLER, SOFT_BAIT, FLY. */
  type?: string
  /** Fly type, flies only. */
  fly?: string
  /** The game files carry no interest table for this bait. */
  noTable?: boolean
  /** Interest per species key, 0–1. */
  fish: Record<string, number>
}

const BAIT_SPECIES = GAME.baitSpecies ?? []

export const BAITS: Record<string, BaitEntry> = {}
for (const [key, b] of Object.entries((GAME.baits ?? {}) as Record<string, Bait>)) {
  const fish: Record<string, number> = {}
  for (const pair of String(b.i ?? '').split(',')) {
    if (!pair) continue
    const [idx, pct] = pair.split(':')
    const species = BAIT_SPECIES[Number(idx)]
    if (species) fish[species] = Number(pct) / 100
  }
  BAITS[key] = {
    key,
    en: b.en,
    de: b.de,
    kind: b.kind,
    ...(b.type ? { type: b.type } : {}),
    ...(b.fly ? { fly: b.fly } : {}),
    ...(b.noTable ? { noTable: true } : {}),
    fish,
  }
}

export interface BaitForSpecies {
  bait: BaitEntry
  v: number
}

/** The reverse view: which baits work for a species, best first. */
export const BAITS_FOR: Record<string, BaitForSpecies[]> = {}
for (const bait of Object.values(BAITS)) {
  for (const [species, v] of Object.entries(bait.fish)) {
    ;(BAITS_FOR[species] ??= []).push({ bait, v })
  }
}
for (const list of Object.values(BAITS_FOR)) {
  list.sort((a, b) => b.v - a.v || a.bait.de.localeCompare(b.bait.de))
}

export function baitName(b: BaitEntry, lang: string): string {
  return (lang === 'en' ? b.en : b.de) || b.en || b.key
}
