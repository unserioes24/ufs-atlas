/**
 * Progress across every fishery: how much of the species list is ticked off,
 * and what is still open where. Ticks come from the browser, the species per
 * fishery from the game files.
 */
import { FISHERIES, GUIDE, speciesName } from '../../data'
import { useI18n } from '../../i18n'
import { DASH, cn } from '../../lib/format'
import { Bar, Stat } from '../primitives'

export interface GlobalOverviewProps {
  caught: Record<string, boolean>
  allKeys: string[]
  onOpenMap: (id: string) => void
}

export function GlobalOverview({ caught, allKeys, onOpenMap }: GlobalOverviewProps) {
  const { t, lang } = useI18n()
  const done = allKeys.filter((k) => caught[k]).length

  const rows = Object.keys(FISHERIES)
    .map((id) => {
      const m = GUIDE.maps.find((x) => x.id === id)
      const keys = FISHERIES[id]!.species.map((g) => g.s)
      return {
        id,
        name: m ? m.name : id,
        total: keys.length,
        done: keys.filter((k) => caught[k]).length,
      }
    })
    .sort((a, b) => b.done / (b.total || 1) - a.done / (a.total || 1))

  const complete = rows.filter((r) => r.total && r.done === r.total).length

  return (
    <div>
      <div className="ufs-statgrid" style={{ marginBottom: '1rem' }}>
        <Stat
          label={t('overview.caught')}
          value={done + ' / ' + allKeys.length}
          sub={t('overview.caughtSub', { pct: Math.round((done / (allKeys.length || 1)) * 100) })}
        />
        <Stat
          label={t('stats.fisheriesComplete')}
          value={complete + ' / ' + rows.length}
          sub={t('overview.completeSub')}
        />
        <Stat
          label={t('overview.left')}
          value={allKeys.length - done}
          sub={t('overview.leftSub')}
        />
      </div>
      <div style={{ marginBottom: '1.2rem' }}>
        <Bar value={done} total={allKeys.length} />
      </div>
      <div className="ufs-spotcard">
        <h3>{t('overview.perFishery')}</h3>
        <table className="ufs-rec">
          <thead>
            <tr>
              <th>{t('stats.colFishery')}</th>
              <th>{t('overview.colCaught')}</th>
              <th>{t('overview.colProgress')}</th>
              <th>{t('overview.colOpen')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const open = FISHERIES[r.id]!.species.filter((g) => !caught[g.s]).map((g) =>
                speciesName(g.s, lang),
              )
              const full = !!r.total && r.done === r.total
              return (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => onOpenMap(r.id)}>
                  <td className={cn('n', full && 'done')}>{(full ? '✓ ' : '') + r.name}</td>
                  <td className="num">{r.done + ' / ' + r.total}</td>
                  <td>
                    <div className="ufs-recbar">
                      <span style={{ width: (r.total ? (r.done / r.total) * 100 : 0) + '%' }} />
                    </div>
                  </td>
                  <td className="sub">
                    {open.length
                      ? open.slice(0, 4).join(', ') +
                        (open.length > 4 ? ' +' + (open.length - 4) : '')
                      : DASH}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default GlobalOverview
