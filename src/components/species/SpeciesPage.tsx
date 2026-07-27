/**
 * Every species in one list, searchable. A card carries the name, the size
 * range and where the fish stands; everything else lives on the species' own
 * page, which the card links to.
 */
import { useMemo, useState } from 'react'
import { FISHERIES, GUIDE, SPECIES, speciesName } from '../../data'
import { useI18n } from '../../i18n'
import { cn, fmtNum } from '../../lib/format'
import { Toggle } from '../ui'
import { SPECIES_GUIDE } from './guideFacts'

interface Props {
  caught: Record<string, boolean>
  onOpen: (key: string) => void
}

export function SpeciesPage({ caught, onOpen }: Props) {
  const { t, lang } = useI18n()
  const [q, setQ] = useState('')
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
          return (
            <button
              key={r.key}
              type="button"
              className={cn('ufs-baitcard has', caught[r.key] && 'done')}
              onClick={() => onOpen(r.key)}
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
              <div className="where">
                {r.where.length
                  ? r.where
                      .slice(0, 3)
                      .map((w) => mapName[w] ?? w)
                      .join(', ') + (r.where.length > 3 ? ` +${r.where.length - 3}` : '')
                  : t('species.noSpawns')}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SpeciesPage
