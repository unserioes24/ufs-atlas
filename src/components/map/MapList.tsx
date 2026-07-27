/**
 * The list of fisheries beside the map, grouped the way the guide groups them:
 * base game, variants, DLC, announced.
 *
 * Each entry carries how much of its species list is ticked off. The count
 * takes both sources: what the game files hold for the fishery, and what the
 * guide lists on top of it.
 */
import { useMemo } from 'react'
import { FISHERIES, GUIDE, speciesKey } from '../../data'
import { useI18n } from '../../i18n'
import type { Key } from '../../i18n'
import { DASH, cn } from '../../lib/format'
import type { GuideMap } from '../../types'
import { Bar } from '../primitives'

/**
 * Headings of the map groups. The guide names them in German; the display takes
 * the dictionary entry, and an unknown group keeps its own name.
 */
const GROUPS: Record<string, Key> = {
  Basis: 'map.groupBase',
  Variante: 'map.groupVariant',
  DLC: 'map.groupDlc',
  Angekündigt: 'map.groupAnnounced',
}

export interface MapListProps {
  selected: string
  onSelect: (id: string) => void
  caught: Record<string, boolean>
  allKeys: string[]
}

export function MapList({ selected, onSelect, caught, allKeys }: MapListProps) {
  const { t } = useI18n()

  /** Species per fishery – the same for every render, so it is built once. */
  const keysPerMap = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const m of GUIDE.maps) {
      const keys = new Set<string>()
      for (const g of FISHERIES[m.id]?.species ?? []) keys.add(g.s)
      for (const f of GUIDE.fish) {
        if (f.mapId !== m.id) continue
        const k = speciesKey(f.name, f.de, f.mapId)
        if (k) keys.add(k)
      }
      out[m.id] = [...keys]
    }
    return out
  }, [])

  const grouped = useMemo(() => {
    const out: Record<string, GuideMap[]> = {}
    for (const m of GUIDE.maps) (out[m.group] ??= []).push(m)
    return out
  }, [])

  const allDone = allKeys.filter((k) => caught[k]).length
  const row =
    'group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition'
  const active = 'border border-cyan-300/20 bg-cyan-400/10'
  const idle = 'border border-transparent hover:bg-white/[.045]'

  return (
    <aside className="no-print hidden self-start lg:sticky lg:top-24 lg:block">
      <div className="glass scrollbar max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl border border-white/10 p-3 shadow-2xl">
        <div className="px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-[.18em] text-slate-500">
          {t('map.maps')}
        </div>

        <button
          onClick={() => onSelect('__all__')}
          className={cn('mb-3', row, selected === '__all__' ? active : idle)}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-300/70" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-200">
              {t('map.overview')}
            </span>
            <span style={{ display: 'block', marginTop: '3px' }}>
              <Bar value={allDone} total={allKeys.length} thin />
            </span>
          </span>
          <span className="text-[10px] tabular-nums text-slate-600">
            {allDone + '/' + allKeys.length}
          </span>
        </button>

        {Object.keys(grouped).map((group) => (
          <div key={group} className="mb-4">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-600">
              {GROUPS[group] ? t(GROUPS[group]) : group}
            </div>
            <div className="space-y-1">
              {grouped[group]!.map((m) => {
                const ks = keysPerMap[m.id] ?? []
                const dn = ks.filter((k) => caught[k]).length
                return (
                  <button
                    key={m.id}
                    onClick={() => onSelect(m.id)}
                    className={cn(row, selected === m.id ? active : idle)}
                  >
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        m.status === 'announced' ? 'bg-slate-600' : 'bg-cyan-300/70',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-200">
                        {m.name}
                      </span>
                      {ks.length ? (
                        <span style={{ display: 'block', marginTop: '3px' }}>
                          <Bar value={dn} total={ks.length} thin />
                        </span>
                      ) : (
                        <span className="block truncate text-[10px] text-slate-500">{m.water}</span>
                      )}
                    </span>
                    <span className="text-[10px] tabular-nums text-slate-600">
                      {ks.length ? dn + '/' + ks.length : DASH}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

export default MapList
