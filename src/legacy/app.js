/*
 * What is left of the original single-file app: the shell that holds the state
 * together and picks the view. Everything it renders now lives as a typed
 * component under src/components.
 *
 * It still uses React.createElement instead of JSX – the last remnant of
 * running without a build step. This file is meant to disappear too.
 */
import React from 'react'
import { FISHERIES, GUIDE, speciesKey } from '../data'
import { API_AVAILABLE, api } from '../lib/api'
import { cn, fmtWhen, newerThan } from '../lib/format'
import { useI18n } from '../i18n'
import { storedStamp, useLocalState } from '../lib/localState'
import { buildHash, parseHash } from '../lib/route'
import Header from '../components/Header'
import StartPage from '../components/start/StartPage'
import BaitPage from '../components/bait/BaitPage'
import SpeciesPage from '../components/species/SpeciesPage'
import StatsPage from '../components/stats/StatsPage'
import GlobalOverview from '../components/stats/GlobalOverview'
import MapList from '../components/map/MapList'
import FisheryView from '../components/map/FisheryView'
import GroupsPage from '../components/groups/GroupsPage'
import ProfilePage from '../components/profile/ProfilePage'
import LoginPanel from '../components/auth/LoginPanel'
import ImportDialog from '../components/save/ImportDialog'
import SourcesPanel from '../components/SourcesPanel'

const { useCallback, useEffect, useMemo, useRef, useState } = React
const h = React.createElement

const D = GUIDE


/* ------------------------------------------------------------------- App */

