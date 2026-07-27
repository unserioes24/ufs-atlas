/**
 * The shell: state that outlives a single view, the address bar, and the switch
 * that picks what to render. Everything it renders is a component of its own.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FISHERIES, GUIDE, speciesKey } from './data'
import { API_AVAILABLE, api } from './lib/api'
import { cn, fmtWhen, newerThan } from './lib/format'
import { useI18n } from './i18n'
import { storedStamp, useLocalState } from './lib/localState'
import { buildAddress, isCurrent, parseLocation } from './lib/route'
import type { View } from './lib/route'
import type { SaveSummary } from './lib/savegame'
import Header from './components/Header'
import StartPage from './components/start/StartPage'
import BaitPage from './components/bait/BaitPage'
import BaitDetail from './components/bait/BaitDetail'
import SpeciesDetail from './components/species/SpeciesDetail'
import SpeciesPage from './components/species/SpeciesPage'
import StatsPage from './components/stats/StatsPage'
import GlobalOverview from './components/stats/GlobalOverview'
import MapList from './components/map/MapList'
import FisheryView from './components/map/FisheryView'
import GroupsPage from './components/groups/GroupsPage'
import ProfilePage from './components/profile/ProfilePage'
import type { Account } from './components/profile/AccountPanel'
import LoginPanel from './components/auth/LoginPanel'
import ImportDialog from './components/save/ImportDialog'
import SourcesPanel from './components/SourcesPanel'
import Privacy from './components/legal/Privacy'
import CookieNote from './components/legal/CookieNote'
import SiteFooter from './components/legal/SiteFooter'

/** Every species the guide or the game files know, for the counter in the header. */
const ALL_KEYS: string[] = (() => {
  const s = new Set<string>()
  for (const id of Object.keys(FISHERIES)) for (const g of FISHERIES[id]!.species) s.add(g.s)
  for (const f of GUIDE.fish) {
    const k = speciesKey(f.name, f.de, f.mapId)
    if (k) s.add(k)
  }
  return [...s]
})()

function readFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem('ufs-favs') || '[]') as string[]
  } catch {
    return []
  }
}

