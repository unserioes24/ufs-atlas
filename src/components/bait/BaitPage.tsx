import { useMemo, useState } from 'react'
import { BAITS, HOOKS, baitName, speciesName } from '../../data'
import type { BaitEntry } from '../../data'
import { useI18n } from '../../i18n'
import type { Key } from '../../i18n'
import { fmtNum } from '../../lib/format'
import { hookLabel } from '../../lib/hooks'
import type { BaitKind } from '../../types'
import { Card, Note, Toggle } from '../ui'

/**
 * Everything about baits, straight from the prefabs: which species wants which
 * bait, and the eighteen size steps the game measures hooks, lures and flies
 * by. Nothing here is community knowledge.
 */

const GROUPS: Array<{ kind: BaitKind; title: Key; note: Key }> = [
  { kind: 'natural', title: 'method.natural', note: 'bait.naturalNote' },
  { kind: 'boilie', title: 'method.boilie', note: 'bait.boilieNote' },
  { kind: 'fly', title: 'method.fly', note: 'bait.flyNote' },
  { kind: 'lure', title: 'method.lure', note: 'bait.lureNote' },
]

export function BaitPage({
  openSpecies,
  onOpen,
}: {
  openSpecies?: string | null
  onOpen: (key: string) => void
}) {
  const { t, lang } = useI18n()
  const [q, setQ] = useState('')
  const [onlySpecies, setOnlySpecies] = useState<string | null>(openSpecies ?? null)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return Object.values(BAITS)
      .filter((b) => {
        if (onlySpecies && !b.fish[onlySpecies]) return false
        if (!needle) return true
        if (`${b.de} ${b.en}`.toLowerCase().includes(needle)) return true
        // Searching by fish name as well: "carp" finds every carp bait
        return Object.keys(b.fish).some((s) =>
          speciesName(s, lang).toLowerCase().includes(needle),
        )
      })
      .sort((a, b) => {
        if (onlySpecies) return (b.fish[onlySpecies] ?? 0) - (a.fish[onlySpecies] ?? 0)
        return baitName(a, lang).localeCompare(baitName(b, lang))
      })
  }, [q, onlySpecies, lang])

  return (
    <div>
      <Note ok>{t('bait.intro')}</Note>

      <div className="ufs-row" style={{ margin: '.9rem 0' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('bait.searchPlaceholder')}
          className="rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50"
          style={{ minWidth: '240px' }}
        />
        {onlySpecies ? (
          <Toggle active onClick={() => setOnlySpecies(null)}>
            {t('bait.onlyFor', { name: speciesName(onlySpecies, lang) })}
          </Toggle>
        ) : null}
        <span className="ufs-muted" style={{ fontSize: '11.5px' }}>
          {t('bait.countOf', { shown: list.length, total: Object.keys(BAITS).length })}
        </span>
      </div>

      {GROUPS.map((g) => {
        const items = list.filter((b) => b.kind === g.kind)
        if (!items.length) return null
        return (
          <section key={g.kind} className="ufs-spotcard" style={{ marginBottom: '1rem' }}>
            <h3>
              {t(g.title)} · {items.length}
            </h3>
            <p
              className="ufs-muted"
              style={{ fontSize: '11.5px', margin: '0 0 .7rem', lineHeight: 1.55 }}
            >
              {t(g.note)}
            </p>
            <div className="ufs-baitgrid">
              {items.map((b) => (
                <BaitCard key={b.key} bait={b} onOpen={() => onOpen(b.key)} />
              ))}
            </div>
          </section>
        )
      })}

      {HOOKS ? <SizeTable /> : null}

      <Card title={t('bait.biteTitle')}>
        <p className="ufs-muted" style={{ fontSize: '12px', lineHeight: 1.65, margin: '.2rem 0 0' }}>
          {t('bait.biteText')} <b style={{ color: '#cbd5e1' }}>{t('bait.depthLead')}</b>{' '}
          {t('bait.depthText')}
        </p>
      </Card>
    </div>
  )
}

function BaitCard({ bait, onOpen }: { bait: BaitEntry; onOpen: () => void }) {
  const { t, lang } = useI18n()
  const entries = Object.entries(bait.fish)
    .map(([s, v]) => ({ s, v }))
    .sort((a, b) => b.v - a.v)
  const top = entries
    .slice(0, 3)
    .map((e) => speciesName(e.s, lang))
    .join(', ')

  return (
    <button type="button" className="ufs-baitcard has" onClick={onOpen}>
      <div className="de">{baitName(bait, lang)}</div>
      <div className="en">{lang === 'en' ? bait.de : bait.en}</div>
      <div className="cnt">
        {t('bait.speciesCount', { n: entries.length })}
        {top ? ' · ' + t('bait.strongest', { list: top }) : ''}
      </div>
    </button>
  )
}

/** The eighteen size steps, as the FishManager carries them. */
function SizeTable() {
  const { t } = useI18n()
  const hooks = HOOKS
  if (!hooks) return null

  const range = (
    table: Array<[number, number]> | undefined,
    i: number,
    unit: string,
    scale = 1,
  ): string => {
    const row = table?.[i]
    if (!row || row[1] <= 0) return '–'
    return `${fmtNum(Math.round(row[0] * scale))}–${fmtNum(Math.round(row[1] * scale))} ${unit}`
  }

  return (
    <section className="ufs-spotcard" style={{ marginBottom: '1rem' }}>
      <h3>
        {t('bait.hookSizes')} · {hooks.steps}
      </h3>
      <p className="ufs-muted" style={{ fontSize: '11.5px', margin: '0 0 .7rem', lineHeight: 1.55 }}>
        {t('bait.hookText')}
      </p>
      <div className="ufs-scroll">
        <table className="ufs-rec">
          <thead>
            <tr>
              <th>{t('bait.colSize')}</th>
              <th>{t('bait.colGap')}</th>
              <th>{t('bait.colHook')}</th>
              <th>{t('method.lure')}</th>
              <th>{t('method.fly')}</th>
              <th>{t('bait.colBaitSize')}</th>
            </tr>
          </thead>
          <tbody>
            {hooks.hook.map((_row, i) => (
              <tr key={i}>
                <td className="n">{hookLabel(i)}</td>
                <td className="num">{Math.round((hooks.gap[i] ?? 0) * 1000)} mm</td>
                <td className="num">{range(hooks.hook, i, 'kg')}</td>
                <td className="num">{range(hooks.lure, i, 'kg')}</td>
                <td className="num">{range(hooks.fly, i, 'kg')}</td>
                <td className="num">{range(hooks.baitLength, i, 'cm', 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default BaitPage
