import { useMemo, useState } from 'react'
import { BAITS_FOR, FISHERIES, GUIDE, HOOKS, SPECIES, speciesKey, speciesName } from '../../data'
import { useI18n } from '../../i18n'
import { cn, fmtNum } from '../../lib/format'
import type { BestCatch } from '../../types'
import { Toggle } from '../ui'
import { Activity, BaitTop, BiteFactors, MethodList, RetrieveList, SizeFit } from './facts'

/**
 * Every species in one list. The card shows the size range; opening it adds
 * everything the game files and the guide hold about it.
 */

interface GuideFacts {
  baits: Record<string, number>
  methods: Record<string, number>
  hooks: Record<string, number>
  retrieves: Record<string, number>
  maps: Record<string, boolean>
}

/** Guide entries collected per species across all fisheries. */
const SPECIES_GUIDE: Record<string, GuideFacts> = (() => {
  const out: Record<string, GuideFacts> = {}
  for (const f of GUIDE.fish) {
    const k = speciesKey(f.name, f.de, f.mapId)
    if (!k) continue
    const e = (out[k] ??= { baits: {}, methods: {}, hooks: {}, retrieves: {}, maps: {} })
    for (const raw of String(f.bait ?? '').split(/[,;/]| oder /)) {
      const b = raw.trim()
      if (b && b !== '—') e.baits[b] = (e.baits[b] ?? 0) + 1
    }
    if (f.method) e.methods[f.method] = (e.methods[f.method] ?? 0) + 1
    if (f.hook) e.hooks[f.hook] = (e.hooks[f.hook] ?? 0) + 1
    if (f.retrieve && f.retrieve !== '—') e.retrieves[f.retrieve] = (e.retrieves[f.retrieve] ?? 0) + 1
    e.maps[f.mapId] = true
  }
  return out
})()

function topKeys(obj: Record<string, number> | undefined, n = 6): string[] {
  return Object.keys(obj ?? {})
    .sort((a, b) => (obj?.[b] ?? 0) - (obj?.[a] ?? 0))
    .slice(0, n)
}

interface Props {
  caught: Record<string, boolean>
  bests: Record<string, BestCatch>
  initialOpen: string | null
  onOpen: (key: string | null) => void
  /** Translates a bait or retrieve name from the guide into German. */
  toGerman: (s: string) => string
}

