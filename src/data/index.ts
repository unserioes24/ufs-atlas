import gamedataRaw from './gamedata.json'
import guideRaw from './guide.json'
import type { Bait, BaitKind, GameData, GuideData, Hooks, Species } from '../types'

/**
 * Zugriff auf die beiden Datenquellen. Alles, was einmal berechnet werden kann,
 * entsteht hier beim Laden: Namensverzeichnisse, die umgekehrte Ködersicht und
 * die Größenstufen. Die Seiten bekommen fertige Strukturen.
 */

export const GAME = gamedataRaw as unknown as GameData
export const GUIDE = guideRaw as unknown as GuideData

export const SPECIES = GAME.species
export const FISHERIES = GAME.fisheries
export const HOOKS: Hooks | null = GAME.hooks

/** Kleinschreiben und alles wegwerfen, was nicht Buchstabe oder Ziffer ist. */
export function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// --------------------------------------------------------------- Artennamen

const enIndex: Record<string, string> = {}
const deIndex: Record<string, string> = {}
for (const [key, s] of Object.entries(SPECIES)) {
  if (s.en && !enIndex[norm(s.en)]) enIndex[norm(s.en)] = key
  if (s.de && !deIndex[norm(s.de)]) deIndex[norm(s.de)] = key
}

/** Der Guide nennt einige Arten anders als das Spiel. */
const NAME_ALIAS: Record<string, string> = {
  apapa: 'APAPA', // im Spiel „Apapá“
  grayling: 'WHITE_GRAYLING', // Baikal, im Spiel „White Grayling“
  commonbleak: 'BLEAK',
  longfineel: 'LONGFIN_EEL', // im Spiel „New Zealand longfin eel“
  redlionfish: 'COMMON_LIONFISH',
  graysnapper: 'GREY_SNAPER', // Schreibweise des Spiels
}

/** Arten, die doppelt in den Spieldaten stecken – je Revier-Generation eine. */
const EQUIV: string[][] = [
  ['GREAT_BARRACUDA', 'BARRACUDA'],
  ['GRAY_SNAPPER_C', 'GREY_SNAPER'],
  ['GIANT_GROUPER', 'GIANT_GROUPER_D'],
  ['BLACKTIP_REEF_SHARK', 'BLACKTIP_SHARK_D'],
]

/** Guide-Eintrag auf den Artenschlüssel der Spieldaten ziehen. */
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

  // Führt der Schlüssel in diesem Revier ins Leere, gilt die Zwillingsart.
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

// ------------------------------------------------------------------- Köder

export interface BaitEntry {
  key: string
  en: string
  de: string
  kind: BaitKind
  /** Interesse je Artenschlüssel, 0–1. */
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
  BAITS[key] = { key, en: b.en, de: b.de, kind: b.kind, fish }
}

export interface BaitForSpecies {
  bait: BaitEntry
  v: number
}

/** Umgekehrte Sicht: welche Köder taugen für eine Art, absteigend. */
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
