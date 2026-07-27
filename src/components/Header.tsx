/**
 * The bar at the top: brand, search, navigation, language and the counter of
 * species caught.
 *
 * From 1024 px up the navigation stands in the row. Below that it collapses
 * into a burger: on a phone a row of eight buttons either overflows or shrinks
 * until nothing is readable, and a panel that opens on demand costs one tap and
 * shows every entry with its full label.
 */
import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { API_AVAILABLE } from '../lib/api'
import { useI18n } from '../i18n'
import { cn } from '../lib/format'
import type { View } from '../lib/route'
import { LangSwitch } from './LangSwitch'
import { Icon } from './primitives'

export interface HeaderProps {
  view: View
  onView: (v: View) => void
  query: string
  onQuery: (q: string) => void
  searchRef: MutableRefObject<HTMLInputElement | null>
  me: { name: string } | null
  onOpenSelf: () => void
  onBrand: () => void
  onSources: () => void
  caught: number
  total: number
}

interface NavItem {
  key: string
  icon: string
  label: string
  active: boolean
  run: () => void
}

export function Header({
  view,
  onView,
  query,
  onQuery,
  searchRef,
  me,
  onOpenSelf,
  onBrand,
  onSources,
  caught,
  total,
}: HeaderProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // The panel closes on Escape, on a click outside, and whenever the view
  // changes - otherwise it would stay open over the page you just picked.
  useEffect(() => setOpen(false), [view])
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onDown(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  const items: NavItem[] = [
    { key: 'map', icon: 'map', label: t('nav.fisheries'), active: view === 'map', run: () => onView('map') },
    { key: 'arten', icon: 'fish', label: t('nav.species'), active: view === 'arten', run: () => onView('arten') },
    { key: 'bait', icon: 'bait', label: t('nav.baits'), active: view === 'bait', run: () => onView('bait') },
    { key: 'stats', icon: 'scale', label: t('nav.stats'), active: view === 'stats', run: () => onView('stats') },
  ]
  if (API_AVAILABLE) {
    items.push({
      key: 'self',
      icon: 'user',
      label: me ? t('nav.profile') : t('nav.login'),
      active: view === 'angler' || view === 'anmelden',
      run: onOpenSelf,
    })
  }
  items.push({
    key: 'sources',
    icon: 'source',
    label: t('nav.sources'),
    active: false,
    run: onSources,
  })

  const counter = (
    <span className="ufs-chip ufs-mono" title={t('nav.caughtTotal')}>
      {'✓ ' + caught + ' / ' + total}
    </span>
  )

  return (
    <header className="no-print sticky top-0 z-40 border-b border-white/10 bg-[#061017]/80 backdrop-blur-xl">
      <div className="ufs-headrow mx-auto max-w-[1700px] px-4 py-3 lg:px-7">
        <button
          onClick={onBrand}
          className="flex shrink-0 items-center gap-3 text-left"
          style={{ cursor: 'pointer' }}
          title={t('nav.toStart')}
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/20 to-blue-500/10 shadow-glow">
            <Icon name="fish" className="text-cyan-200" />
          </span>
          <span>
            <span className="block text-sm font-black tracking-[.22em] text-cyan-200">
              {t('app.name').toUpperCase()}
            </span>
            <span className="block text-[10px] text-slate-500">{t('app.tagline')}</span>
          </span>
        </button>

        {/* The burger sits beside the brand and only shows on narrow screens. */}
        <button
          className="ufs-burger ufs-btn"
          aria-expanded={open}
          aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="bars" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span className="lbl">{t('nav.menu')}</span>
        </button>

        <div className="ufs-search relative ml-auto w-full max-w-xl">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t('app.searchPlaceholder') + '  /'}
            className="w-full rounded-2xl border border-white/10 bg-white/[.045] py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-cyan-400/50 focus:bg-white/[.07]"
          />
        </div>

        <div className="ufs-headnav">
          {items.map((it) => (
            <button
              key={it.key}
              className={cn('ufs-btn', it.active && 'primary')}
              onClick={it.run}
            >
              <Icon name={it.icon} />
              <span className="lbl">{it.label}</span>
            </button>
          ))}
          <LangSwitch />
          {counter}
        </div>
      </div>

      {open ? (
        <div className="ufs-menupanel" ref={panelRef}>
          {items.map((it) => (
            <button
              key={it.key}
              className={cn('row', it.active && 'on')}
              onClick={() => {
                setOpen(false)
                it.run()
              }}
            >
              <Icon name={it.icon} />
              <span>{it.label}</span>
            </button>
          ))}
          <div className="foot">
            <LangSwitch />
            {counter}
          </div>
        </div>
      ) : null}
    </header>
  )
}

export default Header
