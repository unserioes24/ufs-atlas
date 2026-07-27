/**
 * Everything the save file knows about the player, in three tables.
 *
 * Nothing here comes from the guide: the numbers are read straight out of the
 * PROFILE file in the browser. The account bar sits at the top of this page
 * rather than in the header, because loading a save file and signing in are the
 * two things that only matter once you are looking at your own figures.
 */
import { useState } from 'react'
import { GUIDE, SPECIES, speciesName } from '../../data'
import { useI18n } from '../../i18n'
import type { Key } from '../../i18n'
import { DASH, fmtNum, fmtTime } from '../../lib/format'
import { categoryLabel } from '../../lib/gear'
import { fisheryLabel } from '../../lib/savegame'
import type { SaveStats } from '../../types'
import { Icon, Stat } from '../primitives'
import { Toggle } from '../ui'
import { RodSets } from '../profile/RodSets'
import { Skills } from './Skills'

const TABS = {
  fische: 'arten',
  arten: 'arten',
  sets: 'sets',
  vergleich: 'vergleich',
  reviere: 'reviere',
} as const

export interface StatsPageProps {
  /** What the import left behind in the browser, otherwise null. */
  stats: SaveStats | null
  tab?: string
  me: { name: string } | null
  apiAvailable: boolean
  onImport: () => void
  onReset: () => void
  onOpenCommunity: () => void
  onOpenMap: (id: string) => void
  onOpenSpecies: (key: string) => void
}

