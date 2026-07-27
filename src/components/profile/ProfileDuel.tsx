/**
 * The comparison itself: first both states side by side, then the figures, the
 * fisheries, and finally every species with counts and records.
 *
 * The dates at the top are not decoration. Comparing a save file from March
 * against one from yesterday says nothing, so both stamps stay in view.
 */
import { useMemo } from 'react'
import { useI18n } from '../../i18n'
import type { Key } from '../../i18n'
import { DASH, cn, fmtAgo, fmtNum, fmtTime, fmtWhen } from '../../lib/format'
import { DUEL_FILTERS, DUEL_GROUPS, duelClass, fisheryStats } from '../../lib/profile'
import type {
  DuelFilter,
  ProfileResponse,
  PublicProfile,
  SpeciesRecord,
} from '../../lib/profile'
import { Toggle } from '../ui'

export interface DuelSpeciesRow {
  k: string
  name: string
  a: SpeciesRecord | null
  b: SpeciesRecord | null
}

const EMPTY: SpeciesRecord = { count: 0, best: 0, length: 0, sum: 0 }

export interface ProfileDuelProps {
  data: ProfileResponse
  p: PublicProfile
  mine: PublicProfile
  /** The rows the current filter leaves. */
  rows: DuelSpeciesRow[]
  /** Every row, filter aside – the balance is counted from these. */
  all: DuelSpeciesRow[]
  filter: DuelFilter
  onFilter: (f: DuelFilter) => void
}