function App() {
    const playable = D.maps.filter(function (m) { return m.status === 'playable'; });
    const [selectedMap, setSelectedMap] = useState(playable[0].id);
    const [query, setQuery] = useState('');
    const [sourceOpen, setSourceOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [view, setView] = useState('map');
    const [openSpecies, setOpenSpecies] = useState(null);
    const [statsTab, setStatsTab] = useState('reviere');
    const [me, setMe] = useState(null);
    const [angler, setAngler] = useState(null);
    const [anglerTab, setAnglerTab] = useState('uebersicht');
    const [groupId, setGroupId] = useState(null);

    const [syncNote, setSyncNote] = useState(null);

    // Anmeldezustand vom Server holen, sofern es einen gibt. Steht dort ein
    // neuerer Stand – etwa weil der Spielstand per Schnittstelle hochgeladen
    // wurde –, wird er übernommen.
    useEffect(function () {
        if (!API_AVAILABLE) return;
        api('/auth/me').then(function (d) {
            setMe(d.user);
            if (!d.user) return;
            return api('/profile/state').then(function (s) {
                const st = s && s.state;
                if (!st || !st.updatedAt) return;
                // Gegen den gespeicherten Zeitpunkt vergleichen, nicht gegen den
                // Zustand beim Aufruf: die Antwort kommt erst später zurück.
                if (!newerThan(st.updatedAt, storedStamp())) return;
                setLocal({
                    caught: st.caught || {}, bests: st.bests || {},
                    stats: st.stats || null, updatedAt: st.updatedAt
                });
                setSyncNote(st.updatedAt);
            });
        }).catch(function () { /* offline weiterarbeiten */ });
    }, []);
    const [selectedSpot, setSelectedSpot] = useState(null);
    const i18n = useI18n();
    const lang = i18n.lang;
    const t = i18n.t;
    const [favorites, setFavorites] = useState(function () {
        try { return JSON.parse(localStorage.getItem('ufs-favs') || '[]'); } catch (e) { return []; }
    });
    const { local, setLocal, patchLocal, reset: resetLocal } = useLocalState();
    const caught = local.caught || {};
    const bests = local.bests || {};
    const saveStats = local.stats || null;
    const searchRef = useRef(null);

    useEffect(function () { localStorage.setItem('ufs-favs', JSON.stringify(favorites)); }, [favorites]);
    useEffect(function () {
        function fn(e) {
            if (e.key === '/' && ['INPUT', 'TEXTAREA'].indexOf((document.activeElement || {}).tagName) < 0) {
                e.preventDefault();
                if (searchRef.current) searchRef.current.focus();
            }
        }
        window.addEventListener('keydown', fn);
        return function () { window.removeEventListener('keydown', fn); };
    }, []);

    /* Adressleiste als Zustand; gelesen und geschrieben wird in src/lib/route.ts. */
    const routeReady = useRef(false);
    const histReady = useRef(false);
    useEffect(function () {
        function apply() {
            const r = parseHash(location.hash, API_AVAILABLE);
            setView(r.view);
            if (r.map) setSelectedMap(r.map);
            if (r.angler) { setAngler(r.angler); setAnglerTab(r.anglerTab || 'uebersicht'); }
            if (r.view === 'gruppen') setGroupId(r.groupId ?? null);
            if (r.view === 'stats') setStatsTab(r.statsTab || 'reviere');
            if (r.view === 'arten') setOpenSpecies(r.species ?? null);
            // Der Spot erst nach dem Kartenwechsel: der setzt ihn selbst zurueck.
            if (r.view === 'map' && r.map) {
                setTimeout(function () { setSelectedSpot(r.spot ?? null); }, 0);
            }
        }
        apply();
        routeReady.current = true;
        window.addEventListener('hashchange', apply);
        return function () { window.removeEventListener('hashchange', apply); };
    }, []);
    useEffect(function () {
        if (!routeReady.current) return;
        const hash = buildHash({
            view: view, map: selectedMap, spot: selectedSpot, species: openSpecies,
            angler: angler, anglerTab: anglerTab, groupId: groupId
        });
        // Jeder Wechsel ist ein eigener Schritt im Verlauf, damit "Zurueck" im
        // Browser tut, was man erwartet. Der erste Aufruf ersetzt nur, sonst
        // laege beim Oeffnen sofort ein zusaetzlicher Eintrag im Verlauf.
        if (location.hash === hash) return;
        if (histReady.current) history.pushState(null, '', hash);
        else { history.replaceState(null, '', hash); histReady.current = true; }
    }, [view, selectedMap, selectedSpot, openSpecies, angler, anglerTab, groupId]);

    const isGlobal = selectedMap === '__all__';
    const map = D.maps.filter(function (m) { return m.id === selectedMap; })[0] || playable[0];
    const fishery = isGlobal ? null : (FISHERIES[map.id] || null);

    const allKeys = useMemo(function () {
        const s = {};
        Object.keys(FISHERIES).forEach(function (id) {
            FISHERIES[id].species.forEach(function (g) { s[g.s] = true; });
        });
        D.fish.forEach(function (f) { const k = speciesKey(f.name, f.de, f.mapId); if (k) s[k] = true; });
        return Object.keys(s);
    }, []);
    const allDone = allKeys.filter(function (k) { return caught[k]; }).length;

    function toggleFav(id) {
        setFavorites(function (x) { return x.indexOf(id) >= 0 ? x.filter(function (y) { return y !== id; }) : x.concat([id]); });
    }
    function toggleCatch(key) {
        const n = {};
        Object.keys(caught).forEach(function (k) { n[k] = caught[k]; });
        if (n[key]) delete n[key]; else n[key] = true;
        patchLocal({ caught: n });
    }
    /** Ein Import ersetzt den lokalen Stand vollständig. */
    function applyImport(res) {
        setLocal({
            caught: res.caught,
            bests: res.bests,
            stats: { player: res.player, fisheries: res.fisheries, bests: res.bests, total: res.total },
            updatedAt: new Date().toISOString()
        });
        setSyncNote(null);
    }


    return h('div', { className: 'min-h-screen water-grid' },
        h('div', { className: 'fixed inset-0 pointer-events-none overflow-hidden' },
            h('div', { className: 'absolute -top-32 left-[15%] h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl animate-floaty' }),
            h('div', { className: 'absolute top-[35%] right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-blue-600/10 blur-3xl' })),

        h(Header, {
            view: view, onView: setView, query: query, onQuery: setQuery, searchRef: searchRef,
            me: me, caught: allDone, total: allKeys.length,
            onBrand: function () {
                if (API_AVAILABLE) { setView('start'); return; }
                setView('map'); setSelectedMap(playable[0].id);
            },
            onOpenSelf: function () {
                if (me) { setAngler(me.name); setAnglerTab('uebersicht'); setView('angler'); }
                else setView('anmelden');
            },
            onSources: function () { setSourceOpen(true); }
        }),
        h('div', {
            className: cn('relative mx-auto grid max-w-[1700px] grid-cols-1 gap-6 px-4 py-6 lg:px-7',
                view === 'map' && 'lg:grid-cols-[300px_minmax(0,1fr)]')
        },
            // Kartenliste nur in der Revieransicht
            view !== 'map' ? null : h(MapList, {
                selected: selectedMap, caught: caught, allKeys: allKeys,
                onSelect: function (id) { setSelectedMap(id); setQuery(''); setMethod('Alle'); }
            }),


            h('main', { className: 'min-w-0' },
                syncNote ? h('div', { className: 'ufs-note ok no-print', style: { marginBottom: '.9rem' } },
                    t('map.syncNote', { when: fmtWhen(syncNote) }),
                    h('button', {
                        className: 'ufs-btn', style: { marginLeft: '.6rem', padding: '.15rem .6rem' },
                        onClick: function () { setSyncNote(null); }
                    }, t('app.ok'))) : null,
                view === 'map' && !isGlobal || view === 'angler' || view === 'start' ? null : h('h1', { className: 'mb-4 text-2xl font-black tracking-tight text-white' },
                    view === 'bait' ? t('nav.baits')
                        : view === 'arten' ? t('nav.species')
                        : view === 'gruppen' ? t('group.title')
                        : view === 'anmelden' ? t('auth.title')
                        : view === 'stats' ? t('stats.title')
                        : t('map.overview')),
                view === 'start' ? h(StartPage, { onOpenSpecies: function (k) { setOpenSpecies(k); setView('arten'); } })
                : view === 'angler' ? h(ProfilePage, {
                    name: angler, me: me, local: local,
                    tab: anglerTab, onTab: setAnglerTab,
                    onBack: function () { setView('start'); },
                    onMe: function (u) { setMe(u); },
                    onLogout: function () { api('/auth/logout', { method: 'POST' }).then(function () { setMe(null); }); },
                    onOpenUser: function (n) { setAngler(n); setAnglerTab('uebersicht'); setView('angler'); },
                    onOpenGroups: function () { setGroupId(null); setView('gruppen'); }
                })
                : view === 'bait' ? h(BaitPage, null)
                : view === 'gruppen' ? h(GroupsPage, {
                    me: me, openId: groupId, onOpen: setGroupId,
                    onOpenUser: function (name) { setAngler(name); setAnglerTab('uebersicht'); setView('angler'); },
                    onLogin: function () { setView('anmelden'); }
                })
                : view === 'anmelden' ? h('div', { style: { maxWidth: '520px' } },
                    h(LoginPanel, { onLogin: function (u) { setMe(u); setView('start'); } }))
                : view === 'stats' ? h(StatsPage, {
                    stats: saveStats, tab: statsTab, apiAvailable: API_AVAILABLE,
                    me: me,
                    onOpenCommunity: function () { setView('anmelden'); },
                    onReset: function () {
                        resetLocal();
                        setSyncNote(null);
                    },
                    onImport: function () { setImportOpen(true); },
                    onOpenMap: function (id) { setSelectedMap(id); setView('map'); },
                    onOpenSpecies: function (k) { setOpenSpecies(k); setView('arten'); }
                })
                : view === 'arten' ? h(SpeciesPage, {
                    caught: caught, bests: bests,
                    initialOpen: openSpecies, onOpen: setOpenSpecies
                })
                : isGlobal ? h(GlobalOverview, {
                    caught: caught, allKeys: allKeys,
                    onOpenMap: function (id) { setSelectedMap(id); }
                })
                : h(FisheryView, {
                    map: map, query: query, caught: caught, bests: bests,
                    favorites: favorites, onToggleFav: toggleFav, onToggleCatch: toggleCatch,
                    onSources: function () { setSourceOpen(true); },
                    selectedSpot: selectedSpot, onSelectSpot: setSelectedSpot
                }))),

        sourceOpen ? h(SourcesPanel, { onClose: function () { setSourceOpen(false); } }) : null,
        importOpen ? h(ImportDialog, {
            me: me,
            onClose: function () { setImportOpen(false); },
            onImport: applyImport,
            onReset: function () {
                resetLocal();
            }
        }) : null);
}

export default App
