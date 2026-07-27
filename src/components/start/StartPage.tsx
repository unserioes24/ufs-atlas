import { useMemo } from 'react'
import { BAITS, FISHERIES, GUIDE, HOOKS, SPECIES, speciesName } from '../../data'
import { fmtNum } from '../../lib/format'
import { useI18n } from '../../i18n'
import { BiteCurve, Icon } from '../primitives'

/**
 * The landing page.
 *
 * Its opening is not a picture but a wall of bite curves — the very curve the
 * game carries for every species and this atlas reads out. Clicking one opens
 * that species. Everything below stays deliberately quiet.
 */

/** Twelve species whose curves differ clearly from one another. */
const WALL = [
  'PIKE',
  'MIRROR_CARP',
  'RAINBOW_TROUT',
  'WELS_CATFISH',
  'ZANDER',
  'PERCH',
  'BREAM',
  'TENCH',
  'ATLANTIC_SALMON',
  'BARBEL',
  'ARAPAIMA',
  'GREENLAND_SHARK',
]

const GITHUB = 'https://github.com/unserioes24/ufs-atlas'

export function StartPage({ onOpenSpecies }: { onOpenSpecies: (key: string) => void }) {
  const { t, lang } = useI18n()

  const wall = useMemo(() => {
    const seen = new Set<string>()
    const out: Array<{ key: string; act: Array<[number, number]> }> = []
    for (const key of WALL) {
      const s = SPECIES[key]
      if (s?.act && !seen.has(key)) {
        seen.add(key)
        out.push({ key, act: s.act })
      }
    }
    for (const [key, s] of Object.entries(SPECIES)) {
      if (out.length >= 12 || seen.has(key) || !s.act) continue
      seen.add(key)
      out.push({ key, act: s.act })
    }
    return out.slice(0, 12)
  }, [])

  const counts = useMemo(() => {
    let withAct = 0
    for (const s of Object.values(SPECIES)) if (s.act) withAct++
    let spots = 0
    let dots = 0
    for (const f of Object.values(FISHERIES)) {
      spots += f.spots?.length ?? 0
      dots += f.dots?.length ?? 0
    }
    return {
      maps: GUIDE.maps.length,
      species: Object.keys(SPECIES).length,
      baits: Object.keys(BAITS).length,
      act: withAct,
      spots,
      dots,
      steps: HOOKS?.steps ?? 18,
    }
  }, [])

  const features: Array<{ title: string; text: string; href: string; cta: string }> = [
    {
      title: t('start.mapsTitle'),
      text: t('start.mapsText', { maps: counts.maps }),
      href: '#gesamt',
      cta: t('start.mapsCta'),
    },
    {
      title: t('start.speciesTitle'),
      text: t('start.speciesText', { species: counts.species }),
      href: '#arten',
      cta: t('start.speciesCta'),
    },
    {
      title: t('start.baitsTitle'),
      text: t('start.baitsText'),
      href: '#koeder',
      cta: t('start.baitsCta'),
    },
    {
      title: t('start.sizesTitle'),
      text: t('start.sizesText', { steps: counts.steps }),
      href: '#arten',
      cta: t('start.sizesCta'),
    },
    {
      title: t('start.saveTitle'),
      text: t('start.saveText'),
      href: '#statistik',
      cta: t('start.saveCta'),
    },
    {
      title: t('start.profileTitle'),
      text: t('start.profileText'),
      href: '#anmelden',
      cta: t('start.profileCta'),
    },
    {
      title: t('start.groupsTitle'),
      text: t('start.groupsText'),
      href: '#gruppen',
      cta: t('start.groupsCta'),
    },
    {
      title: t('start.offlineTitle'),
      text: t('start.offlineText'),
      href: '#gesamt',
      cta: t('start.offlineCta'),
    },
  ]

  const facts: Array<[number, string]> = [
    [counts.maps, t('start.factFisheries')],
    [counts.species, t('start.factSpecies')],
    [counts.spots, t('start.factSpots')],
    [counts.dots, t('start.factShoals')],
    [counts.baits, t('start.factBaits')],
    [counts.act, t('start.factCurves')],
  ]

  return (
    <div className="ufs-start">
      <section className="hero">
        <p className="eyebrow">{t('start.eyebrow')}</p>
        <h1>{t('start.headline')}</h1>
        <p className="lead">{t('start.lead')}</p>
        <div className="ufs-row" style={{ gap: '.5rem' }}>
          <a className="ufs-btn primary" href="#gesamt">
            <Icon name="map" />
            {t('start.ctaMaps')}
          </a>
          <a className="ufs-btn" href="#arten">
            <Icon name="fish" />
            {t('start.ctaSpecies')}
          </a>
          <a className="ufs-btn" href="#statistik">
            <Icon name="import" />
            {t('start.ctaSave')}
          </a>
        </div>

        <div className="wall">
          <div className="wallhd">
            <span>{t('start.wallTitle')}</span>
            <span className="sub">{t('start.wallHint')}</span>
          </div>
          <div className="grid">
            {wall.map((e) => (
              <button
                key={e.key}
                type="button"
                className="cell"
                title={speciesName(e.key, lang)}
                onClick={() => onOpenSpecies(e.key)}
              >
                <BiteCurve act={e.act} height={40} />
                <span className="nm">{speciesName(e.key, lang)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="facts">
        {facts.map(([n, label]) => (
          <div key={label} className="fact">
            <span className="n">{fmtNum(n)}</span>
            <span className="l">{label}</span>
          </div>
        ))}
      </section>

      <section>
        <h2>{t('start.featuresTitle')}</h2>
        <div className="cards">
          {features.map((f) => (
            <div key={f.title} className="card">
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <a className="go" href={f.href}>
                {f.cta} →
              </a>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>{t('start.sourcesTitle')}</h2>
        <div className="two">
          <div className="card">
            <h3>{t('start.fromGame')}</h3>
            <ul>
              <li>{t('start.fromGame1')}</li>
              <li>{t('start.fromGame2')}</li>
              <li>{t('start.fromGame3')}</li>
              <li>{t('start.fromGame4')}</li>
              <li>{t('start.fromGame5')}</li>
              <li>{t('start.fromGame6')}</li>
            </ul>
          </div>
          <div className="card">
            <h3>{t('start.fromCommunity')}</h3>
            <ul>
              <li>{t('start.fromCommunity1')}</li>
              <li>{t('start.fromCommunity2')}</li>
              <li>{t('start.fromCommunity3')}</li>
            </ul>
            <p className="note">{t('start.communityNote')}</p>
          </div>
        </div>
      </section>

      <section className="oss">
        <div>
          <h2>{t('start.openTitle')}</h2>
          <p>{t('start.openText')}</p>
        </div>
        <a className="ufs-btn primary" href={GITHUB} target="_blank" rel="noopener noreferrer">
          <Icon name="source" />
          {t('start.openCta')}
        </a>
      </section>

      <p className="foot">{t('start.footer', { guide: GUIDE.generated, game: '' })}</p>
    </div>
  )
}

export default StartPage
