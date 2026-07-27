import type { ReactNode } from 'react'
import { cn } from '../lib/format'

/**
 * The pieces the whole guide is assembled from. They carry no logic of their
 * own — they only make sure a badge looks like a badge everywhere.
 */

const TONES = {
  cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  red: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  violet: 'border-violet-400/30 bg-violet-400/10 text-violet-200',
  slate: 'border-white/10 bg-white/[.045] text-slate-300',
} as const

export type Tone = keyof typeof TONES

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide',
        TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

/** Characters instead of an icon font: nothing to load, nothing to break. */
const ICONS: Record<string, string> = {
  search: '⌕',
  map: '◫',
  fish: '◈',
  hook: '⌁',
  bait: '●',
  depth: '↕',
  method: '↝',
  star: '★',
  source: '↗',
  filter: '≡',
  info: 'i',
  print: '▣',
  close: '×',
  check: '✓',
  import: '↧',
  game: '▤',
  user: '☺',
  share: '⇗',
  lang: '⌘',
}

export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-flex h-5 w-5 items-center justify-center font-mono', className)}
    >
      {ICONS[name] ?? '•'}
    </span>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  labels,
}: {
  value: T
  onChange: (v: T) => void
  options: readonly T[]
  labels?: Partial<Record<T, string>>
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-xl border border-white/10 bg-[#0b1821] px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </select>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="ufs-stat">
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  )
}

export function Bar({ value, total, thin }: { value: number; total: number; thin?: boolean }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div className={cn('ufs-bar', thin && 'thin')}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

/**
 * A bite curve over 24 hours, the shape the game carries for every species.
 * Night hours sit darker so the daily rhythm is readable at a glance.
 */
export function BiteCurve({
  act,
  height = 34,
  night = true,
  className,
}: {
  act: Array<[number, number]>
  height?: number
  night?: boolean
  className?: string
}) {
  if (!act || act.length < 2) return null
  const W = 100
  const H = height
  const xy = act.map(([t, v]) => [(t / 24) * W, H - v * (H - 4) - 2] as const)
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')

  return (
    <svg
      className={cn('ufs-curve', className)}
      style={{ height: `${H}px` }}
      viewBox={`0 0 100 ${H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {night ? (
        <>
          <rect className="night" x={0} y={0} width={(6 / 24) * W} height={H} />
          <rect className="night" x={(20 / 24) * W} y={0} width={(4 / 24) * W} height={H} />
        </>
      ) : null}
      <path className="area" d={`${line} L${W} ${H} L0 ${H} Z`} />
      <path className="line" d={line} />
    </svg>
  )
}
