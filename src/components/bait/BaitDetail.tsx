/**
 * One bait on a page of its own: every species that wants it, strongest first.
 *
 * The percentages are the interest values out of the bait prefab, not an
 * estimate. A bait can carry well over a hundred species, which is exactly why
 * this needs a page rather than a fold-out inside the list.
 */
import { BAITS, baitName, speciesName } from '../../data'
import { useI18n } from '../../i18n'
import type { Key } from '../../i18n'
import { Badge } from '../primitives'

const KIND_LABEL: Record<string, Key> = {
  natural: 'method.natural',
  boilie: 'method.boilie',
  fly: 'method.fly',
  lure: 'method.lure',
}

/** The names the game itself uses for its lure types. */
export const TYPE_LABEL: Record<string, Key> = {
  SPINNER: 'baitType.spinner',
  SPOON: 'baitType.spoon',
  WOBBLER: 'baitType.wobbler',
  SOFT_BAIT: 'baitType.softBait',
  FLY: 'baitType.fly',
}

export const FLY_LABEL: Record<string, Key> = {
  DRY: 'baitType.flyDry',
  WET: 'baitType.flyWet',
  NYMPH: 'baitType.flyNymph',
  STREAMER: 'baitType.flyStreamer',
}

export interface BaitDetailProps {
  baitKey: string
  onBack: () => void
  onOpenSpecies: (key: string) => void
}

export function BaitDetail({ baitKey, onBack, onOpenSpecies }: BaitDetailProps) {
  const { t, lang } = useI18n()
  const bait = BAITS[baitKey]

  if (!bait) {
    return (
      <div>
        <button className="ufs-btn" onClick={onBack}>
          {t('app.back')}
        </button>
        <div className="ufs-note" style={{ marginTop: '.9rem' }}>
          {t('bait.unknown')}
        </div>
      </div>
    )
  }

  const entries = Object.entries(bait.fish)
    .map(([s, v]) => ({ s, v }))
    .sort((a, b) => b.v - a.v)

  return (
    <div>
      <div className="ufs-row no-print" style={{ marginBottom: '.9rem' }}>
        <button className="ufs-btn" onClick={onBack}>
          {t('bait.backToList')}
        </button>
      </div>

      <div className="ufs-spotcard">
        <div className="ufs-row" style={{ gap: '.6rem', marginBottom: '.3rem' }}>
          <h1 className="text-2xl font-black tracking-tight text-white" style={{ margin: 0 }}>
            {baitName(bait, lang)}
          </h1>
          <span className="ufs-muted">{lang === 'en' ? bait.de : bait.en}</span>
          {KIND_LABEL[bait.kind] ? <Badge tone="cyan">{t(KIND_LABEL[bait.kind]!)}</Badge> : null}
          {bait.type && TYPE_LABEL[bait.type] ? (
            <Badge tone="violet">{t(TYPE_LABEL[bait.type]!)}</Badge>
          ) : null}
          {bait.fly && FLY_LABEL[bait.fly] ? (
            <Badge tone="amber">{t(FLY_LABEL[bait.fly]!)}</Badge>
          ) : null}
        </div>
        <p className="ufs-muted" style={{ fontSize: '12.5px', margin: '.4rem 0 0' }}>
          {bait.noTable ? t('bait.noTableNote') : t('bait.speciesCount', { n: entries.length })}
        </p>
      </div>

      <div className="ufs-spotcard" style={{ marginTop: '.8rem' }}>
        <h3>{t('bait.interestTitle')}</h3>
        <div className="ufs-baitlist plain">
          {entries.map((e) => (
            <button
              key={e.s}
              type="button"
              className="row"
              onClick={() => onOpenSpecies(e.s)}
              title={t('bait.openSpecies')}
            >
              <span className="nm">{speciesName(e.s, lang)}</span>
              <span className="bar">
                <span style={{ width: `${Math.round(e.v * 100)}%` }} />
              </span>
              <span className="vl">{Math.round(e.v * 100)} %</span>
            </button>
          ))}
        </div>
        {!entries.length ? (
          <p className="ufs-muted" style={{ fontSize: '12.5px', margin: 0 }}>
            {bait.noTable ? t('bait.noTableNote') : t('bait.noSpecies')}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default BaitDetail
