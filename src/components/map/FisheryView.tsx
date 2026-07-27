/**
 * One fishery: header, map, the species beside it, the filter bar and a card
 * per species.
 *
 * Two sources are merged here. The guide rows carry the researched entries; the
 * game files add every species that stands in the scene but has not been
 * written up yet. Those get placeholder text instead of guide prose, and say so
 * with a badge.
 */
import { useMemo, useState } from 'react'
import { FISHERIES, GUIDE, SPECIES, speciesKey, speciesName } from '../../data'
import { useI18n } from '../../i18n'
import { DASH, cn } from '../../lib/format'
import type { BestCatch, FisherySpecies, GuideFish, GuideMap } from '../../types'
import { FishCard } from '../species/FishCard'
import { Badge, Icon, Mini, Select } from '../primitives'
import { Bar } from '../primitives'
import { Toggle } from '../ui'
import { FisheryMap, SpotPanel } from './FisheryMap'

/** Background wash per fishery, keyed by the accent the guide gives it. */
const ACCENT: Record<string, string> = {
  cyan: 'from-cyan-400/20 via-blue-500/10 to-transparent',
  sky: 'from-sky-400/20 via-cyan-500/10 to-transparent',
  amber: 'from-amber-400/20 via-orange-500/10 to-transparent',
  emerald: 'from-emerald-400/20 via-teal-500/10 to-transparent',
  blue: 'from-blue-400/20 via-indigo-500/10 to-transparent',
  indigo: 'from-indigo-400/20 via-violet-500/10 to-transparent',
  lime: 'from-lime-400/20 via-emerald-500/10 to-transparent',
  teal: 'from-teal-400/20 via-cyan-500/10 to-transparent',
  orange: 'from-orange-400/20 via-rose-500/10 to-transparent',
  rose: 'from-rose-400/20 via-pink-500/10 to-transparent',
  violet: 'from-violet-400/20 via-fuchsia-500/10 to-transparent',
  fuchsia: 'from-fuchsia-400/20 via-violet-500/10 to-transparent',
  yellow: 'from-yellow-400/20 via-amber-500/10 to-transparent',
  slate: 'from-slate-400/20 via-cyan-500/10 to-transparent',
  zinc: 'from-zinc-400/20 via-blue-500/10 to-transparent',
  green: 'from-green-400/20 via-emerald-500/10 to-transparent',
  pink: 'from-pink-400/20 via-rose-500/10 to-transparent',
  red: 'from-red-400/20 via-orange-500/10 to-transparent',
  stone: 'from-stone-400/15 via-slate-500/10 to-transparent',
}

const ALL = 'Alle'
const CONFIDENCES = [ALL, 'hoch', 'mittel', 'niedrig'] as const
const CATCH_FILTERS = [ALL, 'offen', 'gefangen'] as const

interface Row {
  f: GuideFish
  key: string | null
  game: FisherySpecies | null
  gameOnly: boolean
}

interface PanelEntry {
  s: string
  fish: number | null
  spots: number[]
  guideOnly: boolean
  dlc: boolean | string | null
  hint?: string
}

export interface FisheryViewProps {
  map: GuideMap
  query: string
  caught: Record<string, boolean>
  bests: Record<string, BestCatch>
  favorites: string[]
  onToggleFav: (id: string) => void
  onToggleCatch: (key: string) => void
  onSources: () => void
  selectedSpot: number | null
  onSelectSpot: (n: number | null) => void
  /** The strip of maps on narrow screens picks a fishery directly. */
  onPickMap: (id: string) => void
}

