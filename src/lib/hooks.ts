import { HOOKS } from '../data'
import type { Range } from '../types'

/**
 * The eighteen size steps of the game.
 *
 * The labels (#12 … #12/0) are built in UtilitiesUnits.GetHookSizeString from
 * the index; hooks.ps1 stores them alongside the tables, so nothing has to be
 * guessed here.
 */

/** Which steps cover a weight or length between lo and hi? */
export function fitSteps(table: Range[] | undefined, lo: number, hi: number): number[] {
  const out: number[] = []
  if (!table) return out
  for (let i = 0; i < table.length; i++) {
    const row = table[i]
    if (!row) continue
    const [a, b] = row
    if (b <= 0) continue
    if (a <= hi && b >= lo) out.push(i)
  }
  return out
}

export function hookLabel(i: number): string {
  return HOOKS?.label?.[i] ?? `#${i + 1}`
}

/** "#4 – #1/0" for a run of steps, or a single label. */
export function stepRange(idx: number[]): string | null {
  if (!idx.length) return null
  const a = hookLabel(idx[0] as number)
  const b = hookLabel(idx[idx.length - 1] as number)
  return a === b ? a : `${a} – ${b}`
}

/** The hook gap of those steps in millimetres. */
export function gapRange(idx: number[]): string | null {
  if (!idx.length || !HOOKS?.gap) return null
  const a = Math.round((HOOKS.gap[idx[0] as number] ?? 0) * 1000)
  const b = Math.round((HOOKS.gap[idx[idx.length - 1] as number] ?? 0) * 1000)
  return a === b ? `${a} mm` : `${a}–${b} mm`
}