export function StatsPage({
  stats,
  tab: initialTab,
  me,
  apiAvailable,
  onImport,
  onReset,
  onOpenCommunity,
  onOpenMap,
  onOpenSpecies,
}: StatsPageProps) {
  const { t, lang } = useI18n()
  const [tab, setTab] = useState<string>(
    TABS[initialTab as keyof typeof TABS] ?? 'reviere',
  )

  const bar = (
    <div className="ufs-row" style={{ marginBottom: '1rem' }}>
      <button className="ufs-btn primary" onClick={onImport}>
        <Icon name="import" />
        {t('stats.loadSave')}
      </button>
      {stats?.player ? (
        <button
          className="ufs-btn danger"
          onClick={() => {
            if (confirm(t('stats.resetAsk'))) onReset()
          }}
        >
          {t('stats.reset')}
        </button>
      ) : null}
      {apiAvailable ? (
        me ? (
          <span className="ufs-chip">{t('stats.signedInAs', { name: me.name })}</span>
        ) : (
          <button className="ufs-btn" onClick={onOpenCommunity}>
            <Icon name="star" />
            {t('nav.login')}
          </button>
        )
      ) : null}
    </div>
  )

  if (!stats?.player) {
    return (
      <div>
        {bar}
        <div className="ufs-spotcard">
          <h3>{t('stats.emptyTitle')}</h3>
          <p
            className="ufs-muted"
            style={{ fontSize: '12.5px', lineHeight: 1.6, margin: '.3rem 0 .9rem' }}
          >
            {t('stats.emptyText')}
          </p>
          {apiAvailable && !me ? (
            <p className="ufs-muted" style={{ fontSize: '12px', marginTop: '.9rem' }}>
              {t('stats.emptyAccount')}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  const p = stats.player
  const fRows = Object.keys(stats.fisheries)
    .map((id) => {
      const m = GUIDE.maps.find((x) => x.id === id)
      return { id, name: m ? m.name : id, st: stats.fisheries[id]! }
    })
    .sort((a, b) => b.st.fish - a.st.fish)

  const totals = fRows.reduce(
    (a, r) => ({
      fish: a.fish + r.st.fish,
      bites: a.bites + r.st.bites,
      time: a.time + r.st.time,
      weight: a.weight + r.st.weight,
      score: a.score + r.st.score,
    }),
    { fish: 0, bites: 0, time: 0, weight: 0, score: 0 },
  )

  const sRows = Object.keys(stats.bests)
    .map((k) => {
      const sp = SPECIES[k] ?? {}
      const b = stats.bests[k]!
      return { key: k, sp, b, pct: b.weight && sp.wMax ? Math.min(1, b.weight / sp.wMax) : 0 }
    })
    .sort((a, b) => (b.b.weight || 0) - (a.b.weight || 0))

  const rate = (hit: number, of: number) =>
    of ? Math.round((hit / of) * 100) + ' %' : DASH

  return (
    <div>
      {bar}
      <div className="ufs-statgrid">
        <Stat label={t('stats.angler')} value={p.name || DASH} sub={t('stats.level') + ' ' + p.level} />
        <Stat label={t('stats.points')} value={fmtNum(p.score)} sub={t('stats.xp', { n: fmtNum(p.exp) })} />
        <Stat
          label={t('stats.money')}
          value={fmtNum(p.money)}
          sub={t('stats.luckStrength', {
            luck: Math.round(p.luck * 100),
            strength: Math.round(p.strength * 100),
          })}
        />
        <Stat
          label={t('stats.catchesTotal')}
          value={fmtNum(totals.fish)}
          sub={t('stats.bitesN', { n: fmtNum(totals.bites) })}
        />
        <Stat
          label={t('stats.caughtWeight')}
          value={fmtNum(totals.weight, 1) + ' kg'}
          sub={
            totals.bites
              ? t('stats.hitRate', { pct: Math.round((totals.fish / totals.bites) * 100) })
              : DASH
          }
        />
        <Stat
          label={t('stats.time')}
          value={fmtTime(totals.time)}
          sub={t('stats.speciesCaught', { n: stats.total })}
        />
      </div>

      <div className="ufs-row" style={{ margin: '1rem 0 .8rem' }}>
        <Toggle active={tab === 'reviere'} onClick={() => setTab('reviere')}>
          {t('stats.tabFisheries')}
        </Toggle>
        <Toggle active={tab === 'arten'} onClick={() => setTab('arten')}>
          {t('stats.tabBiggest')}
        </Toggle>
        <Toggle active={tab === 'sets'} onClick={() => setTab('sets')}>
          {t('stats.tabSets')}
        </Toggle>
      </div>

      {tab === 'sets' ? (
        <div>
          <RodSets sets={p.sets} />
          {!p.sets?.length ? (
            <div className="ufs-note">{t('stats.noSets')}</div>
          ) : (
            <div
              className="ufs-muted"
              style={{ fontSize: '11.5px', marginTop: '.7rem', lineHeight: 1.55 }}
            >
              {t('stats.setsHint')}
            </div>
          )}
          {p.owned && Object.keys(p.owned).length ? (
            <div className="ufs-spotcard" style={{ marginTop: '.9rem' }}>
              <h3>{t('stats.ownedGear')}</h3>
              <div className="ufs-row">
                {Object.keys(p.owned)
                  .sort((a, b) => p.owned[b]! - p.owned[a]!)
                  .map((c) => (
                    <span key={c} className="ufs-chip">
                      {categoryLabel(c, t as (k: Key) => string) + ': ' + p.owned[c]}
                    </span>
                  ))}
              </div>
            </div>
          ) : null}
          <Skills skills={p.skills ?? []} points={p.skillPoints ?? 0} />
        </div>
      ) : null}

      {tab === 'reviere' ? (
        <div className="ufs-spotcard">
          <table className="ufs-rec">
            <thead>
              <tr>
                <th>{t('stats.colFishery')}</th>
                <th>{t('stats.colFish')}</th>
                <th>{t('stats.bites')}</th>
                <th>{t('stats.colRate')}</th>
                <th>{t('stats.colTime')}</th>
                <th>{t('stats.colWeight')}</th>
                <th>{t('stats.colBiggest')}</th>
                <th>{t('stats.points')}</th>
              </tr>
            </thead>
            <tbody>
              {fRows.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => onOpenMap(r.id)}>
                  <td className="n">{r.name}</td>
                  <td className="num">{fmtNum(r.st.fish)}</td>
                  <td className="num">{fmtNum(r.st.bites)}</td>
                  <td className="num">{rate(r.st.fish, r.st.bites)}</td>
                  <td className="num">{fmtTime(r.st.time)}</td>
                  <td className="num">{fmtNum(r.st.weight, 1) + ' kg'}</td>
                  <td className="num">
                    {r.st.bigW
                      ? r.st.bigW.toFixed(2) + ' kg · ' + Math.round(r.st.bigL * 100) + ' cm'
                      : DASH}
                  </td>
                  <td className="num">{fmtNum(r.st.score)}</td>
                </tr>
              ))}
              <tr>
                <td className="n">{t('stats.sum')}</td>
                <td className="num">{fmtNum(totals.fish)}</td>
                <td className="num">{fmtNum(totals.bites)}</td>
                <td className="num">{rate(totals.fish, totals.bites)}</td>
                <td className="num">{fmtTime(totals.time)}</td>
                <td className="num">{fmtNum(totals.weight, 1) + ' kg'}</td>
                <td className="num" />
                <td className="num">{fmtNum(totals.score)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : tab === 'arten' ? (
        <div className="ufs-spotcard">
          <table className="ufs-rec">
            <thead>
              <tr>
                <th>{t('stats.colSpecies')}</th>
                <th>{t('stats.colYourRecord')}</th>
                <th>{t('stats.colPossible')}</th>
                <th>{t('stats.colShare')}</th>
                <th>{t('stats.colCatches')}</th>
                <th>{t('stats.colTotal')}</th>
                <th>{t('stats.colRecordFishery')}</th>
              </tr>
            </thead>
            <tbody>
              {sRows.map((r) => (
                <tr key={r.key} style={{ cursor: 'pointer' }} onClick={() => onOpenSpecies(r.key)}>
                  <td className="n done">{speciesName(r.key, lang)}</td>
                  <td className="num">
                    {(r.b.weight ? r.b.weight.toFixed(2) + ' kg' : DASH) +
                      (r.b.length ? ' · ' + Math.round(r.b.length * 100) + ' cm' : '')}
                  </td>
                  <td className="num">{r.sp.wMax ? r.sp.wMax + ' kg' : DASH}</td>
                  <td>
                    {r.pct ? (
                      <div className="ufs-recbar" title={Math.round(r.pct * 100) + ' %'}>
                        <span style={{ width: r.pct * 100 + '%' }} />
                      </div>
                    ) : (
                      <span className="sub">{DASH}</span>
                    )}
                  </td>
                  <td className="num">{fmtNum(r.b.count)}</td>
                  <td className="num">{r.b.sum ? fmtNum(r.b.sum, 1) + ' kg' : DASH}</td>
                  <td className="sub">{fisheryLabel(r.b.fishery) || DASH}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

export default StatsPage
