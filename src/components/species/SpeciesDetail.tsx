/**
 * One species on a page of its own: what the game files hold about it, what the
 * guide adds, and where it stands.
 *
 * It used to unfold inside the list. A page of its own can be linked to and
 * indexed, and it has room for the curves without pushing the list around.
 */
import { BAITS_FOR, FISHERIES, GUIDE, HOOKS, SPECIES, speciesName } from '../../data'
import { useI18n } from '../../i18n'
import { translateTerms } from '../../i18n/terms'
import { DASH, cn, fmtNum } from '../../lib/format'
import type { BestCatch } from '../../types'
import { Badge, Icon } from '../primitives'
import { Activity, BaitTop, BiteFactors, MethodList, RetrieveList, SizeFit } from './facts'
import { SPECIES_GUIDE, topKeys } from './guideFacts'

export interface SpeciesDetailProps {
  speciesKey: string
  caught: Record<string, boolean>
  bests: Record<string, BestCatch>
  onBack: () => void
  onToggleCatch: (key: string) => void
  onOpenMap: (id: string) => void
}

export function SpeciesDetail({
  speciesKey,
  caught,
  bests,
  onBack,
  onToggleCatch,
  onOpenMap,
}: SpeciesDetailProps) {
  const { t, lang } = useI18n()
  const s = SPECIES[speciesKey]

  if (!s) {
    return (
      <div>
        <button className="ufs-btn" onClick={onBack}>
          {t('app.back')}
        </button>
        <div className="ufs-note" style={{ marginTop: '.9rem' }}>
          {t('species.unknown')}
        </div>
      </div>
    )
  }

  const g = SPECIES_GUIDE[speciesKey]
  const best = bests[speciesKey]
  const done = !!caught[speciesKey]

  // Every fishery the species stands in, per the game files.
  const where = Object.keys(FISHERIES).filter((id) =>
    FISHERIES[id]!.species.some((x) => x.s === speciesKey),
  )
  const mapName: Record<string, string> = {}
  for (const m of GUIDE.maps) mapName[m.id] = m.name

  return (
    <div>
      <div className="ufs-row no-print" style={{ marginBottom: '.9rem' }}>
        <button className="ufs-btn" onClick={onBack}>
          {t('species.backToList')}
        </button>
        <button
          className={cn('ufs-catch', done && 'on')}
          onClick={() => onToggleCatch(speciesKey)}
          title={t('fish.markCaught')}
        >
          <span className="box">{done ? '✓' : ''}</span>
          {done ? t('fish.caught') : t('fish.open')}
        </button>
      </div>

      <div className="ufs-spotcard">
        <div className="ufs-row" style={{ gap: '.6rem', marginBottom: '.3rem' }}>
          <h1 className="text-2xl font-black tracking-tight text-white" style={{ margin: 0 }}>
            {speciesName(speciesKey, lang)}
          </h1>
          <span className="ufs-muted">{lang === 'en' ? (s.de ?? '') : (s.en ?? '')}</span>
          {done ? <Badge tone="green">{t('fish.caught')}</Badge> : null}
        </div>

        <div className="ufs-stats" style={{ marginTop: '.5rem' }}>
          {s.wMax ? (
            <span>
              {t('fish.weight')}: <b>{`${fmtNum(s.wMin, 1)}–${fmtNum(s.wMax, 1)} kg`}</b>
            </span>
          ) : null}
          {s.lMax ? (
            <span>
              {t('fish.length')}: <b>{`${fmtNum(s.lMin)}–${fmtNum(s.lMax)} cm`}</b>
            </span>
          ) : null}
          {best?.weight ? (
            <span>
              {t('fish.yourRecord')}:{' '}
              <b>
                {best.weight.toFixed(2)} kg
                {best.length ? ` · ${Math.round(best.length * 100)} cm` : ''}
              </b>
            </span>
          ) : null}
          {best?.count ? (
            <span>
              {t('fish.catches')}: <b>{best.count}</b>
            </span>
          ) : null}
        </div>

        {s.info ? (
          <p style={{ margin: '.7rem 0 0', fontSize: '13px', lineHeight: 1.7, color: '#94a3b8' }}>
            {s.info}
          </p>
        ) : null}
      </div>

      <div className="ufs-spotcard" style={{ marginTop: '.8rem' }}>
        <h3>{t('species.fisheries')}</h3>
        {where.length ? (
          <div className="ufs-row" style={{ gap: '.35rem', flexWrap: 'wrap' }}>
            {where.map((id) => (
              <button
                key={id}
                className="ufs-chip ufs-chip-btn"
                onClick={() => onOpenMap(id)}
              >
                <Icon name="map" />
                {mapName[id] ?? id}
              </button>
            ))}
          </div>
        ) : (
          <p className="ufs-muted" style={{ fontSize: '12.5px', margin: 0 }}>
            {t('species.noSpawns')}
          </p>
        )}
      </div>

      <div className="ufs-two" style={{ marginTop: '.8rem' }}>
        {s.act ? (
          <div className="ufs-spotcard">
            <h3>{t('fish.bestTime')}</h3>
            <Activity act={s.act} />
          </div>
        ) : null}
        {s.bite ? (
          <div className="ufs-spotcard">
            <h3>{t('fish.weather')}</h3>
            <BiteFactors bite={s.bite} />
          </div>
        ) : null}
        {s.m ? (
          <div className="ufs-spotcard">
            <h3>{t('fish.bestMethod')}</h3>
            <MethodList m={s.m} />
          </div>
        ) : null}
        {s.spin ? (
          <div className="ufs-spotcard">
            <h3>{t('species.retrieve')}</h3>
            <RetrieveList spin={s.spin} />
          </div>
        ) : null}
        {(BAITS_FOR[speciesKey] ?? []).length ? (
          <div className="ufs-spotcard">
            <h3>{t('fish.baitInterest')}</h3>
            <BaitTop speciesKey={speciesKey} limit={10} />
          </div>
        ) : null}
        {HOOKS && s.wMax ? (
          <div className="ufs-spotcard">
            <h3>{t('fish.sizes')}</h3>
            <SizeFit sp={s} />
          </div>
        ) : null}
      </div>

      {g ? (
        <div className="ufs-spotcard" style={{ marginTop: '.8rem' }}>
          <h3>{t('species.fromGuide')}</h3>
          <div className="ufs-splist">
            {Object.keys(g.baits).length ? (
              <Row label={t('fish.baits')}>
                {topKeys(g.baits, 8)
                  .map((b) => translateTerms(b, lang))
                  .join(', ')}
              </Row>
            ) : null}
            {Object.keys(g.methods).length ? (
              <Row label={t('species.method')}>{topKeys(g.methods, 3).join(' · ')}</Row>
            ) : null}
            {Object.keys(g.hooks).length ? (
              <Row label={t('fish.hook')}>{topKeys(g.hooks, 3).join(' · ')}</Row>
            ) : null}
            {Object.keys(g.retrieves).length ? (
              <Row label={t('species.retrieve')}>
                {topKeys(g.retrieves, 3)
                  .map((b) => translateTerms(b, lang))
                  .join(' · ')}
              </Row>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ufs-spline">
      <span className="n">{label}</span>
      <span className="d" style={{ textAlign: 'right' }}>
        {children || DASH}
      </span>
    </div>
  )
}

export default SpeciesDetail
