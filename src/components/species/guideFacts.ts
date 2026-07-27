/**
 * What the guide says about a species, gathered across every fishery.
 *
 * The guide writes per fishery, so the same species can carry different baits
 * and hooks in several rows. Counting the entries lets the list show the ones
 * that come up most often instead of whichever happened to be first.
 */
import { GUIDE, speciesKey } from '../../data'

export interface GuideFacts {
  baits: Record<string, number>
  methods: Record<string, number>
  hooks: Record<string, number>
  retrieves: Record<string, number>
  maps: Record<string, boolean>
}

export const SPECIES_GUIDE: Record<string, GuideFacts> = (() => {
  const out: Record<string, GuideFacts> = {}
  for (const f of GUIDE.fish) {
    const k = speciesKey(f.name, f.de, f.mapId)
    if (!k) continue
    const e = (out[k] ??= { baits: {}, methods: {}, hooks: {}, retrieves: {}, maps: {} })
    for (const raw of String(f.bait ?? '').split(/[,;/]| oder /)) {
      const b = raw.trim()
      if (b && b !== '—') e.baits[b] = (e.baits[b] ?? 0) + 1
    }
    if (f.method) e.methods[f.method] = (e.methods[f.method] ?? 0) + 1
    if (f.hook) e.hooks[f.hook] = (e.hooks[f.hook] ?? 0) + 1
    if (f.retrieve && f.retrieve !== '—') {
      e.retrieves[f.retrieve] = (e.retrieves[f.retrieve] ?? 0) + 1
    }
    e.maps[f.mapId] = true
  }
  return out
})()

/** The most frequent entries first. */
export function topKeys(obj: Record<string, number> | undefined, n = 6): string[] {
  return Object.keys(obj ?? {})
    .sort((a, b) => (obj?.[b] ?? 0) - (obj?.[a] ?? 0))
    .slice(0, n)
}
