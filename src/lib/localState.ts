/**
 * The state that lives in the browser: ticked species, personal records, and
 * whatever a save file added last.
 *
 * There is exactly one local state. Older versions kept several profiles side
 * by side – of those the last active one is taken over once and then dropped.
 *
 * Every change of our own gets a timestamp. That is what decides, next time the
 * page loads, whether the account on the server holds something newer.
 */
import { useCallback, useEffect, useState } from 'react'
import type { BestCatch, LocalState, SaveStats } from '../types'

const EMPTY: LocalState = { caught: {}, bests: {}, stats: null, updatedAt: null }

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function loadLocal(): LocalState {
  try {
    const old = readJson<{ list?: Array<{ id: string; caught?: Record<string, boolean>; bests?: Record<string, BestCatch>; stats?: SaveStats | null }>; active?: string } | null>(
      'ufs-profiles',
      null,
    )
    if (old?.list?.length) {
      const act = old.list.find((x) => x.id === old.active) ?? old.list[0]!
      localStorage.removeItem('ufs-profiles')
      return {
        caught: act.caught ?? {},
        bests: act.bests ?? {},
        stats: act.stats ?? null,
        updatedAt: null,
      }
    }
  } catch {
    // fall back to the single keys
  }
  return {
    caught: readJson('ufs-caught', {}),
    bests: readJson('ufs-bests', {}),
    stats: readJson<SaveStats | null>('ufs-stats', null),
    updatedAt: localStorage.getItem('ufs-updated'),
  }
}

function persist(state: LocalState): void {
  localStorage.setItem('ufs-caught', JSON.stringify(state.caught ?? {}))
  localStorage.setItem('ufs-bests', JSON.stringify(state.bests ?? {}))
  localStorage.setItem('ufs-stats', JSON.stringify(state.stats ?? null))
  if (state.updatedAt) localStorage.setItem('ufs-updated', state.updatedAt)
  else localStorage.removeItem('ufs-updated')
}

export interface LocalStateApi {
  local: LocalState
  /** Replace the state outright – that is what an import does. */
  setLocal: (next: LocalState) => void
  /** Change a part of it and stamp the time. */
  patchLocal: (patch: Partial<LocalState>) => void
  reset: () => void
}

export function useLocalState(): LocalStateApi {
  const [local, setState] = useState<LocalState>(loadLocal)

  useEffect(() => persist(local), [local])

  const patchLocal = useCallback((patch: Partial<LocalState>) => {
    setState((l) => ({ ...l, ...patch, updatedAt: new Date().toISOString() }))
  }, [])

  const reset = useCallback(() => {
    setState({ ...EMPTY, updatedAt: new Date().toISOString() })
  }, [])

  return { local, setLocal: setState, patchLocal, reset }
}

/** The timestamp last written to storage – read without going through state. */
export function storedStamp(): string | null {
  return localStorage.getItem('ufs-updated')
}