export function SpeciesPage({ caught, bests, initialOpen, onOpen, toGerman }: Props) {
  const { t, lang } = useI18n()
  // Direct link to a species: prefill the search so its card sits on top.
  const [q, setQ] = useState(() =>
    initialOpen && SPECIES[initialOpen] ? speciesName(initialOpen, lang) : '',
  )
  const [open, setOpen] = useState<string | null>(initialOpen)
  const [onlyMissing, setOnlyMissing] = useState(false)

  const mapName = useMemo(() => {
    const out: Record<string, string> = {}
    for (const m of GUIDE.maps) out[m.id] = m.name
    return out
  }, [])

  const rows = useMemo(() => {
    const where: Record<string, string[]> = {}
    for (const [id, fy] of Object.entries(FISHERIES)) {
      for (const g of fy.species) (where[g.s] ??= []).push(id)
    }
    const needle = q.trim().toLowerCase()
    return Object.entries(SPECIES)
      .map(([key, sp]) => ({ key, sp, where: where[key] ?? [], guide: SPECIES_GUIDE[key] ?? null }))
      .filter((r) => {
        if (!r.sp.wMax && !r.where.length && !r.guide) return false
        if (onlyMissing && caught[r.key]) return false
        if (needle) {
          const hay = `${r.key} ${r.sp.de ?? ''} ${r.sp.en ?? ''}`.toLowerCase()
          if (!hay.includes(needle)) return false
        }
        return true
      })
      .sort((a, b) => speciesName(a.key, lang).localeCompare(speciesName(b.key, lang)))
  }, [q, onlyMissing, caught, lang])

  return (
    <div>
      <div className="ufs-row" style={{ marginBottom: '.9rem' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('species.searchPlaceholder')}
          className="rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50"
          style={{ minWidth: '220px' }}
        />
        <Toggle active={onlyMissing} onClick={() => setOnlyMissing(!onlyMissing)}>
          {t('species.onlyMissing')}
        </Toggle>
        <span className="ufs-muted" style={{ fontSize: '11.5px' }}>
          {t('species.count', { n: rows.length })}
        </span>
      </div>

      <div className="ufs-baitgrid">
        {rows.map((r) => {
          const s = r.sp
          const g = r.guide
          const isOpen = open === r.key
          const best = bests[r.key]

          return (
            <div
              key={r.key}
              className={cn('ufs-baitcard has', isOpen && 'open')}
              onClick={() => {
                const next = isOpen ? null : r.key
                setOpen(next)
                onOpen(next)
              }}
            >
              <div className="de">
                {caught[r.key] ? '✓ ' : ''}
                {speciesName(r.key, lang)}
              </div>
              <div className="en">{lang === 'en' ? (s.de ?? '') : (s.en ?? '')}</div>
              <div className="cnt">
                {s.wMax ? `${fmtNum(s.wMin, 1)}–${fmtNum(s.wMax, 1)} kg` : t('species.noSize')}
                {s.lMax ? ` · ${fmtNum(s.lMin)}–${fmtNum(s.lMax)} cm` : ''}
              </div>

              {isOpen ? (
                <div className="list" style={{ gridTemplateColumns: '1fr' }}>
                  <Line label={t('species.fisheries')}>
                    {r.where.length
                      ? r.where.map((w) => mapName[w] ?? w).join(', ')
                      : t('species.noSpawns')}
                  </Line>
                  {g && Object.keys(g.baits).length ? (
                    <Line label={t('fish.baits')}>
                      {topKeys(g.baits, 6)
                        .map((b) => (lang === 'de' ? toGerman(b) : b))
                        .join(', ')}
                    </Line>
                  ) : null}
                  {g && Object.keys(g.methods).length ? (
                    <Line label={t('species.method')}>{topKeys(g.methods, 3).join(' · ')}</Line>
                  ) : null}
                  {g && Object.keys(g.hooks).length ? (
                    <Line label={t('fish.hook')}>{topKeys(g.hooks, 3).join(' · ')}</Line>
                  ) : null}
                  {g && Object.keys(g.retrieves).length ? (
                    <Line label={t('species.retrieve')}>
                      {topKeys(g.retrieves, 2)
                        .map((b) => (lang === 'de' ? toGerman(b) : b))
                        .join(' · ')}
                    </Line>
                  ) : null}
                  {best?.weight ? (
                    <Line label={t('fish.yourRecord')}>
                      {best.weight.toFixed(2)} kg
                      {best.length ? ` · ${Math.round(best.length * 100)} cm` : ''}
                    </Line>
                  ) : null}

                  {s.act ? (
                    <Block>
                      <Activity act={s.act} />
                    </Block>
                  ) : null}
                  {HOOKS && s.wMax ? (
                    <Block label={t('fish.sizes')}>
                      <SizeFit sp={s} />
                    </Block>
                  ) : null}
                  {s.m ? (
                    <Block label={t('fish.bestMethod')}>
                      <MethodList m={s.m} />
                    </Block>
                  ) : null}
                  {s.spin ? (
                    <Block label={t('species.retrieve')}>
                      <RetrieveList spin={s.spin} />
                    </Block>
                  ) : null}
                  {(BAITS_FOR[r.key] ?? []).length ? (
                    <Block label={t('fish.baits')}>
                      <BaitTop speciesKey={r.key} limit={6} />
                    </Block>
                  ) : null}
                  {s.bite ? (
                    <Block label={t('fish.weather')}>
                      <BiteFactors bite={s.bite} />
                    </Block>
                  ) : null}
                  {s.info ? (
                    <div
                      style={{
                        display: 'block',
                        marginTop: '.4rem',
                        color: '#94a3b8',
                        lineHeight: 1.55,
                      }}
                    >
                      {s.info}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span>{label}</span>
      <em>{children}</em>
    </div>
  )
}

function Block({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'block', marginTop: '.5rem' }}>
      {label ? <span style={{ color: '#64748b' }}>{label}</span> : null}
      {children}
    </div>
  )
}

export default SpeciesPage
