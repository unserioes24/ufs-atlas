import { FISHERIES, SPECIES } from '../data'
import type { BestCatch } from '../types'

/**
 * Reading a PROFILE_x save file from
 * %AppData%\LocalLow\PlayWay\UltimateFishing.
 *
 * The file is Easy Save 2: one record per key, no index, no schema. Everything
 * happens in the browser — the file is never uploaded unless the user asks for
 * it explicitly.
 */

/** Easy Save 2 type markers, sitting right behind the 0xFF in each record. */
const ES2_INT = 0xe2a80856
const ES2_FLOAT = 0x6e3ed76b
const ES2_STRING = 0xfde9f1ee
const ES2_BOOL = 0xad4d7c9c

export type RawProfile = Record<string, string | number | boolean>

/**
 * Record layout: '~' + key length + key + int32 block length + 0xFF + type
 * hash + value. Every byte position is checked, so an unknown data type cannot
 * shift the rest of the run.
 */
export function parseProfile(buffer: ArrayBuffer): RawProfile {
  const u8 = new Uint8Array(buffer)
  const dv = new DataView(buffer)
  const out: RawProfile = {}
  const dec = new TextDecoder('utf-8')

  for (let i = 0; i + 8 < u8.length; i++) {
    if (u8[i] !== 0x7e) continue
    const keyLen = u8[i + 1] ?? 0
    if (keyLen < 3 || keyLen > 64 || i + 2 + keyLen + 5 > u8.length) continue

    let key = ''
    let ok = true
    for (let j = 0; j < keyLen; j++) {
      const c = u8[i + 2 + j] ?? 0
      const printable =
        (c >= 48 && c <= 57) ||
        (c >= 65 && c <= 90) ||
        (c >= 97 && c <= 122) ||
        c === 95 ||
        c === 47
      if (!printable) {
        ok = false
        break
      }
      key += String.fromCharCode(c)
    }
    if (!ok) continue

    let p = i + 2 + keyLen
    const blob = dv.getInt32(p, true)
    p += 4
    if (blob < 5 || blob > 65536 || p + blob > u8.length) continue
    if (u8[p] !== 0xff) continue

    const type = dv.getUint32(p + 1, true)
    const vp = p + 5
    if (type === ES2_INT && vp + 4 <= u8.length) out[key] = dv.getInt32(vp, true)
    else if (type === ES2_FLOAT && vp + 4 <= u8.length) out[key] = dv.getFloat32(vp, true)
    else if (type === ES2_BOOL && vp < u8.length) out[key] = u8[vp] !== 0
    else if (type === ES2_STRING && vp < u8.length) {
      const len = u8[vp] ?? 0
      if (len < 128 && vp + 1 + len <= u8.length) {
        out[key] = dec.decode(u8.subarray(vp + 1, vp + 1 + len))
      }
    }
  }
  return out
}

/**
 * Some species are counted per model variant (BROWN_TROUT and BROWN_TROUT_B).
 * Fold them onto the base key where one exists — species like TIGER_SHARK_D
 * really are named that way and stay untouched.
 */
function normSpeciesKey(k: string): string {
  if (SPECIES[k]) return k
  const m = /^(.*)_[A-Z]{1,2}$/.exec(k)
  if (m?.[1] && SPECIES[m[1]]) return m[1]
  return k
}

export interface RodSet {
  n: number
  parts: Array<{ slot: string; id: string }>
  baits: string[]
  depth?: number | string | boolean
  weight?: number | string | boolean
  hookSize?: number | string | boolean
}

/**
 * A skill from the tree. The game unlocks it step by step and the save file
 * records one flag per step, so `steps` is how many the game offers and `level`
 * how far this player has taken it.
 */
export interface SkillState {
  key: string
  level: number
  steps: number
}

export interface PlayerInfo {
  sets: RodSet[]
  owned: Record<string, number>
  name: string | null
  level: number
  score: number
  money: number
  exp: number
  luck: number
  strength: number
  /** Skill points not spent yet. */
  skillPoints: number
  skills: SkillState[]
  version: string | null
}

export interface FisheryStats {
  fish: number
  bites: number
  score: number
  time: number
  weight: number
  bigW: number
  bigL: number
  entries: number | null
}

export interface SaveSummary {
  caught: Record<string, boolean>
  bests: Record<string, BestCatch>
  fisheries: Record<string, FisheryStats>
  player: PlayerInfo
  total: number
}

/** Rod set slots; the label is a dictionary key, not a word. */
const SLOTS: Array<[string, string]> = [
  ['ROD', 'slot.rod'],
  ['ICE_ROD', 'slot.iceRod'],
  ['REEL', 'slot.reel'],
  ['LINE', 'slot.line'],
  ['FLOAT', 'slot.float'],
  ['HOOK', 'slot.hook'],
  ['BOILIE', 'slot.boilie'],
  ['FEEDER', 'slot.feeder'],
  ['FEEDER_BAIT', 'slot.feederBait'],
  ['ROD_STAND', 'slot.rodStand'],
  ['BITE_INDICATOR', 'slot.biteIndicator'],
]

