import { BAITS_FOR, HOOKS, baitName, speciesName } from '../../data'
import { useI18n } from '../../i18n'
import type { Key } from '../../i18n'
import { cn } from '../../lib/format'
import { fitSteps, gapRange, stepRange } from '../../lib/hooks'
import type { CurvePoint, Species } from '../../types'
import { BiteCurve } from '../primitives'
import { useState } from 'react'

/**
 * The blocks that show what the game files say about one species: baits,
 * fishing method, retrieve, size steps, weather and bite times. They are used
 * both on the fish card and on the species page.
 */

// --------------------------------------------------------------- Methods

/**
 * species.m carries four percentages: the best bait preference reachable with
 * fly, lure, natural bait and boilie. What follows from that is written in
 * Fish.LikesBait:
 *
 *   eval = mean(time, wind, clouds, rain) × bait preference
 *   float/ground: + groundbait × 0.2   (ground rig with a feeder)
 *   spin/fly:     × retrieve factor    (0 without a retrieve)
 *   eval × line factor (0.6 … 1) ≥ 0.4  →  bite   (casual: ≥ 0.29)
 *
 * The threshold is hard: a weak preference does not mean "rarer", past a point
 * it means "never".
 */
const METHODS: Array<{ key: 'fly' | 'lure' | 'natural' | 'boilie'; name: Key; note: Key }> = [
  { key: 'fly', name: 'method.fly', note: 'method.flyRod' },
  { key: 'lure', name: 'method.lure', note: 'method.spinRod' },
  { key: 'natural', name: 'method.natural', note: 'method.floatGround' },
  { key: 'boilie', name: 'method.boilie', note: 'method.groundRig' },
]

/** The weather value needed for this preference to clear the threshold. */
function needBase(pct: number): number | null {
  if (!pct) return null
  const need = 0.4 / (pct / 100)
  return need > 1 ? null : need
}

export interface MethodRow {
  key: string
  name: Key
  note: Key
  pct: number
  need: number | null
}

export function methodRows(m: Species['m']): MethodRow[] {
  if (!m?.length) return []
  return METHODS.map((x, i) => {
    const pct = m[i] ?? 0
    return { key: x.key, name: x.name, note: x.note, pct, need: needBase(pct) }
  }).sort((a, b) => b.pct - a.pct)
}

/** The strongest method, or several if they tie. */
export function methodTop(m: Species['m']): { rows: MethodRow[]; value: number } | null {
  const rows = methodRows(m).filter((r) => r.pct > 0)
  if (!rows.length) return null
  const best = rows[0]?.pct ?? 0
  return { rows: rows.filter((r) => r.pct === best), value: best }
}

export function MethodList({ m }: { m: Species['m'] }) {
  const { t } = useI18n()
  const rows = methodRows(m)
  if (!rows.length) return null
  const first = rows[0]
  const hopeless = rows.filter((r) => r.pct && !r.need)

  return (
    <div>
      <div className="ufs-baitlist">
        {rows.map((r) => {
          // Three pieces on the hook: best piece + 0.2 for each further one
          const three = r.key === 'natural' && r.pct ? Math.min(140, Math.round(r.pct * 1.4)) : 0
          return (
            <div key={r.key} className="row">
              <span className={cn('nm', !r.pct && 'off')}>{t(r.name)}</span>
              <span className={cn('kd', r.key)}>{t(r.note)}</span>
              <span className="bar">
                {three ? (
                  <span className="ghost" style={{ width: `${Math.min(100, three)}%` }} />
                ) : null}
                <span style={{ width: `${Math.min(100, r.pct)}%` }} />
              </span>
              <span className="vl">{r.pct ? `${r.pct} %` : '–'}</span>
            </div>
          )
        })}
      </div>
      <p className="ufs-muted" style={{ fontSize: '11px', lineHeight: 1.6, marginTop: '.5rem' }}>
        {t('method.threshold')}{' '}
        {first?.need
          ? t('method.needsWeather', {
              method: t(first.name),
              pct: Math.round(first.need * 100),
            })
          : t('method.hopeless')}{' '}
        {m?.[2] ? t('method.threePieces', { pct: Math.round(m[2] * 1.4) }) : ''}
        {hopeless.length
          ? ` ${t('method.noChance', { list: hopeless.map((r) => t(r.name)).join(', ') })}`
          : ''}
      </p>
    </div>
  )
}

// -------------------------------------------------------------- Retrieve

/** Follows the SpinningMethod enum, without its first entry NONE. */
const SPIN: Key[] = [
  'spin.straightSlow',
  'spin.straight',
  'spin.straightFast',
  'spin.liftDrop',
  'spin.stopGo',
  'spin.twitching',
]

export function spinTop(spin: number[] | undefined): { names: Key[]; value: number } | null {
  if (!spin) return null
  let best = -1
  for (const v of spin) if (v > best) best = v
  if (best <= 0) return null
  const names = SPIN.filter((_n, i) => spin[i] === best)
  return { names, value: best }
}

