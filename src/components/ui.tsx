import type { ReactNode } from 'react'
import { cn } from '../lib/format'

/** The small building blocks every page uses. */

export function Chip({
  children,
  title,
  className,
}: {
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <span className={cn('ufs-chip', className)} title={title}>
      {children}
    </span>
  )
}

export function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold transition',
        active
          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
          : 'border-white/10 bg-white/[.03] text-slate-500 hover:text-slate-300',
      )}
    >
      {active ? <span aria-hidden>✓</span> : null}
      {children}
    </button>
  )
}

export function Card({
  title,
  extra,
  children,
  className,
}: {
  title?: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('ufs-spotcard', className)}>
      {title || extra ? (
        <div className="ufs-row" style={{ justifyContent: 'space-between', marginBottom: '.6rem' }}>
          {title ? <h3 style={{ margin: 0 }}>{title}</h3> : <span />}
          {extra}
        </div>
      ) : null}
      {children}
    </div>
  )
}

export function Note({ children, ok }: { children: ReactNode; ok?: boolean }) {
  return <div className={cn('ufs-note', ok && 'ok')}>{children}</div>
}

/**
 * A side menu in the style of the fishery list: one entry per section, with a
 * short line underneath saying what is inside.
 */
export interface MenuItem {
  key: string
  title: string
  sub?: string
}

export function SideMenu({
  heading,
  items,
  active,
  onSelect,
  actions,
}: {
  heading: string
  items: MenuItem[]
  active: string
  onSelect: (key: string) => void
  actions?: ReactNode
}) {
  return (
    <aside className="no-print self-start lg:sticky lg:top-24">
      <div className="glass scrollbar max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl border border-white/10 p-3 shadow-2xl">
        <div className="px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-[.18em] text-slate-500">
          {heading}
        </div>
        <div className="space-y-1">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => onSelect(it.key)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition',
                active === it.key
                  ? 'border border-cyan-300/20 bg-cyan-400/10'
                  : 'border border-transparent hover:bg-white/[.045]',
              )}
            >
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  active === it.key ? 'bg-cyan-300/70' : 'bg-slate-600',
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-200">
                  {it.title}
                </span>
                {it.sub ? (
                  <span className="block truncate text-[10px] text-slate-500">{it.sub}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
        {actions ? <div className="ufs-menuactions">{actions}</div> : null}
      </div>
    </aside>
  )
}

/** Two columns on wide screens, stacked on narrow ones. */
export function WithSideMenu({ menu, children }: { menu: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      {menu}
      <div className="min-w-0">{children}</div>
    </div>
  )
}