/** Turns raw profile values into catch state, records and statistics. */
export function profileToCatches(raw: RawProfile): SaveSummary {
  const caught: Record<string, boolean> = {}
  const bests: Record<string, BestCatch> = {}

  for (const k of Object.keys(raw)) {
    const m = /^([A-Z0-9_]+)_caughtCount$/.exec(k)
    if (!m?.[1]) continue
    const base = m[1]
    const n = Number(raw[`${base}_caughtCount`] ?? 0) | 0
    if (n <= 0) continue

    const key = normSpeciesKey(base)
    const w = raw[`${base}_weight`]
    const l = raw[`${base}_length`]
    const f = raw[`${base}_fishery`]
    const sum = raw[`${base}_caughtWeightSum`]

    caught[key] = true
    const b = (bests[key] ??= { count: 0, weight: 0, length: 0, sum: 0, fishery: null })
    b.count += n
    if (typeof sum === 'number') b.sum += sum
    if (typeof w === 'number' && w > b.weight) {
      b.weight = w
      if (typeof l === 'number') b.length = l
      if (typeof f === 'string' && f) b.fishery = f
    }
  }

  // Fishery statistics: LEVELS/<X>_NAME[_WINTER]_Stats_*
  const fisheries: Record<string, FisheryStats> = {}
  for (const [id, fy] of Object.entries(FISHERIES)) {
    const pre = fy.save
    if (!pre) continue
    const g = (n: string): number => {
      const v = raw[`${pre}_Stats_${n}`]
      return typeof v === 'number' ? v : 0
    }
    const entries = raw[`${pre}_availableEntries`]
    const st: FisheryStats = {
      fish: g('fishCaught'),
      bites: g('bitesAmount'),
      score: g('score'),
      time: g('timeSpent'),
      weight: g('weightSum'),
      bigW: g('biggestWeight'),
      bigL: g('biggestLength'),
      entries: typeof entries === 'number' ? entries : null,
    }
    if (st.fish || st.bites || st.time || st.weight) fisheries[id] = st
  }

  // The five rod sets: set 1 without an index, sets 2–5 with one in the key
  const sets: RodSet[] = []
  for (let n = 1; n <= 5; n++) {
    const eq = n === 1 ? 'currentEquipment_' : `currentEquipment_${n}_`
    const bt = n === 1 ? 'currentBaits_' : `currentBaits_${n}_`
    const sfx = n === 1 ? '' : `${n}_`

    const parts: RodSet['parts'] = []
    for (const [slot, label] of SLOTS) {
      const v = raw[eq + slot]
      if (typeof v === 'string' && v) parts.push({ slot: label, id: v })
    }
    const baits: string[] = []
    for (let i = 0; i < 3; i++) {
      const v = raw[bt + i]
      if (typeof v === 'string' && v) baits.push(v)
    }
    if (!parts.length && !baits.length) continue
    sets.push({
      n,
      parts,
      baits,
      depth: raw[`currentFloatDepth${sfx}`],
      weight: raw[`currentFloatWeight${sfx}`],
      hookSize: raw[`currentHookSize${sfx}`],
    })
  }

  // Owned gear per category, from the <ITEM>_isBought keys
  const owned: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    const m = /^([A-Z][A-Z0-9_]+)_isBought$/.exec(k)
    if (!m?.[1] || v !== true) continue
    const cat = /^(ICE_ROD|ROD_STAND|FEEDER_BAIT|BITE_INDICATOR|[A-Z]+)/.exec(m[1])
    const c = cat?.[1] ?? 'SONST'
    owned[c] = (owned[c] ?? 0) + 1
  }

  const num = (v: unknown): number => (typeof v === 'number' ? v : 0)
  const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

  // The skill tree: one flag per step, e.g. skill_unlocked_MORE_EXP_2. How many
  // steps a skill has is counted from the keys the save file carries - the
  // game's own localisation names only the first step of several of them.
  const steps: Record<string, number[]> = {}
  for (const [k, v] of Object.entries(raw)) {
    const m = /^skill_unlocked_(.+)_(\d+)$/.exec(k)
    if (!m?.[1] || !m[2]) continue
    ;(steps[m[1]] ??= []).push(v === true ? Number(m[2]) : 0)
  }
  const skills: SkillState[] = Object.entries(steps)
    .map(([key, list]) => ({ key, level: Math.max(0, ...list), steps: list.length }))
    .sort((a, b) => b.level - a.level || a.key.localeCompare(b.key))

  return {
    caught,
    bests,
    fisheries,
    player: {
      sets,
      owned,
      name: str(raw.playerName),
      level: num(raw.playersLevel),
      score: num(raw.playersScore),
      money: num(raw.playersMoney),
      exp: num(raw.playersExperience),
      luck: num(raw.playersLuck),
      strength: num(raw.playersStrength),
      skillPoints: num(raw.skillPoints),
      skills,
      version: str(raw.gameVersion),
    },
    total: Object.keys(caught).length,
  }
}

/** LEVELS/BETTY_NAME → "Betty Name" reads badly; the guide keeps its own labels. */
export function fisheryLabel(loc: string | null | undefined): string | null {
  if (!loc) return null
  const m = /^LEVELS\/(.+)_NAME$/.exec(loc)
  if (!m?.[1]) return loc
  return m[1]
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
