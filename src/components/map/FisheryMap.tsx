/**
 * The map image of a fishery with the travel points on top.
 *
 * Both layers come out of the game files. The numbered spots are the travel
 * targets the map board offers; the small dots are the shoals, projected from
 * world coordinates onto the image. Some fisheries have no such projection —
 * there the spots are missing and the note takes over.
 */
import { useState } from 'react'
import { SPECIES, speciesName } from '../../data'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/format'
import { assetUrl } from '../../lib/route'
import type { Fishery, Spot } from '../../types'

export interface FisheryMapProps {
  fishery: Fishery
  caught: Record<string, boolean>
  /** Species to highlight: its spots turn green, the rest fade back. */
  highlight?: string | null
  selected: number | null
  onSelect: (n: number | null) => void
}

export function FisheryMap({
  fishery,
  caught,
  highlight = null,
  selected,
  onSelect,
}: FisheryMapProps) {
  const { t, lang } = useI18n()
  const [hover, setHover] = useState<number | null>(null)
  const [dotTip, setDotTip] = useState<{ s: string; u: number; v: number } | null>(null)
  const [showDots, setShowDots] = useState(false)

  const spots = fishery.spots.filter((s): s is Spot & { u: number; v: number } =>
    typeof s.u === 'number' && typeof s.v === 'number',
  )
  // No board, no coordinates: the offshore fisheries are fished from the boat
  // and the game shows no map there either.
  if (!fishery.map || !spots.length) {
    return <div className="ufs-note">{t('map.boatOnly')}</div>
  }

  const tip = hover !== null ? spots.find((s) => s.n === hover) : null
  const hasSpecies = (s: Spot) => (highlight ? s.fish.some((f) => f.s === highlight) : false)

  return (
    <div>
      <div className="ufs-map-wrap">
        <img src={assetUrl(fishery.map)} alt={t('map.alt')} loading="lazy" />
        <div className="ufs-map-layer">
          {showDots && fishery.dots
            ? fishery.dots.map((d, i) => (
                <div
                  key={'d' + i}
                  className={cn('ufs-dot', highlight && d[0] === highlight && 'hl')}
                  style={{ left: d[1] * 100 + '%', top: d[2] * 100 + '%' }}
                  title={speciesName(d[0], lang)}
                  onMouseEnter={() => setDotTip({ s: d[0], u: d[1], v: d[2] })}
                  onMouseLeave={() => setDotTip(null)}
                />
              ))
            : null}
          {dotTip
            ? (() => {
                const sp = SPECIES[dotTip.s] ?? {}
                return (
                  <div
                    className="ufs-tip small"
                    style={{ left: dotTip.u * 100 + '%', top: dotTip.v * 100 + '%' }}
                  >
                    <h4>{(caught[dotTip.s] ? '✓ ' : '') + speciesName(dotTip.s, lang)}</h4>
                    {sp.wMax ? (
                      <div className="sub">
                        {sp.wMin + '–' + sp.wMax + ' kg · ' + sp.lMin + '–' + sp.lMax + ' cm'}
                      </div>
                    ) : null}
                  </div>
                )
              })()
            : null}
          {spots.map((s) => (
            <div
              key={s.n}
              className={cn(
                'ufs-spot',
                selected === s.n && 'sel',
                highlight && (hasSpecies(s) ? 'hit' : 'dim'),
              )}
              style={{ left: s.u * 100 + '%', top: s.v * 100 + '%' }}
              onMouseEnter={() => setHover(s.n)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(selected === s.n ? null : s.n)}
              title={t('map.spotTitle', { n: s.n })}
            >
              {s.n}
            </div>
          ))}
          {tip ? (
            <div className="ufs-tip" style={{ left: tip.u * 100 + '%', top: tip.v * 100 + '%' }}>
              <h4>{t('map.spotHead', { n: tip.n })}</h4>
              {tip.fish.slice(0, 6).map((f) => (
                <div key={f.s} className="r">
                  <span style={caught[f.s] ? { color: '#6ee7b7' } : undefined}>
                    {(caught[f.s] ? '✓ ' : '') + speciesName(f.s, lang)}
                  </span>
                  <span>{f.f + '×'}</span>
                </div>
              ))}
              {tip.fish.length > 6 ? (
                <div className="more">{t('map.moreSpecies', { n: tip.fish.length - 6 })}</div>
              ) : null}
              {!tip.fish.length ? <div className="more">{t('map.noShoals')}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="ufs-map-legend">
        <span>{t('map.travelPoints', { n: spots.length })}</span>
        {fishery.dots?.length ? (
          <button
            className={cn('ufs-chip ufs-chip-btn', showDots && 'ufs-chip-on')}
            onClick={() => setShowDots(!showDots)}
          >
            {(showDots ? '✓ ' : '') + t('map.shoals', { n: fishery.dots.length })}
          </button>
        ) : null}
        {highlight ? (
          <span>{t('map.greenMarks', { name: speciesName(highlight, lang) })}</span>
        ) : (
          <span className="ufs-muted">{t('map.hoverHint')}</span>
        )}
        {selected ? (
          <button className="ufs-chip ufs-chip-btn" onClick={() => onSelect(null)}>
            {t('map.clearPick')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** The species a single spot has in range, with counts and distance. */
export function SpotPanel({ spot, caught }: { spot: Spot; caught: Record<string, boolean> }) {
  const { t, lang } = useI18n()
  return (
    <div className="ufs-spotcard">
      <h3>{t('map.spotPanelHead', { n: spot.n, count: spot.fish.length })}</h3>
      <div className="ufs-splist">
        {spot.fish.map((f) => {
          const sp = SPECIES[f.s] ?? {}
          return (
            <div key={f.s} className="ufs-spline">
              <span className={cn('n', caught[f.s] && 'done')}>
                {(caught[f.s] ? '✓ ' : '') + speciesName(f.s, lang)}
                {sp.wMax ? <span className="d">{'  ' + sp.wMin + '–' + sp.wMax + ' kg'}</span> : null}
              </span>
              <span className="q">{t('map.fishCount', { n: f.f })}</span>
              <span className="d">{f.d === 0 ? t('map.atSpot') : t('map.metres', { n: f.d })}</span>
            </div>
          )
        })}
      </div>
      {!spot.fish.length ? (
        <div className="ufs-muted" style={{ fontSize: '12px' }}>
          {t('map.noShoalsHere')}
        </div>
      ) : null}
    </div>
  )
}
