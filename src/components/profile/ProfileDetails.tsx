/**
 * A single angler's profile at full width: the figures, progress per fishery,
 * the record list of their species, and what is still missing.
 *
 * Which of the four blocks shows is decided by the side menu, so a section can
 * be linked to on its own.
 */
import { useMemo, useState } from 'react'
import { GUIDE, speciesName } from '../../data'
import { useI18n } from '../../i18n'
import { DASH, cn, fmtNum, fmtTime } from '../../lib/format'
import { categoryLabel } from '../../lib/gear'
import { fisheryStats } from '../../lib/profile'
import type { ProfileResponse, PublicProfile } from '../../lib/profile'
import { Bar, Stat } from '../primitives'
import { RodSets } from './RodSets'
import { Skills } from '../stats/Skills'
import { Toggle } from '../ui'

type Sort = 'sum' | 'best' | 'length' | 'count' | 'name'

const SORTS = [
  { key: 'sum', label: 'profile.sortSum' },
  { key: 'best', label: 'profile.sortBest' },
  { key: 'length', label: 'profile.sortLength' },
  { key: 'count', label: 'profile.sortCount' },
  { key: 'name', label: 'profile.sortName' },
] as const

export interface ProfileDetailsProps {
  p: PublicProfile
  data: ProfileResponse
  tab: string
}

