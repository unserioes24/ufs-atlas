/**
 * One card per species inside a fishery.
 *
 * Two sources meet here. The guide rows carry the community research, the game
 * files carry what could be read out. Where both have something to say, the
 * game files win: hook sizes, best time, best method and the bait list are
 * replaced by the extracted values, and the guide text stays as the fallback.
 */
import type { ReactNode } from 'react'
import { BAITS_FOR, GUIDE, HOOKS, SPECIES, baitName } from '../../data'
import type { BestCatch, FisherySpecies, GuideFish } from '../../types'
import { useI18n } from '../../i18n'
import { translateTerms } from '../../i18n/terms'
import { fitSteps, gapRange, stepRange } from '../../lib/hooks'
import { fisheryLabel } from '../../lib/savegame'
import { cn } from '../../lib/format'
import { Badge, Icon } from '../primitives'
import {
  Activity,
  BaitTop,
  BiteFactors,
  MethodList,
  RetrieveList,
  SizeFit,
  bestHours,
  methodTop,
  spinTop,
} from './facts'

/** The guide writes this exact sentence when no time of day stands out. */
const NO_FIXED_TIME = 'Keine feste Zeit belegt'

const BAIT_KIND_KEY = {
  natural: 'method.natural',
  boilie: 'method.boilie',
  fly: 'method.fly',
  lure: 'method.lure',
} as const

const CONFIDENCE = {
  hoch: ['fish.confHigh', 'green'],
  mittel: ['fish.confMedium', 'amber'],
  niedrig: ['fish.confLow', 'red'],
} as const

export function Confidence({ value }: { value: GuideFish['confidence'] }) {
  const { t } = useI18n()
  const [key, tone] = CONFIDENCE[value] ?? CONFIDENCE.mittel
  return <Badge tone={tone}>{t('fish.confidence', { level: t(key) })}</Badge>
}

function Fact({ icon, label, value }: { icon: string; label: string; value: ReactNode }) {
  return (
    <div className="bg-[#0b1821]/90 p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-slate-600">
        <Icon name={icon} />
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold leading-6 text-slate-200">{value}</div>
    </div>
  )
}

function Detail({ title, value }: { title: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <div className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-600">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-300">{value}</div>
    </div>
  )
}

export interface FishCardProps {
  f: GuideFish
  speciesKey: string | null
  gameEntry: FisherySpecies | null
  gameOnly: boolean
  compact: boolean
  favorite: boolean
  onFav: () => void
  onSource: () => void
  caught: Record<string, boolean>
  bests: Record<string, BestCatch>
  onToggleCatch: (key: string) => void
  selectedSpot: number | null
  onPickSpot: (n: number) => void
}