export function RetrieveList({ spin }: { spin: number[] | undefined }) {
  const { t } = useI18n()
  if (!spin) return null
  const rows = spin
    .map((v, i) => ({ name: SPIN[i] as Key, v }))
    .sort((a, b) => b.v - a.v)

  return (
    <div className="ufs-baitlist">
      {rows.map((r) => (
        <div key={r.name} className="row">
          <span className={cn('nm', r.v === 0 && 'off')}>{t(r.name)}</span>
          <span className="kd" />
          <span className="bar">
            <span style={{ width: `${Math.round(r.v * 100)}%` }} />
          </span>
          <span className="vl">{Math.round(r.v * 100)} %</span>
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------- Bite times

/** Peak hours of the bite curve, as readable text. */
export function bestHours(act: CurvePoint[] | undefined, evenLabel: string): string | null {
  if (!act || act.length < 2) return null
  let top = 0
  for (const p of act) if (p[1] > top) top = p[1]
  if (top <= 0) return null
  const peaks = act.filter((p) => p[1] >= top - 0.01 && p[0] < 24).map((p) => `${p[0]}:00`)
  if (!peaks.length) return null
  // A curve that sits flat has no preferred time at all.
  const low = act.reduce((m, p) => Math.min(m, p[1]), 1)
  if (top - low < 0.05) return evenLabel
  return peaks.join(', ')
}

export function Activity({ act }: { act: CurvePoint[] | undefined }) {
  const { t } = useI18n()
  if (!act || act.length < 2) return null
  const hours = bestHours(act, t('fish.allDay'))

  return (
    <div>
      <BiteCurve act={act} height={46} night />
      <div className="ufs-actlabels">
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>{t('fish.hours24')}</span>
      </div>
      {hours ? (
        <div className="ufs-stats" style={{ marginTop: '.35rem' }}>
          <span>
            {t('fish.bestTime')}: <b>{hours}</b>
          </span>
        </div>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------- Size steps

/** Which size steps fit this species — hook, lure, fly, bait. */
export function SizeFit({ sp }: { sp: Species }) {
  const { t } = useI18n()
  const hooks = HOOKS
  if (!hooks || !sp.wMax) return null

  const lo = sp.wMin ?? 0
  const hi = sp.wMax
  const rows: Array<{ label: string; step: string | null; extra: string | null }> = []

  for (const [table, label] of [
    ['hook', 'fish.hook'],
    ['lure', 'method.lure'],
    ['fly', 'method.fly'],
  ] as const) {
    const idx = fitSteps(hooks[table], lo, hi)
    if (!idx.length) continue
    rows.push({
      label: t(label),
      step: stepRange(idx),
      extra: table === 'hook' ? gapRange(idx) : null,
    })
  }
  if (sp.lMax && hooks.baitLength) {
    // Lengths come in centimetres, the table is in metres.
    const idx = fitSteps(hooks.baitLength, (sp.lMin ?? 0) / 100, sp.lMax / 100)
    if (idx.length) rows.push({ label: t('bait.baitSize'), step: stepRange(idx), extra: null })
  }
  if (!rows.length) return null

  return (
    <div className="ufs-sizes">
      {rows.map((r) => (
        <div key={r.label} className="row">
          <span className="nm">{r.label}</span>
          <span className="st">{r.step}</span>
          <span className="ex">{r.extra ?? ''}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- Weather

const WEATHER: Array<{ key: 'wind' | 'cloudiness' | 'rain'; name: Key; hint: Key }> = [
  { key: 'wind', name: 'weather.wind', hint: 'weather.windHint' },
  { key: 'cloudiness', name: 'weather.clouds', hint: 'weather.cloudsHint' },
  { key: 'rain', name: 'weather.rain', hint: 'weather.rainHint' },
]

export function BiteFactors({ bite }: { bite: Species['bite'] }) {
  const { t } = useI18n()
  if (!bite) return null
  const rows = WEATHER.filter((w) => bite[w.key]?.length)
  if (!rows.length) return null

  return (
    <div className="ufs-bite">
      {rows.map((w) => {
        const curve = bite[w.key] as CurvePoint[]
        const from = curve[0]?.[1] ?? 0
        const to = curve[curve.length - 1]?.[1] ?? 0
        const better = to > from
        return (
          <div key={w.key} className="row">
            <span className="nm">{t(w.name)}</span>
            <span className="hint">{t(w.hint)}</span>
            <span className="bar">
              <span
                className={better ? 'up' : 'down'}
                style={{ width: `${Math.round(Math.min(1, to) * 100)}%` }}
              />
            </span>
            <span className={cn('vl', better && 'up')}>
              {Math.round(from * 100)} → {Math.round(to * 100)} %
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ Baits

/** The baits a species wants, strongest first. */
export function BaitTop({ speciesKey, limit = 8 }: { speciesKey: string; limit?: number }) {
  const { t, lang } = useI18n()
  const [all, setAll] = useState(false)
  const list = BAITS_FOR[speciesKey] ?? []
  if (!list.length) return null
  const shown = all ? list : list.slice(0, limit)

  return (
    <div>
      <div className="ufs-baitlist">
        {shown.map((e) => (
          <div key={e.bait.key} className="row">
            <span className="nm">{baitName(e.bait, lang)}</span>
            <span className={cn('kd', e.bait.kind)}>{t(`method.${e.bait.kind}` as Key)}</span>
            <span className="bar">
              <span style={{ width: `${Math.round(e.v * 100)}%` }} />
            </span>
            <span className="vl">{Math.round(e.v * 100)} %</span>
          </div>
        ))}
      </div>
      {list.length > limit ? (
        <button
          type="button"
          className="ufs-chip ufs-chip-btn no-print"
          style={{ marginTop: '.45rem' }}
          onClick={(ev) => {
            ev.stopPropagation()
            setAll(!all)
          }}
        >
          {all ? t('fish.showLess') : t('fish.showAllBaits', { n: list.length })}
        </button>
      ) : null}
    </div>
  )
}

/** Name of a species in the current language. */
export function useSpeciesName(): (key: string) => string {
  const { lang } = useI18n()
  return (key: string) => speciesName(key, lang)
}