export function ProfileDetails({ p, data, tab = 'uebersicht' }: ProfileDetailsProps) {
  const { t, lang } = useI18n()
  const [sort, setSort] = useState<Sort>('sum')

  const rows = useMemo(() => {
    return Object.keys(p.species)
      .map((k) => {
        const s = p.species[k]!
        const m = GUIDE.maps.find((x) => x.id === s.fishery)
        return {
          k,
          name: speciesName(k, lang),
          count: s.count,
          best: s.best,
          length: s.length,
          sum: s.sum,
          where: m ? m.name : s.fishery || '',
        }
      })
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name, lang)
        if (sort === 'count') return b.count - a.count
        if (sort === 'best') return b.best - a.best
        if (sort === 'length') return b.length - a.length
        return b.sum - a.sum
      })
  }, [p, lang, sort])

  const fish = useMemo(
    () =>
      fisheryStats(p).sort(
        (a, b) =>
          b.done / (b.total || 1) - a.done / (a.total || 1) || a.name.localeCompare(b.name, lang),
      ),
    [p, lang],
  )

  const quote = p.totals.bites ? (p.totals.fish / p.totals.bites) * 100 : 0
  const perHour = p.totals.time ? p.totals.fish / (p.totals.time / 3600) : 0
  const avg = p.totals.fish ? p.totals.weight / p.totals.fish : 0
  const owned = Object.keys(p.owned ?? {}).sort((a, b) => p.owned![b]! - p.owned![a]!)

  return (
    <div>
      {tab === 'uebersicht' ? (
        <>
          <div className="ufs-statgrid">
            <Stat
              label={t('stats.level')}
              value={fmtNum(p.level)}
              sub={fmtNum(p.score) + ' ' + t('stats.points')}
            />
            <Stat
              label={t('nav.species')}
              value={fmtNum(p.speciesCount) + ' / ' + data.meta.totalSpecies}
              sub={t('profile.shareOfList', {
                pct: Math.round((p.speciesCount / (data.meta.totalSpecies || 1)) * 100),
              })}
            />
            <Stat
              label={t('stats.fisheriesComplete')}
              value={fmtNum(p.fisheriesComplete) + ' / ' + data.meta.totalFisheries}
              sub={t('profile.visitedFisheries', { n: Object.keys(p.fisheries ?? {}).length })}
            />
            <Stat
              label={t('stats.catches')}
              value={fmtNum(p.totals.fish)}
              sub={t('stats.bitesN', { n: fmtNum(p.totals.bites) })}
            />
            <Stat
              label={t('stats.totalWeight')}
              value={fmtNum(p.totals.weight, 1) + ' kg'}
              sub={t('profile.avgPerCatch', { n: fmtNum(avg, 2) })}
            />
            <Stat
              label={t('stats.time')}
              value={fmtTime(p.totals.time)}
              sub={t('profile.catchesPerHourSub', { n: fmtNum(perHour, 1) })}
            />
            <Stat
              label={t('stats.heaviest')}
              value={p.biggest.weight ? p.biggest.weight.toFixed(2) + ' kg' : DASH}
              sub={p.biggest.weightSpecies ? speciesName(p.biggest.weightSpecies, lang) : ''}
            />
            <Stat
              label={t('stats.longest')}
              value={p.biggest.length ? Math.round(p.biggest.length * 100) + ' cm' : DASH}
              sub={p.biggest.lengthSpecies ? speciesName(p.biggest.lengthSpecies, lang) : ''}
            />
            <Stat
              label={t('profile.topSpecies')}
              value={p.topSpecies.weight ? fmtNum(p.topSpecies.weight, 1) + ' kg' : DASH}
              sub={p.topSpecies.key ? speciesName(p.topSpecies.key, lang) : ''}
            />
            <Stat
              label={t('duel.bitesUsed')}
              value={fmtNum(quote, 1) + ' %'}
              sub={t('duel.catchesPerBite')}
            />
            {p.money ? (
              <Stat
                label={t('stats.money')}
                value={fmtNum(p.money)}
                sub={t('profile.experience', { n: fmtNum(p.exp) })}
              />
            ) : null}
            {p.luck || p.strength ? (
              <Stat
                label={t('profile.skills')}
                value={t('profile.luck', { n: fmtNum(p.luck, 1) })}
                sub={t('profile.strength', { n: fmtNum(p.strength, 1) })}
              />
            ) : null}
          </div>
          <div style={{ margin: '1rem 0' }}>
            <Bar value={p.speciesCount} total={data.meta.totalSpecies} />
          </div>
          {owned.length ? (
            <div className="ufs-spotcard" style={{ marginBottom: '.9rem' }}>
              <h3>{t('stats.ownedGear')}</h3>
              <div className="ufs-row" style={{ gap: '.35rem', flexWrap: 'wrap' }}>
                {owned.map((c) => (
                  <span key={c} className="ufs-chip">
                    {categoryLabel(c, t) + ': ' + p.owned![c]}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {p.sets?.length ? (
            <div className="ufs-spotcard" style={{ marginBottom: '.9rem' }}>
              <h3>{t('stats.tabSets')}</h3>
              <RodSets sets={p.sets} />
            </div>
          ) : null}
          <Skills skills={p.skills ?? []} points={p.skillPoints ?? 0} />
        </>
      ) : null}

      {tab === 'reviere' ? (
        <div className="ufs-spotcard">
          <h3>{t('profile.progressPerFishery')}</h3>
          <div className="ufs-scroll">
            <table className="ufs-rec">
              <thead>
                <tr>
                  <th>{t('stats.colFishery')}</th>
                  <th>{t('nav.species')}</th>
                  <th>{t('overview.colProgress')}</th>
                  <th>{t('stats.catches')}</th>
                  <th>{t('stats.bites')}</th>
                  <th>{t('profile.colWeight')}</th>
                  <th>{t('stats.colTime')}</th>
                  <th>{t('stats.points')}</th>
                  <th>{t('stats.heaviest')}</th>
                  <th>{t('stats.longest')}</th>
                </tr>
              </thead>
              <tbody>
                {fish.map((f) => (
                  <tr key={f.id}>
                    <td className={cn('n', f.total > 0 && f.done === f.total && 'done')}>
                      {f.name}
                      <span className="hint">{f.water}</span>
                    </td>
                    <td className="num">{f.done + ' / ' + f.total}</td>
                    <td style={{ minWidth: '110px' }}>
                      <Bar value={f.done} total={f.total || 1} thin />
                    </td>
                    <td className="num">{fmtNum(f.fish)}</td>
                    <td className="num">{fmtNum(f.bites)}</td>
                    <td className="num">{fmtNum(f.weight, 1) + ' kg'}</td>
                    <td className="num">{f.time ? fmtTime(f.time) : DASH}</td>
                    <td className="num">{fmtNum(f.score)}</td>
                    <td className="num">{f.bigW ? f.bigW.toFixed(2) + ' kg' : DASH}</td>
                    <td className="num">{f.bigL ? Math.round(f.bigL * 100) + ' cm' : DASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'arten' ? (
        <div className="ufs-spotcard">
          <div
            className="ufs-row"
            style={{ justifyContent: 'space-between', marginBottom: '.7rem', flexWrap: 'wrap' }}
          >
            <h3 style={{ margin: 0 }}>{t('profile.recordsPerSpecies')}</h3>
            <div className="ufs-row no-print" style={{ gap: '.35rem', flexWrap: 'wrap' }}>
              {SORTS.map((s) => (
                <Toggle key={s.key} active={sort === s.key} onClick={() => setSort(s.key)}>
                  {t(s.label)}
                </Toggle>
              ))}
            </div>
          </div>
          <div className="ufs-scroll">
            <table className="ufs-rec">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('stats.colSpecies')}</th>
                  <th>{t('profile.sortCount')}</th>
                  <th>{t('profile.sortBest')}</th>
                  <th>{t('profile.colBestLength')}</th>
                  <th>{t('stats.totalWeight')}</th>
                  <th>{t('profile.colAvgPerPiece')}</th>
                  <th>{t('profile.colRecordFrom')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.k}>
                    <td className="sub">{i + 1}</td>
                    <td className="n">{r.name}</td>
                    <td className="num">{fmtNum(r.count)}</td>
                    <td className="num">{r.best ? r.best.toFixed(2) + ' kg' : DASH}</td>
                    <td className="num">{r.length ? Math.round(r.length * 100) + ' cm' : DASH}</td>
                    <td className="num">{fmtNum(r.sum, 1) + ' kg'}</td>
                    <td className="num">
                      {r.count ? (r.sum / r.count).toFixed(2) + ' kg' : DASH}
                    </td>
                    <td className="sub">{r.where || DASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length ? (
            <p className="ufs-muted" style={{ fontSize: '12px' }}>
              {t('profile.noSpeciesYet')}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'offen' ? (
        <div>
          {fish
            .filter((f) => f.missing.length)
            .map((f) => (
              <div key={f.id} className="ufs-spotcard" style={{ marginBottom: '.7rem' }}>
                <h3>
                  {f.name} <span className="ufs-muted">{t('profile.nOpen', { n: f.missing.length })}</span>
                </h3>
                <div className="ufs-row" style={{ gap: '.35rem', flexWrap: 'wrap' }}>
                  {f.missing.map((k) => (
                    <span key={k} className="ufs-chip">
                      {speciesName(k, lang)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  )
}

export default ProfileDetails