export function FishCard({
  f,
  speciesKey,
  gameEntry,
  gameOnly,
  compact,
  favorite,
  onFav,
  onSource,
  caught,
  bests,
  onToggleCatch,
  selectedSpot,
  onPickSpot,
}: FishCardProps) {
  const { t, lang } = useI18n()
  const sp = speciesKey ? SPECIES[speciesKey] : null
  const best = speciesKey ? bests[speciesKey] : null
  const done = speciesKey ? !!caught[speciesKey] : false
  const baits = speciesKey ? BAITS_FOR[speciesKey] ?? [] : []

  const spots = gameEntry?.spots?.length ? gameEntry.spots : null

  // Values from the game files that stand in for the guide's own figures.
  const hookIdx = sp?.wMax ? fitSteps(HOOKS?.hook, sp.wMin ?? 0, sp.wMax) : []
  const hookText = hookIdx.length ? stepRange(hookIdx) + '  ' + gapRange(hookIdx) : null
  const hours = sp?.act ? bestHours(sp.act, t('fish.allDay')) : null
  const top = sp?.spin ? spinTop(sp.spin) : null
  const mTop = sp?.m ? methodTop(sp.m) : null

  return (
    <article
      id={f.id}
      className="print-card group overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[.055] to-white/[.022] shadow-xl transition hover:border-cyan-300/25"
    >
      <div className="flex flex-wrap items-start gap-4 border-b border-white/10 p-5 lg:p-6">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-400/[.07] text-xl text-cyan-200">
          ◈
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* The names from the game files come first: for a few species the
                guide has no German name at all. */}
            <h2 className="text-xl font-black text-white">
              {lang === 'en' ? sp?.en || f.name : sp?.de || f.de || f.name}
            </h2>
            <span className="text-sm text-slate-500">
              {'· ' + (lang === 'en' ? sp?.de || f.de || f.name : sp?.en || f.name)}
            </span>
            {f.dlc ? <Badge tone="violet">{f.dlc}</Badge> : null}
            {gameOnly ? <Badge tone="cyan">{t('fish.gameOnly')}</Badge> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Confidence value={f.confidence} />
            <Badge>{f.method}</Badge>
            {f.time !== NO_FIXED_TIME ? <Badge tone="amber">{f.time}</Badge> : null}
          </div>
        </div>
        <div className="ufs-col" style={{ alignItems: 'flex-end' }}>
          {speciesKey ? (
            <button
              className={cn('ufs-catch', done && 'on')}
              onClick={() => onToggleCatch(speciesKey)}
              title={t('fish.markCaught')}
            >
              <span className="box">{done ? '✓' : ''}</span>
              {done ? t('fish.caught') : t('fish.open')}
            </button>
          ) : null}
          <button
            onClick={onFav}
            title={t('fish.favorite')}
            className={cn(
              'no-print rounded-xl border p-2 transition',
              favorite
                ? 'border-amber-300/30 bg-amber-300/10 text-amber-200'
                : 'border-white/10 text-slate-600 hover:text-amber-200',
            )}
          >
            <Icon name="star" />
          </button>
        </div>
      </div>

      <div
        className={cn(
          'grid gap-px bg-white/[.06]',
          compact ? 'grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4',
        )}
      >
        <Fact
          icon="map"
          label={t('fish.spot')}
          value={
            spots ? (
              <span className="ufs-row">
                {spots.map((n) => (
                  <button
                    key={n}
                    className={cn(
                      'ufs-chip ufs-chip-btn ufs-chip-spot',
                      selectedSpot === n && 'ufs-chip-on',
                    )}
                    onClick={() => onPickSpot(n)}
                  >
                    {t('fish.spotN', { n })}
                  </button>
                ))}
              </span>
            ) : (
              f.spots
            )
          }
        />
        <Fact icon="hook" label={t('fish.hook')} value={hookText || f.hook} />
        <Fact icon="star" label={t('fish.bestTime')} value={hours || f.time} />
        {mTop ? (
          <Fact
            icon="bait"
            label={t('fish.bestMethod')}
            value={
              <span>
                {mTop.rows.map((x) => t(x.name)).join(' / ')}
                <span className="ufs-muted" style={{ fontWeight: 400 }}>
                  {'  ' + mTop.value + ' %'}
                </span>
              </span>
            }
          />
        ) : null}
        <Fact
          icon="method"
          label={t('fish.bestRetrieve')}
          value={
            top ? (
              <span>
                {top.names.map((n) => t(n)).join(' / ')}
                <span className="ufs-muted" style={{ fontWeight: 400 }}>
                  {'  ' + Math.round(top.value * 100) + ' %'}
                </span>
              </span>
            ) : (
              translateTerms(f.method, lang)
            )
          }
        />
      </div>

      <div className={cn('grid gap-4 p-5 lg:p-6', compact ? '' : 'lg:grid-cols-2')}>
        {/* Baits as chips: the strongest per the prefab, not the guide's list. */}
        {baits.length ? (
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <div className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-600">
              {t('fish.baits')}
            </div>
            <div className="ufs-row" style={{ marginTop: '.5rem' }}>
              {baits.slice(0, 8).map((e) => (
                <span
                  key={e.bait.key}
                  className={cn('ufs-chip ufs-baitchip', e.bait.kind)}
                  title={t(BAIT_KIND_KEY[e.bait.kind as keyof typeof BAIT_KIND_KEY] ?? 'fish.baits')}
                >
                  {baitName(e.bait, lang)}
                  <b>{Math.round(e.v * 100) + ' %'}</b>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <Detail title={t('fish.baits')} value={translateTerms(f.bait, lang)} />
        )}
        <Detail title={t('fish.groundbait')} value={translateTerms(f.groundbait, lang)} />

        {sp ? (
          <div className={cn('ufs-gamebox', compact ? '' : 'lg:col-span-2')}>
            <div className="hd">{t('fish.fromGameFiles')}</div>
            <div className="ufs-stats">
              {sp.wMax ? (
                <span>
                  {t('fish.weight')}: <b>{sp.wMin + '–' + sp.wMax + ' kg'}</b>
                </span>
              ) : null}
              {sp.lMax ? (
                <span>
                  {t('fish.length')}: <b>{sp.lMin + '–' + sp.lMax + ' cm'}</b>
                </span>
              ) : null}
              {gameEntry?.points ? (
                <span>
                  {t('fish.shoalPoints')}: <b>{gameEntry.points}</b>
                </span>
              ) : null}
              {gameEntry?.fish ? (
                <span>
                  {t('fish.fishHere')}: <b>{gameEntry.fish}</b>
                </span>
              ) : null}
              {gameEntry?.dlc ? (
                <span>
                  <b>{t('fish.dlcSpecies')}</b> {t('fish.dlcNote')}
                </span>
              ) : null}
            </div>
            {sp.act ? (
              <div style={{ marginTop: '.6rem' }}>
                <Activity act={sp.act} />
              </div>
            ) : null}
            {HOOKS && sp.wMax ? (
              <div style={{ marginTop: '.7rem' }}>
                <div className="hd">{t('fish.sizes')}</div>
                <SizeFit sp={sp} />
              </div>
            ) : null}
            {sp.m ? (
              <div style={{ marginTop: '.7rem' }}>
                <div className="hd">{t('fish.method')}</div>
                <MethodList m={sp.m} />
              </div>
            ) : null}
            {speciesKey && baits.length ? (
              <div style={{ marginTop: '.7rem' }}>
                <div className="hd">{t('fish.baitInterest')}</div>
                <BaitTop speciesKey={speciesKey} />
              </div>
            ) : null}
            {sp.spin ? (
              <div style={{ marginTop: '.7rem' }}>
                <div className="hd">{t('fish.retrieve')}</div>
                <RetrieveList spin={sp.spin} />
              </div>
            ) : null}
            {sp.bite ? (
              <div style={{ marginTop: '.7rem' }}>
                <div className="hd">{t('fish.weather')}</div>
                <BiteFactors bite={sp.bite} />
              </div>
            ) : null}
            {best ? (
              <div className="ufs-stats" style={{ marginTop: '.6rem' }}>
                <span>
                  {t('fish.yourRecord')}:{' '}
                  <b>
                    {(best.weight ? best.weight.toFixed(2) + ' kg' : '–') +
                      (best.length ? ' · ' + Math.round(best.length * 100) + ' cm' : '')}
                  </b>
                </span>
                {best.count ? (
                  <span>
                    {t('fish.catches')}: <b>{best.count}</b>
                  </span>
                ) : null}
                {best.fishery ? (
                  <span>
                    {t('fish.recordFishery')}: <b>{fisheryLabel(best.fishery)}</b>
                  </span>
                ) : null}
              </div>
            ) : null}
            {sp.info ? (
              <p
                style={{
                  margin: '.6rem 0 0',
                  fontSize: '12px',
                  lineHeight: 1.65,
                  color: '#94a3b8',
                }}
              >
                {sp.info}
              </p>
            ) : null}
          </div>
        ) : null}

        {f.notes ? (
          <div
            className={cn(
              'rounded-2xl border border-white/10 bg-black/15 p-4 text-sm leading-6 text-slate-400',
              compact ? '' : 'lg:col-span-2',
            )}
          >
            <span className="font-bold text-slate-200">{t('fish.practiceNote')}</span>
            {f.notes}
          </div>
        ) : null}

        <div
          className={cn(
            'no-print flex flex-wrap items-center gap-2 text-xs text-slate-500',
            compact ? '' : 'lg:col-span-2',
          )}
        >
          {t('fish.sources')}
          {f.sources.map((s) => (
            <button
              key={s}
              onClick={onSource}
              className="rounded-lg border border-white/10 bg-white/[.035] px-2 py-1 hover:text-cyan-200"
            >
              {GUIDE.sources[s]?.type || s}
            </button>
          ))}
          {sp ? (
            <span className="ufs-chip">
              <Icon name="game" />
              {t('fish.gameFiles')}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}