export default function App() {
  const { t } = useI18n()
  const playable = GUIDE.maps.filter((m) => m.status === 'playable')

  // The first state comes from the address, not from defaults that a second
  // pass then corrects: that would put a stray entry into the history and leave
  // an old address standing instead of rewriting it.
  const first = useRef(parseLocation(API_AVAILABLE)).current

  const [view, setView] = useState<View>(first.view)
  const [selectedMap, setSelectedMap] = useState(
    first.map && first.map !== '__all__' ? first.map : first.map === '__all__' ? '__all__' : playable[0]!.id,
  )
  const [selectedSpot, setSelectedSpot] = useState<number | null>(first.spot ?? null)
  const [query, setQuery] = useState('')
  const [openSpecies, setOpenSpecies] = useState<string | null>(first.species ?? null)
  const [openBait, setOpenBait] = useState<string | null>(first.bait ?? null)
  const [statsTab, setStatsTab] = useState(first.statsTab ?? 'reviere')
  const [angler, setAngler] = useState<string | null>(first.angler ?? null)
  const [anglerTab, setAnglerTab] = useState(first.anglerTab ?? 'uebersicht')
  const [groupId, setGroupId] = useState<number | null>(first.groupId ?? null)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [me, setMe] = useState<Account | null>(null)
  const [syncNote, setSyncNote] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<string[]>(readFavorites)
  const { local, setLocal, patchLocal, reset: resetLocal } = useLocalState()
  const searchRef = useRef<HTMLInputElement | null>(null)

  const caught = local.caught ?? {}
  const bests = local.bests ?? {}

  // Ask the server who is signed in, if there is one. Where the account holds
  // something newer – a save file uploaded through the API, say – take it over.
  useEffect(() => {
    if (!API_AVAILABLE) return
    api<{ user: Account | null }>('/auth/me')
      .then((d) => {
        setMe(d.user)
        if (!d.user) return
        return api<{ state?: typeof local }>('/profile/state').then((s) => {
          const st = s?.state
          if (!st?.updatedAt) return
          // Compare against the stored stamp, not against the state at call
          // time: the answer only comes back later.
          if (!newerThan(st.updatedAt, storedStamp())) return
          setLocal({
            caught: st.caught ?? {},
            bests: st.bests ?? {},
            stats: st.stats ?? null,
            updatedAt: st.updatedAt,
          })
          setSyncNote(st.updatedAt)
        })
      })
      .catch(() => {
        /* keep working offline */
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => localStorage.setItem('ufs-favs', JSON.stringify(favorites)), [favorites])

  // "/" jumps into the search, unless something is being typed already.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = document.activeElement?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* The address bar as state; reading and writing live in src/lib/route.ts. */
  const histReady = useRef(false)
  useEffect(() => {
    function apply() {
      const r = parseLocation(API_AVAILABLE)
      setView(r.view)
      if (r.map) setSelectedMap(r.map)
      if (r.angler) {
        setAngler(r.angler)
        setAnglerTab(r.anglerTab ?? 'uebersicht')
      }
      if (r.view === 'gruppen') setGroupId(r.groupId ?? null)
      if (r.view === 'stats') setStatsTab(r.statsTab ?? 'reviere')
      if (r.view === 'arten') setOpenSpecies(r.species ?? null)
      if (r.view === 'bait') setOpenBait(r.bait ?? null)
      // The spot only after the map has changed: that resets it itself.
      if (r.view === 'map' && r.map) setTimeout(() => setSelectedSpot(r.spot ?? null), 0)
    }
    // popstate for paths, hashchange for the file:// build.
    window.addEventListener('popstate', apply)
    window.addEventListener('hashchange', apply)
    return () => {
      window.removeEventListener('popstate', apply)
      window.removeEventListener('hashchange', apply)
    }
  }, [])

  useEffect(() => {
    const address = buildAddress({
      view,
      map: selectedMap,
      spot: selectedSpot,
      species: openSpecies,
      bait: openBait,
      angler: angler ?? undefined,
      anglerTab,
      groupId,
    })
    // Every switch is its own step in the history, so the browser's back button
    // does what you expect. The first call only replaces, otherwise opening the
    // page would already leave a second entry behind.
    if (isCurrent(address)) return
    if (histReady.current) history.pushState(null, '', address)
    else {
      history.replaceState(null, '', address)
      histReady.current = true
    }
  }, [view, selectedMap, selectedSpot, openSpecies, openBait, angler, anglerTab, groupId])

  const isGlobal = selectedMap === '__all__'
  const map = GUIDE.maps.find((m) => m.id === selectedMap) ?? playable[0]!
  const allDone = useMemo(() => ALL_KEYS.filter((k) => caught[k]).length, [caught])

  const openUser = useCallback((name: string) => {
    setAngler(name)
    setAnglerTab('uebersicht')
    setView('angler')
  }, [])

  const toggleFav = useCallback((id: string) => {
    setFavorites((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))
  }, [])

  const toggleCatch = useCallback(
    (key: string) => {
      const next = { ...caught }
      if (next[key]) delete next[key]
      else next[key] = true
      patchLocal({ caught: next })
    },
    [caught, patchLocal],
  )

  /** An import replaces the local state outright. */
  const applyImport = useCallback(
    (res: SaveSummary) => {
      setLocal({
        caught: res.caught,
        bests: res.bests,
        stats: {
          player: res.player,
          fisheries: res.fisheries,
          bests: res.bests,
          total: res.total,
        },
        updatedAt: new Date().toISOString(),
      })
      setSyncNote(null)
    },
    [setLocal],
  )

  const headline =
    // A detail page carries its own name, so the section heading stays away.
    (view === 'map' && !isGlobal) ||
    view === 'angler' ||
    view === 'start' ||
    (view === 'arten' && openSpecies) ||
    (view === 'bait' && openBait)
      ? null
      : view === 'bait'
        ? t('nav.baits')
        : view === 'arten'
          ? t('nav.species')
          : view === 'gruppen'
            ? t('group.title')
            : view === 'anmelden'
              ? t('auth.title')
              : view === 'stats'
                ? t('stats.title')
                : view === 'privacy'
                  ? t('privacy.title')
                  : t('map.overview')

  return (
    <div className="min-h-screen water-grid">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-[15%] h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl animate-floaty" />
        <div className="absolute top-[35%] right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      <Header
        view={view}
        onView={setView}
        query={query}
        onQuery={setQuery}
        searchRef={searchRef}
        me={me}
        caught={allDone}
        total={ALL_KEYS.length}
        onBrand={() => {
          if (API_AVAILABLE) {
            setView('start')
            return
          }
          setView('map')
          setSelectedMap(playable[0]!.id)
        }}
        onOpenSelf={() => (me ? openUser(me.name) : setView('anmelden'))}
        onSources={() => setSourceOpen(true)}
      />

      <div
        className={cn(
          'relative mx-auto grid max-w-[1700px] grid-cols-1 gap-6 px-4 py-6 lg:px-7',
          view === 'map' && 'lg:grid-cols-[300px_minmax(0,1fr)]',
        )}
      >
        {/* The fishery list belongs to the fishery view alone. */}
        {view === 'map' ? (
          <MapList
            selected={selectedMap}
            caught={caught}
            allKeys={ALL_KEYS}
            onSelect={(id) => {
              setSelectedMap(id)
              setQuery('')
            }}
          />
        ) : null}

        <main className="min-w-0">
          {syncNote ? (
            <div className="ufs-note ok no-print" style={{ marginBottom: '.9rem' }}>
              {t('map.syncNote', { when: fmtWhen(syncNote) })}
              <button
                className="ufs-btn"
                style={{ marginLeft: '.6rem', padding: '.15rem .6rem' }}
                onClick={() => setSyncNote(null)}
              >
                {t('app.ok')}
              </button>
            </div>
          ) : null}

          {headline ? (
            <h1 className="mb-4 text-2xl font-black tracking-tight text-white">{headline}</h1>
          ) : null}

          {view === 'start' ? (
            <StartPage
              onOpenSpecies={(k) => {
                setOpenSpecies(k)
                setView('arten')
              }}
            />
          ) : view === 'angler' && angler ? (
            <ProfilePage
              name={angler}
              me={me}
              local={local}
              tab={anglerTab}
              onTab={setAnglerTab}
              onBack={() => setView('start')}
              onMe={setMe}
              onLogout={() => {
                void api('/auth/logout', { method: 'POST' }).then(() => setMe(null))
              }}
              onOpenUser={openUser}
              onOpenGroups={() => {
                setGroupId(null)
                setView('gruppen')
              }}
            />
          ) : view === 'privacy' ? (
            <Privacy />
          ) : view === 'bait' ? (
            openBait ? (
              <BaitDetail
                baitKey={openBait}
                onBack={() => setOpenBait(null)}
                onOpenSpecies={(k) => {
                  setOpenSpecies(k)
                  setView('arten')
                }}
              />
            ) : (
              <BaitPage onOpen={setOpenBait} />
            )
          ) : view === 'gruppen' ? (
            <GroupsPage
              me={me}
              openId={groupId}
              onOpen={setGroupId}
              onOpenUser={openUser}
              onLogin={() => setView('anmelden')}
            />
          ) : view === 'anmelden' ? (
            <div style={{ maxWidth: '520px' }}>
              <LoginPanel
                onLogin={(u) => {
                  setMe(u as Account)
                  setView('start')
                }}
              />
            </div>
          ) : view === 'stats' ? (
            <StatsPage
              stats={local.stats}
              tab={statsTab}
              apiAvailable={API_AVAILABLE}
              me={me}
              onOpenCommunity={() => setView('anmelden')}
              onReset={() => {
                resetLocal()
                setSyncNote(null)
              }}
              onImport={() => setImportOpen(true)}
              onOpenMap={(id) => {
                setSelectedMap(id)
                setView('map')
              }}
              onOpenSpecies={(k) => {
                setOpenSpecies(k)
                setView('arten')
              }}
            />
          ) : view === 'arten' ? (
            openSpecies ? (
              <SpeciesDetail
                speciesKey={openSpecies}
                caught={caught}
                bests={bests}
                onBack={() => setOpenSpecies(null)}
                onToggleCatch={toggleCatch}
                onOpenMap={(id) => {
                  setSelectedMap(id)
                  setView('map')
                }}
              />
            ) : (
              <SpeciesPage caught={caught} onOpen={setOpenSpecies} />
            )
          ) : isGlobal ? (
            <GlobalOverview caught={caught} allKeys={ALL_KEYS} onOpenMap={setSelectedMap} />
          ) : (
            <FisheryView
              map={map}
              query={query}
              caught={caught}
              bests={bests}
              favorites={favorites}
              onToggleFav={toggleFav}
              onToggleCatch={toggleCatch}
              onSources={() => setSourceOpen(true)}
              selectedSpot={selectedSpot}
              onSelectSpot={setSelectedSpot}
              onPickMap={setSelectedMap}
            />
          )}
        </main>
      </div>


      <SiteFooter onPrivacy={() => setView('privacy')} />
      <CookieNote onPrivacy={() => setView('privacy')} />
      {sourceOpen ? <SourcesPanel onClose={() => setSourceOpen(false)} /> : null}
      {importOpen ? (
        <ImportDialog
          me={me}
          onClose={() => setImportOpen(false)}
          onImport={applyImport}
          onReset={resetLocal}
        />
      ) : null}
    </div>
  )
}
