/**
 * The bar at the top: brand, search, navigation, language and the counter of
 * species caught.
 *
 * The row is allowed to wrap and the navigation to scroll sideways at every
 * width. Guessing a breakpoint for that had left a gap around 1000 px where
 * neither applied and the page slid sideways.
 */
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
  view: View
  icon: string
  label: string
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

  const items: NavItem[] = [
    { view: 'map', icon: 'map', label: t('nav.fisheries') },
    { view: 'arten', icon: 'fish', label: t('nav.species') },
    { view: 'bait', icon: 'bait', label: t('nav.baits') },
    { view: 'stats', icon: 'scale', label: t('nav.stats') },
  ]

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
              key={it.view}
              className={cn('ufs-btn', view === it.view && 'primary')}
              onClick={() => onView(it.view)}
            >
              <Icon name={it.icon} />
              <span className="lbl">{it.label}</span>
            </button>
          ))}
          {API_AVAILABLE ? (
            <button
              className={cn('ufs-btn', (view === 'angler' || view === 'anmelden') && 'primary')}
              title={me ? t('map.profileTitle') : t('nav.login')}
              onClick={onOpenSelf}
            >
              <Icon name="user" />
              <span className="lbl">{me ? t('nav.profile') : t('nav.login')}</span>
            </button>
          ) : null}
          <LangSwitch />
          <span className="ufs-chip ufs-mono" title={t('nav.caughtTotal')}>
            {'✓ ' + caught + ' / ' + total}
          </span>
          <button className="ufs-btn" onClick={onSources}>
            <Icon name="source" />
            <span className="lbl">{t('nav.sources')}</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