export function FisheryView({
  map,
  query,
  caught,
  bests,
  favorites,
  onToggleFav,
  onToggleCatch,
  onSources,
  selectedSpot,
  onSelectSpot,
  onPickMap,
}: FisheryViewProps) {
  const { t, lang } = useI18n()
  const [method, setMethod] = useState<string>(ALL)
  const [confidence, setConfidence] = useState<string>(ALL)
  const [catchFilter, setCatchFilter] = useState<string>(ALL)
  const [onlyFav, setOnlyFav] = useState(false)
  const [showDlc, setShowDlc] = useState(true)
  const [compact, setCompact] = useState(false)
  const [pinned, setPinned] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)

  const fishery = FISHERIES[map.id] ?? null

  /* The guide entries of this map, plus species that only the game files hold. */
  const rows: Row[] = useMemo(() => {
    const gameByKey: Record<string, FisherySpecies> = {}
    for (const g of fishery?.species ?? []) gameByKey[g.s] = g

    const used = new Set<string>()
    const list: Row[] = GUIDE.fish
      .filter((f) => f.mapId === map.id)
      .map((f) => {
        const key = speciesKey(f.name, f.de, f.mapId)
        if (key) used.add(key)
        return { f, key, game: key ? (gameByKey[key] ?? null) : null, gameOnly: false }
      })

    for (const g of fishery?.species ?? []) {
      if (used.has(g.s)) continue
      const sp = SPECIES[g.s] ?? {}
      list.push({
        key: g.s,
        game: g,
        gameOnly: true,
        f: {
          id: map.id + '-game-' + g.s.toLowerCase(),
          mapId: map.id,
          name: sp.en || g.s,
          de: sp.de || sp.en || g.s,
          spots: g.spots?.length
            ? t('gameOnly.spots', { list: g.spots.join(', ') })
            : t('gameOnly.seeMap'),
          hook: t('gameOnly.hook'),
          bait: '—',
          groundbait: '—',
          depth: t('gameOnly.depth'),
          method: t('gameOnly.method'),
          retrieve: '—',
          time: 'Keine feste Zeit belegt',
          notes: t('gameOnly.notes'),
          confidence: 'hoch',
          sources: [],
          dlc: null,
          tags: [],
        },
      })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id, fishery, lang])

  const methods = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) for (const m of r.f.method.split(' / ')) set.add(m)
    return [ALL, ...[...set].sort()]
  }, [rows])

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const f = r.f
        if (query) {
          const hay = (
            Object.values(f).join(' ') +
            ' ' +
            (r.key ?? '') +
            ' ' +
            (r.key ? speciesName(r.key, lang) : '')
          ).toLowerCase()
          if (!hay.includes(query.toLowerCase())) return false
        }
        if (method !== ALL && !f.method.includes(method)) return false
        if (confidence !== ALL && f.confidence !== confidence) return false
        if (onlyFav && !favorites.includes(f.id)) return false
        if (!showDlc && f.dlc === 'New Fish Species') return false
        if (catchFilter === 'offen' && r.key && caught[r.key]) return false
        if (catchFilter === 'gefangen' && !(r.key && caught[r.key])) return false
        if (pinned && r.key !== pinned) return false
        if (selectedSpot && !r.game?.spots?.includes(selectedSpot)) return false
        return true
      }),
    [
      rows, query, method, confidence, onlyFav, favorites, showDlc, catchFilter, caught,
      selectedSpot, pinned, lang,
    ],
  )

  const mapKeys = useMemo(() => [...new Set(rows.map((r) => r.key).filter(Boolean))] as string[], [rows])
  const mapDone = mapKeys.filter((k) => caught[k]).length

  /* The species beside the map: those in the scene, plus the guide-only ones
     (the New Fish Species DLC leaves no spawn points in the scene). */
  const panelList: PanelEntry[] = useMemo(() => {
    const out: PanelEntry[] = (fishery?.species ?? []).map((g) => ({
      s: g.s, fish: g.fish, spots: g.spots, guideOnly: false, dlc: !!g.dlc,
    }))
    const seen = new Set(out.map((o) => o.s))
    for (const r of rows) {
      if (!r.key || r.game || seen.has(r.key)) continue
      seen.add(r.key)
      out.push({ s: r.key, fish: null, spots: [], guideOnly: true, hint: r.f.spots, dlc: r.f.dlc })
    }
    return out
  }, [fishery, rows])

  const spot = fishery && selectedSpot ? fishery.spots.find((s) => s.n === selectedSpot) : null

  return (
    <>
      <div className="no-print scrollbar mb-4 flex gap-2 overflow-x-auto pb-2 lg:hidden">
        {GUIDE.maps.map((m) => (
          <button
            key={m.id}
            onClick={() => onPickMap(m.id)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-2 text-xs font-semibold',
              map.id === m.id
                ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100'
                : 'border-white/10 bg-white/[.04] text-slate-400',
            )}
          >
            {m.name}
          </button>
        ))}
      </div>

      <section
        className={cn(
          'noise relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br p-6 shadow-2xl lg:p-8',
          ACCENT[map.accent],
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/[.03] to-[#061017]/55" />
        <div className="relative grid gap-7 xl:grid-cols-[1fr_370px]">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge
                tone={
                  map.group === 'DLC' ? 'violet' : map.status === 'announced' ? 'slate' : 'cyan'
                }
              >
                {map.group}
              </Badge>
              <Badge>{map.region}</Badge>
              <Badge>{map.water}</Badge>
              {map.variant ? <Badge tone="amber">{map.variant}</Badge> : null}
            </div>
            <h1 className="max-w-4xl text-3xl font-black tracking-tight text-white sm:text-5xl">
              {map.name}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              {map.summary}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Mini label={t('map.style')} value={map.style} />
              <Mini
                label={t('nav.species')}
                value={
                  mapKeys.length
                    ? t('map.caughtOf', { done: mapDone, total: mapKeys.length })
                    : t('map.entries', { n: rows.length })
                }
              />
              <Mini
                label={t('map.spotsFromFiles')}
                value={fishery?.spots.length ? String(fishery.spots.length) : DASH}
              />
            </div>
            {mapKeys.length ? (
              <div style={{ marginTop: '.9rem', maxWidth: '520px' }}>
                <Bar value={mapDone} total={mapKeys.length} />
              </div>
            ) : null}
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-sm font-bold text-cyan-100">
              <Icon name="info" />
              {t('map.readHead')}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{t('map.readNote')}</p>
            <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[.07] p-3 text-xs leading-5 text-amber-100/80">
              {t('map.emptySpotNote')}
            </div>
          </div>
        </div>
      </section>

      {fishery ? (
        <section className="no-print mt-5 ufs-maplayout">
          <FisheryMap
            fishery={fishery}
            selected={selectedSpot}
            onSelect={onSelectSpot}
            caught={caught}
            highlight={pinned || highlight}
          />
          <div className="ufs-col">
            {spot ? (
              <SpotPanel spot={spot} caught={caught} />
            ) : (
              <div className="ufs-spotcard">
                <h3>{t('map.speciesHere')}</h3>
                <div className="ufs-splist">
                  {panelList.slice(0, 18).map((g) => (
                    <div
                      key={g.s}
                      className={cn('ufs-spline', pinned === g.s && 'pin')}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => {
                        if (!g.guideOnly) setHighlight(g.s)
                      }}
                      onMouseLeave={() => setHighlight(null)}
                      onClick={() => setPinned(pinned === g.s ? null : g.s)}
                    >
                      <span className={cn('n', caught[g.s] && 'done')}>
                        {(caught[g.s] ? '✓ ' : '') + speciesName(g.s, lang)}
                      </span>
                      <span className="q">
                        {g.guideOnly
                          ? t('map.guideOnly')
                          : g.dlc
                            ? t('map.dlcSpecies')
                            : t('map.fishHere', { n: g.fish ?? 0 })}
                      </span>
                      <span className="d">
                        {g.guideOnly
                          ? g.hint || DASH
                          : g.spots.length
                            ? t('map.spotList', { list: g.spots.slice(0, 4).join(', ') })
                            : g.dlc
                              ? t('map.spread')
                              : DASH}
                      </span>
                    </div>
                  ))}
                </div>
                {panelList.length > 18 ? (
                  <div className="ufs-muted" style={{ fontSize: '11px', marginTop: '.4rem' }}>
                    {t('map.morePanel', { n: panelList.length - 18 })}
                  </div>
                ) : null}
                {panelList.some((g) => g.guideOnly) ? (
                  <div
                    className="ufs-muted"
                    style={{ fontSize: '10.5px', marginTop: '.5rem', lineHeight: 1.5 }}
                  >
                    {t('map.guideOnlyNote')}
                  </div>
                ) : null}
              </div>
            )}
            {!fishery.fitOk ? (
              <div className="ufs-note" style={{ fontSize: '11.5px' }}>
                {/* Offshore fisheries carry no world coordinates for their spots:
                    there are no travel points, you take the boat out yourself. */}
                {fishery.spots.some((s) => s.wx !== undefined && s.wx !== null)
                  ? t('map.noProjection')
                  : t('map.boatOnly')}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="no-print mt-5 rounded-3xl border border-white/10 bg-white/[.025] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-slate-500">
            <Icon name="filter" />
            {t('map.filter')}
          </div>
          <Select
            value={method}
            onChange={setMethod}
            options={methods}
            labels={{ [ALL]: t('map.filterAll') }}
          />
          <Select
            value={confidence}
            onChange={setConfidence}
            options={CONFIDENCES}
            labels={{
              [ALL]: t('map.filterAll'),
              hoch: t('map.filterConfHigh'),
              mittel: t('map.filterConfMedium'),
              niedrig: t('map.filterConfLow'),
            }}
          />
          <Select
            value={catchFilter}
            onChange={setCatchFilter}
            options={CATCH_FILTERS}
            labels={{
              [ALL]: t('map.filterAllSpecies'),
              offen: t('map.filterOpen'),
              gefangen: t('map.filterCaught'),
            }}
          />
          <Toggle active={showDlc} onClick={() => setShowDlc(!showDlc)}>
            {t('map.dlcToggle')}
          </Toggle>
          <Toggle active={onlyFav} onClick={() => setOnlyFav(!onlyFav)}>
            <Icon name="star" />
            {t('map.favorites')}
          </Toggle>
          <Toggle active={compact} onClick={() => setCompact(!compact)}>
            {t('map.compact')}
          </Toggle>
          {selectedSpot ? (
            <Toggle active onClick={() => onSelectSpot(null)}>
              {t('map.onlySpot', { n: selectedSpot })}
            </Toggle>
          ) : null}
          {pinned ? (
            <Toggle active onClick={() => setPinned(null)}>
              {t('map.onlySpecies', { name: speciesName(pinned, lang) })}
            </Toggle>
          ) : null}
          <span className="ml-auto text-xs tabular-nums text-slate-500">
            {t('map.filterCount', { shown: filtered.length, total: rows.length })}
          </span>
        </div>
      </section>

      {map.status === 'announced' ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[.03] p-10 text-center text-slate-400">
          <div className="text-4xl">◌</div>
          <h2 className="mt-3 text-xl font-bold text-white">{t('map.announcedTitle')}</h2>
          <p className="mt-2">{t('map.announcedText')}</p>
        </div>
      ) : (
        <section className={cn('mt-6 grid gap-4', compact ? 'xl:grid-cols-2' : 'grid-cols-1')}>
          {filtered.map((r) => (
            <FishCard
              key={r.f.id}
              f={r.f}
              speciesKey={r.key}
              gameEntry={r.game}
              gameOnly={r.gameOnly}
              compact={compact}
              favorite={favorites.includes(r.f.id)}
              onFav={() => onToggleFav(r.f.id)}
              onSource={onSources}
              caught={caught}
              bests={bests}
              onToggleCatch={onToggleCatch}
              selectedSpot={selectedSpot}
              onPickSpot={(n) => onSelectSpot(selectedSpot === n ? null : n)}
            />
          ))}
          {!filtered.length ? (
            <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center text-slate-500">
              {t('map.noHits')}
            </div>
          ) : null}
        </section>
      )}

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.025] p-6 text-sm leading-7 text-slate-400">
        <h2 className="text-lg font-bold text-white">{t('map.hookAdviceTitle')}</h2>
        <p className="mt-2">{t('map.hookAdvice')}</p>
      </section>
    </>
  )
}


export default FisheryView