export function ProfileDuel({ data, p, mine, rows, all, filter, onFilter }: ProfileDuelProps) {
  const { t, lang } = useI18n()
  const them = data.user.name
  const me = data.me!.user.name

  /* The balance across all species: who has them, and who holds the heavier fish. */
  const tally = useMemo(() => {
    const n = {
      both: 0, his: 0, mine: 0,
      leadW: 0, behindW: 0, tieW: 0,
      leadL: 0, behindL: 0,
      leadC: 0, behindC: 0,
    }
    for (const r of all) {
      if (r.a && r.b) n.both++
      else if (r.a) n.his++
      else n.mine++
      if (!r.a || !r.b) continue
      if (r.b.best > r.a.best + 0.0005) n.leadW++
      else if (r.a.best > r.b.best + 0.0005) n.behindW++
      else n.tieW++
      if (r.b.length > r.a.length + 0.0005) n.leadL++
      else if (r.a.length > r.b.length + 0.0005) n.behindL++
      if (r.b.count > r.a.count) n.leadC++
      else if (r.a.count > r.b.count) n.behindC++
    }
    return n
  }, [all])

  const fishA = useMemo(() => fisheryStats(p), [p])
  const fishB = useMemo(() => fisheryStats(mine), [mine])
  const fishRows = fishA
    .map((a, i) => ({ a, b: fishB[i]! }))
    .filter((r) => r.a.total || r.a.fish || r.b.fish)
    .sort(
      (x, y) =>
        y.a.done + y.b.done - (x.a.done + x.b.done) || x.a.name.localeCompare(y.a.name, lang),
    )

  const line = (
    label: Key,
    a: number,
    b: number,
    fmt: (v: number) => string,
    hint: Key | '',
  ) => (
    <tr key={label}>
      <td className="n">
        {t(label)}
        {hint ? <span className="hint">{t(hint)}</span> : null}
      </td>
      <td className={cn('num', duelClass(a, b))}>{fmt(a)}</td>
      <td className={cn('num', duelClass(b, a))}>{fmt(b)}</td>
      <td className="sub">
        {a === b
          ? t('duel.level')
          : (b > a ? t('duel.youLead') : t('duel.theyLead')) + ' ' + fmt(Math.abs(b - a))}
      </td>
    </tr>
  )

  const side = (who: string, prof: PublicProfile, cls: string) => (
    <div className={'ufs-duelside ' + cls}>
      <span className="who">{who}</span>
      <span className="sub">
        {t('duel.anglerLine', { name: prof.anglerName || who, level: fmtNum(prof.level) })}
      </span>
      <span className="sub">
        {t('duel.stateLine', { when: fmtWhen(prof.updatedAt), ago: fmtAgo(prof.updatedAt) })}
      </span>
    </div>
  )

  return (
    <div>
      <div className="ufs-duelhead">
        {side(them, p, 'them')}
        <div className="ufs-duelvs">vs</div>
        {side(me, mine, 'mine')}
      </div>

      <div className="ufs-spotcard" style={{ marginTop: '.9rem' }}>
        <h3>{t('duel.figures')}</h3>
        <table className="ufs-rec ufs-duel">
          <thead>
            <tr>
              <th />
              <th>{them}</th>
              <th>{me}</th>
              <th>{t('profile.colDifference')}</th>
            </tr>
          </thead>
          {DUEL_GROUPS.map((grp) => (
            <tbody key={grp.label}>
              <tr className="grp">
                <td colSpan={4}>{t(grp.label)}</td>
              </tr>
              {grp.rows.map((row) =>
                line(row.label, row.value(p) || 0, row.value(mine) || 0, row.format, row.hint),
              )}
            </tbody>
          ))}
        </table>
      </div>

      <div className="ufs-spotcard" style={{ marginTop: '.9rem' }}>
        <h3>{t('profile.speciesBalance')}</h3>
        <div className="ufs-row" style={{ gap: '.4rem', flexWrap: 'wrap' }}>
          <span className="ufs-chip">{t('profile.bothHave', { n: tally.both })}</span>
          <span className="ufs-chip">{t('profile.onlyName', { name: them, n: tally.his })}</span>
          <span className="ufs-chip">{t('duel.onlyMe', { n: tally.mine })}</span>
          <span className="ufs-chip">
            {t('duel.neitherYet', { n: Math.max(0, data.meta.totalSpecies - all.length) })}
          </span>
        </div>
        <table className="ufs-rec ufs-duel" style={{ marginTop: '.7rem' }}>
          <thead>
            <tr>
              <th>{t('profile.colCommonSpecies')}</th>
              <th>{them}</th>
              <th>{me}</th>
              <th>{t('profile.colDraw')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="n">{t('duel.heavierFish')}</td>
              <td className={cn('num', duelClass(tally.behindW, tally.leadW))}>{tally.behindW}</td>
              <td className={cn('num', duelClass(tally.leadW, tally.behindW))}>{tally.leadW}</td>
              <td className="sub">{tally.tieW}</td>
            </tr>
            <tr>
              <td className="n">{t('duel.longerFish')}</td>
              <td className={cn('num', duelClass(tally.behindL, tally.leadL))}>{tally.behindL}</td>
              <td className={cn('num', duelClass(tally.leadL, tally.behindL))}>{tally.leadL}</td>
              <td className="sub">{tally.both - tally.leadL - tally.behindL}</td>
            </tr>
            <tr>
              <td className="n">{t('duel.morePieces')}</td>
              <td className={cn('num', duelClass(tally.behindC, tally.leadC))}>{tally.behindC}</td>
              <td className={cn('num', duelClass(tally.leadC, tally.behindC))}>{tally.leadC}</td>
              <td className="sub">{tally.both - tally.leadC - tally.behindC}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="ufs-spotcard" style={{ marginTop: '.9rem' }}>
        <h3>{t('duel.fisheryByFishery')}</h3>
        <div className="ufs-scroll">
          <table className="ufs-rec ufs-duel">
            <thead>
              <tr>
                <th>{t('stats.colFishery')}</th>
                <th colSpan={2}>{t('nav.species')}</th>
                <th colSpan={2}>{t('stats.catches')}</th>
                <th colSpan={2}>{t('profile.colWeight')}</th>
                <th colSpan={2}>{t('stats.colTime')}</th>
                <th colSpan={2}>{t('stats.heaviest')}</th>
              </tr>
              <tr className="sub2">
                <th />
                <th>{them}</th>
                <th>{me}</th>
                <th>{them}</th>
                <th>{me}</th>
                <th>{them}</th>
                <th>{me}</th>
                <th>{them}</th>
                <th>{me}</th>
                <th>{them}</th>
                <th>{me}</th>
              </tr>
            </thead>
            <tbody>
              {fishRows.map(({ a, b }) => (
                <tr key={a.id}>
                  <td className="n">{a.name}</td>
                  <td className={cn('num', duelClass(a.done, b.done))}>{a.done + '/' + a.total}</td>
                  <td className={cn('num', duelClass(b.done, a.done))}>{b.done + '/' + b.total}</td>
                  <td className={cn('num', duelClass(a.fish, b.fish))}>{fmtNum(a.fish)}</td>
                  <td className={cn('num', duelClass(b.fish, a.fish))}>{fmtNum(b.fish)}</td>
                  <td className={cn('num', duelClass(a.weight, b.weight))}>{fmtNum(a.weight, 1)}</td>
                  <td className={cn('num', duelClass(b.weight, a.weight))}>{fmtNum(b.weight, 1)}</td>
                  <td className={cn('num', duelClass(a.time, b.time))}>
                    {a.time ? fmtTime(a.time) : DASH}
                  </td>
                  <td className={cn('num', duelClass(b.time, a.time))}>
                    {b.time ? fmtTime(b.time) : DASH}
                  </td>
                  <td className={cn('num', duelClass(a.bigW, b.bigW))}>
                    {a.bigW ? a.bigW.toFixed(2) : DASH}
                  </td>
                  <td className={cn('num', duelClass(b.bigW, a.bigW))}>
                    {b.bigW ? b.bigW.toFixed(2) : DASH}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ufs-muted" style={{ fontSize: '11.5px', marginTop: '.6rem' }}>
          {t('profile.fisheryNote')}
        </p>
      </div>

      <div className="ufs-spotcard" style={{ marginTop: '.9rem' }}>
        <div
          className="ufs-row"
          style={{ justifyContent: 'space-between', marginBottom: '.7rem', flexWrap: 'wrap' }}
        >
          <h3 style={{ margin: 0 }}>{t('duel.speciesBySpecies')}</h3>
          <div className="ufs-row no-print" style={{ gap: '.35rem', flexWrap: 'wrap' }}>
            {DUEL_FILTERS.map((f) => (
              <Toggle key={f.key} active={filter === f.key} onClick={() => onFilter(f.key)}>
                {t(f.label)}
              </Toggle>
            ))}
          </div>
        </div>
        <div className="ufs-scroll">
          <table className="ufs-rec ufs-duel">
            <thead>
              <tr>
                <th>{t('stats.colSpecies')}</th>
                <th colSpan={2}>{t('profile.sortCount')}</th>
                <th colSpan={2}>{t('profile.sortBest')}</th>
                <th colSpan={2}>{t('profile.colBestLength')}</th>
                <th colSpan={2}>{t('stats.totalWeight')}</th>
                <th />
              </tr>
              <tr className="sub2">
                <th />
                <th>{them}</th>
                <th>{me}</th>
                <th>{them}</th>
                <th>{me}</th>
                <th>{them}</th>
                <th>{me}</th>
                <th>{them}</th>
                <th>{me}</th>
                <th>{t('profile.colLead')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const a = r.a ?? EMPTY
                const b = r.b ?? EMPTY
                const d = (b.best || 0) - (a.best || 0)
                return (
                  <tr key={r.k}>
                    <td className="n">
                      {r.name}
                      {!r.a ? (
                        <span className="hint">{t('duel.theyMissIt')}</span>
                      ) : !r.b ? (
                        <span className="hint">{t('duel.youMissIt')}</span>
                      ) : null}
                    </td>
                    <td className={cn('num', duelClass(a.count, b.count))}>{a.count || DASH}</td>
                    <td className={cn('num', duelClass(b.count, a.count))}>{b.count || DASH}</td>
                    <td className={cn('num', duelClass(a.best, b.best))}>
                      {a.best ? a.best.toFixed(2) : DASH}
                    </td>
                    <td className={cn('num', duelClass(b.best, a.best))}>
                      {b.best ? b.best.toFixed(2) : DASH}
                    </td>
                    <td className={cn('num', duelClass(a.length, b.length))}>
                      {a.length ? Math.round(a.length * 100) : DASH}
                    </td>
                    <td className={cn('num', duelClass(b.length, a.length))}>
                      {b.length ? Math.round(b.length * 100) : DASH}
                    </td>
                    <td className={cn('num', duelClass(a.sum, b.sum))}>
                      {a.sum ? fmtNum(a.sum, 1) : DASH}
                    </td>
                    <td className={cn('num', duelClass(b.sum, a.sum))}>
                      {b.sum ? fmtNum(b.sum, 1) : DASH}
                    </td>
                    <td className="sub">
                      {Math.abs(d) < 0.0005
                        ? DASH
                        : (d > 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(2) + ' kg'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!rows.length ? (
          <p className="ufs-muted" style={{ fontSize: '12px' }}>
            {t('duel.noSpeciesInPick')}
          </p>
        ) : null}
        <p className="ufs-muted" style={{ fontSize: '11.5px', marginTop: '.6rem' }}>
          {t('duel.speciesCount', { shown: rows.length, total: all.length }) +
            t('profile.speciesNote')}
        </p>
      </div>

      {/* What the other one is still missing – the most useful part of the comparison. */}
      <div className="ufs-two" style={{ marginTop: '.9rem' }}>
        <MissList
          title={t('profile.onlyThem', { name: them })}
          rows={all.filter((r) => r.a && !r.b)}
        />
        <MissList title={t('profile.onlyYou')} rows={all.filter((r) => r.b && !r.a)} />
      </div>
    </div>
  )
}

/** Short species list for "the other one is missing these". */
function MissList({ title, rows }: { title: string; rows: DuelSpeciesRow[] }) {
  const { t } = useI18n()
  return (
    <div className="ufs-spotcard">
      <h3>
        {title} <span className="ufs-muted">{'(' + rows.length + ')'}</span>
      </h3>
      {rows.length ? (
        <div className="ufs-row" style={{ gap: '.35rem', flexWrap: 'wrap' }}>
          {rows.map((r) => (
            <span key={r.k} className="ufs-chip">
              {r.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="ufs-muted" style={{ fontSize: '12px', margin: 0 }}>
          {t('profile.tie')}
        </p>
      )}
    </div>
  )
}

export default ProfileDuel
