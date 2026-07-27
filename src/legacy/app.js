/*
 * The original single-file app, now an ES module.
 *
 * It still builds its views with React.createElement instead of JSX; that was
 * the price of running without a build step. Nothing here is meant to stay:
 * piece by piece these views move into typed components under src/components,
 * and this file shrinks until it disappears.
 */
import React from 'react'
import {
    BAITS, BAITS_FOR, FISHERIES, GAME, GUIDE, HOOKS, SPECIES,
    baitName, norm, speciesKey, speciesName,
} from '../data'
import { API_AVAILABLE, api } from '../lib/api'
import { DASH, cn, fmtAgo, fmtNum, fmtTime, fmtWhen, newerThan } from '../lib/format'
import { Badge, Bar, Icon, Mini, Select } from '../components/primitives'
import { Toggle } from '../components/ui'
import GroupsPage from '../components/groups/GroupsPage'
import { Follows } from '../components/profile/Follows'
import StartPage from '../components/start/StartPage'
import { LangSwitch } from '../components/LangSwitch'
import { useI18n } from '../i18n'
import { fisheryLabel, parseProfile, profileToCatches } from '../lib/savegame'
import { fitSteps, gapRange, stepRange } from '../lib/hooks'
import BaitPage from '../components/bait/BaitPage'
import {
    Activity, BaitTop, BiteFactors, MethodList, RetrieveList, SizeFit,
    bestHours, methodTop, spinTop
} from '../components/species/facts'
import SpeciesPage from '../components/species/SpeciesPage'
import { FishCard } from '../components/species/FishCard'


import StatsPage from '../components/stats/StatsPage'
import { Stat } from '../components/primitives'
import GlobalOverview from '../components/stats/GlobalOverview'
import { FisheryMap, SpotPanel } from '../components/map/FisheryMap'
import ImportDialog from '../components/save/ImportDialog'
import SourcesPanel from '../components/SourcesPanel'
import LoginPanel from '../components/auth/LoginPanel'
import ProfilePage from '../components/profile/ProfilePage'
import { storedStamp, useLocalState } from '../lib/localState'
import { buildHash, parseHash } from '../lib/route'

const { useCallback, useEffect, useMemo, useRef, useState } = React
const h = React.createElement

const D = GUIDE
const G = GAME


/**
 * Überschriften der Kartengruppen. Der Guide führt sie unter deutschen Namen,
 * die Anzeige nimmt den Wörterbucheintrag – unbekannte Gruppen bleiben stehen.
 */
const MAP_GROUPS = {
    'Basis': 'map.groupBase', 'Variante': 'map.groupVariant',
    'DLC': 'map.groupDlc', 'Angekündigt': 'map.groupAnnounced'
};
function groupLabel(g, t) { return MAP_GROUPS[g] ? t(MAP_GROUPS[g]) : g; }

const accent = {
    cyan: 'from-cyan-400/20 via-blue-500/10 to-transparent', sky: 'from-sky-400/20 via-cyan-500/10 to-transparent',
    amber: 'from-amber-400/20 via-orange-500/10 to-transparent', emerald: 'from-emerald-400/20 via-teal-500/10 to-transparent',
    blue: 'from-blue-400/20 via-indigo-500/10 to-transparent', indigo: 'from-indigo-400/20 via-violet-500/10 to-transparent',
    lime: 'from-lime-400/20 via-emerald-500/10 to-transparent', teal: 'from-teal-400/20 via-cyan-500/10 to-transparent',
    orange: 'from-orange-400/20 via-rose-500/10 to-transparent', rose: 'from-rose-400/20 via-pink-500/10 to-transparent',
    violet: 'from-violet-400/20 via-fuchsia-500/10 to-transparent', fuchsia: 'from-fuchsia-400/20 via-violet-500/10 to-transparent',
    yellow: 'from-yellow-400/20 via-amber-500/10 to-transparent', slate: 'from-slate-400/20 via-cyan-500/10 to-transparent',
    zinc: 'from-zinc-400/20 via-blue-500/10 to-transparent', green: 'from-green-400/20 via-emerald-500/10 to-transparent',
    pink: 'from-pink-400/20 via-rose-500/10 to-transparent', red: 'from-red-400/20 via-orange-500/10 to-transparent',
    stone: 'from-stone-400/15 via-slate-500/10 to-transparent'
};

/* ------------------------------------------------------------ Köderdaten */







/* ------------------------------------------------------------------- App */

function App() {
    const playable = D.maps.filter(function (m) { return m.status === 'playable'; });
    const [selectedMap, setSelectedMap] = useState(playable[0].id);
    const [query, setQuery] = useState('');
    const [method, setMethod] = useState('Alle');
    const [confidence, setConfidence] = useState('Alle');
    const [catchFilter, setCatchFilter] = useState('Alle');
    const [onlyFav, setOnlyFav] = useState(false);
    const [showOverlay, setShowOverlay] = useState(true);
    const [compact, setCompact] = useState(false);
    const [sourceOpen, setSourceOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [pinned, setPinned] = useState(null);
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
    const [highlight, setHighlight] = useState(null);
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
    useEffect(function () { setSelectedSpot(null); setHighlight(null); setPinned(null); }, [selectedMap]);

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

    /* Guide-Einträge dieser Karte plus Arten, die nur in den Spieldateien stehen. */
    const rows = useMemo(function () {
        const guide = D.fish.filter(function (f) { return f.mapId === map.id; });
        const gameByKey = {};
        if (fishery) fishery.species.forEach(function (g) { gameByKey[g.s] = g; });

        const used = {};
        const list = guide.map(function (f) {
            const key = speciesKey(f.name, f.de, f.mapId);
            if (key) used[key] = true;
            return { f: f, key: key, game: key ? gameByKey[key] : null, gameOnly: false };
        });
        if (fishery) {
            fishery.species.forEach(function (g) {
                if (used[g.s]) return;
                const sp = SPECIES[g.s] || {};
                list.push({
                    key: g.s, game: g, gameOnly: true,
                    f: {
                        id: map.id + '-game-' + g.s.toLowerCase(), mapId: map.id,
                        name: sp.en || g.s, de: sp.de || sp.en || g.s,
                        spots: g.spots && g.spots.length ? t('gameOnly.spots', { list: g.spots.join(', ') }) : t('gameOnly.seeMap'),
                        hook: t('gameOnly.hook'), bait: '—', groundbait: '—',
                        depth: t('gameOnly.depth'), method: t('gameOnly.method'),
                        retrieve: '—', time: 'Keine feste Zeit belegt',
                        notes: t('gameOnly.notes'),
                        confidence: 'hoch', sources: [], dlc: null, tags: []
                    }
                });
            });
        }
        return list;
    }, [map.id, fishery]);

    const methods = useMemo(function () {
        const set = {};
        rows.forEach(function (r) { r.f.method.split(' / ').forEach(function (m) { set[m] = true; }); });
        return ['Alle'].concat(Object.keys(set).sort());
    }, [rows]);

    const filtered = useMemo(function () {
        return rows.filter(function (r) {
            const f = r.f;
            if (query) {
                const hay = (Object.keys(f).map(function (k) { return f[k]; }).join(' ') + ' ' + (r.key || '') + ' ' + speciesName(r.key, 'de')).toLowerCase();
                if (hay.indexOf(query.toLowerCase()) < 0) return false;
            }
            if (method !== 'Alle' && f.method.indexOf(method) < 0) return false;
            if (confidence !== 'Alle' && f.confidence !== confidence) return false;
            if (onlyFav && favorites.indexOf(f.id) < 0) return false;
            if (!showOverlay && f.dlc === 'New Fish Species') return false;
            if (catchFilter === 'offen' && r.key && caught[r.key]) return false;
            if (catchFilter === 'gefangen' && !(r.key && caught[r.key])) return false;
            if (pinned && r.key !== pinned) return false;
            if (selectedSpot) {
                if (!r.game || !r.game.spots || r.game.spots.indexOf(selectedSpot) < 0) return false;
            }
            return true;
        });
    }, [rows, query, method, confidence, onlyFav, favorites, showOverlay, catchFilter, caught, selectedSpot, pinned]);

    /* Fortschritt */
    const mapKeys = useMemo(function () {
        const s = {};
        rows.forEach(function (r) { if (r.key) s[r.key] = true; });
        return Object.keys(s);
    }, [rows]);
    const mapDone = mapKeys.filter(function (k) { return caught[k]; }).length;

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

    const grouped = D.maps.reduce(function (a, m) { (a[m.group] = a[m.group] || []).push(m); return a; }, {});
    const spotObj = fishery && selectedSpot
        ? fishery.spots.filter(function (s) { return s.n === selectedSpot; })[0] : null;

    /* Artenliste neben der Karte: Szenenarten plus die nur im Guide belegten
       (New-Fish-Species-DLC hinterlegt keine Spawnpunkte in der Szene). */
    const panelList = useMemo(function () {
        const out = [];
        if (fishery) fishery.species.forEach(function (g) {
            out.push({ s: g.s, fish: g.fish, spots: g.spots, guideOnly: false, dlc: !!g.dlc });
        });
        const seen = {};
        out.forEach(function (o) { seen[o.s] = true; });
        rows.forEach(function (r) {
            if (!r.key || r.game || seen[r.key]) return;
            seen[r.key] = true;
            out.push({ s: r.key, fish: null, spots: [], guideOnly: true, hint: r.f.spots, dlc: r.f.dlc });
        });
        return out;
    }, [fishery, rows]);

    return h('div', { className: 'min-h-screen water-grid' },
        h('div', { className: 'fixed inset-0 pointer-events-none overflow-hidden' },
            h('div', { className: 'absolute -top-32 left-[15%] h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl animate-floaty' }),
            h('div', { className: 'absolute top-[35%] right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-blue-600/10 blur-3xl' })),

        h('header', { className: 'no-print sticky top-0 z-40 border-b border-white/10 bg-[#061017]/80 backdrop-blur-xl' },
            h('div', { className: 'ufs-headrow mx-auto max-w-[1700px] px-4 py-3 lg:px-7' },
                h('button', {
                    onClick: function () {
                        if (API_AVAILABLE) { setView('start'); return; }
                        setView('map'); setSelectedMap(playable[0].id);
                    },
                    className: 'flex shrink-0 items-center gap-3 text-left',
                    style: { cursor: 'pointer' },
                    title: 'Zur Startseite'
                },
                    h('span', { className: 'grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/20 to-blue-500/10 shadow-glow' },
                        h(Icon, { name: 'fish', className: 'text-cyan-200' })),
                    h('span', null,
                        h('span', { className: 'block text-sm font-black tracking-[.22em] text-cyan-200' }, 'UFS ATLAS'),
                        h('span', { className: 'block text-[10px] text-slate-500' }, 'Ultimate Fishing Simulator 1'))),
                h('div', { className: 'ufs-search relative ml-auto w-full max-w-xl' },
                    h(Icon, { name: 'search', className: 'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500' }),
                    h('input', {
                        ref: searchRef, value: query, onChange: function (e) { setQuery(e.target.value); },
                        placeholder: t('app.searchPlaceholder') + '  /',
                        className: 'w-full rounded-2xl border border-white/10 bg-white/[.045] py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-cyan-400/50 focus:bg-white/[.07]'
                    })),
                h('div', { className: 'ufs-headnav' },
                    h('button', {
                        className: cn('ufs-btn', view === 'map' && 'primary'),
                        onClick: function () { setView('map'); }
                    }, h(Icon, { name: 'map' }), h('span', { className: 'lbl' }, t('nav.fisheries'))),
                    h('button', {
                        className: cn('ufs-btn', view === 'arten' && 'primary'),
                        onClick: function () { setView('arten'); }
                    }, h(Icon, { name: 'fish' }), h('span', { className: 'lbl' }, t('nav.species'))),
                    h('button', {
                        className: cn('ufs-btn', view === 'bait' && 'primary'),
                        onClick: function () { setView('bait'); }
                    }, h(Icon, { name: 'bait' }), h('span', { className: 'lbl' }, t('nav.baits'))),
                    h('button', {
                        className: cn('ufs-btn', view === 'stats' && 'primary'),
                        onClick: function () { setView('stats'); }
                    }, h(Icon, { name: 'scale' }), h('span', { className: 'lbl' }, t('nav.stats'))),
                    API_AVAILABLE ? h('button', {
                        className: cn('ufs-btn', (view === 'angler' || view === 'anmelden') && 'primary'),
                        title: me ? t('map.profileTitle') : t('nav.login'),
                        onClick: function () {
                            if (me) { setAngler(me.name); setAnglerTab('uebersicht'); setView('angler'); }
                            else setView('anmelden');
                        }
                    }, h(Icon, { name: 'user' }), h('span', { className: 'lbl' }, me ? t('nav.profile') : t('nav.login'))) : null,
                    h(LangSwitch, null),
                    h('span', { className: 'ufs-chip ufs-mono', title: t('nav.caughtTotal') }, '✓ ' + allDone + ' / ' + allKeys.length),
                    h('button', { className: 'ufs-btn', onClick: function () { setSourceOpen(true); } },
                        h(Icon, { name: 'source' }), h('span', { className: 'lbl' }, t('nav.sources')))))),

        h('div', {
            className: cn('relative mx-auto grid max-w-[1700px] grid-cols-1 gap-6 px-4 py-6 lg:px-7',
                view === 'map' && 'lg:grid-cols-[300px_minmax(0,1fr)]')
        },
            // Kartenliste nur in der Revieransicht
            view !== 'map' ? null : h('aside', { className: 'no-print hidden self-start lg:sticky lg:top-24 lg:block' },
                h('div', { className: 'glass scrollbar max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl border border-white/10 p-3 shadow-2xl' },
                    h('div', { className: 'px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-[.18em] text-slate-500' }, t('map.maps')),
                    h('button', {
                        onClick: function () { setSelectedMap('__all__'); },
                        className: cn('group mb-3 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition',
                            selectedMap === '__all__' ? 'border border-cyan-300/20 bg-cyan-400/10' : 'border border-transparent hover:bg-white/[.045]')
                    },
                        h('span', { className: 'h-2.5 w-2.5 rounded-full bg-cyan-300/70' }),
                        h('span', { className: 'min-w-0 flex-1' },
                            h('span', { className: 'block truncate text-sm font-semibold text-slate-200' }, t('map.overview')),
                            h('span', { style: { display: 'block', marginTop: '3px' } },
                                h(Bar, { value: allDone, total: allKeys.length, thin: true }))),
                        h('span', { className: 'text-[10px] tabular-nums text-slate-600' }, allDone + '/' + allKeys.length)),
                    Object.keys(grouped).map(function (group) {
                        return h('div', { key: group, className: 'mb-4' },
                            h('div', { className: 'px-3 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-600' }, groupLabel(group, t)),
                            h('div', { className: 'space-y-1' }, grouped[group].map(function (m) {
                                const fy = FISHERIES[m.id];
                                const keys = {};
                                if (fy) fy.species.forEach(function (g) { keys[g.s] = true; });
                                D.fish.forEach(function (f) {
                                    if (f.mapId !== m.id) return;
                                    const k = speciesKey(f.name, f.de, f.mapId);
                                    if (k) keys[k] = true;
                                });
                                const ks = Object.keys(keys);
                                const dn = ks.filter(function (k) { return caught[k]; }).length;
                                return h('button', {
                                    key: m.id,
                                    onClick: function () { setSelectedMap(m.id); setQuery(''); setMethod('Alle'); },
                                    className: cn('group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition',
                                        selectedMap === m.id ? 'border border-cyan-300/20 bg-cyan-400/10' : 'border border-transparent hover:bg-white/[.045]')
                                },
                                    h('span', { className: cn('h-2.5 w-2.5 rounded-full', m.status === 'announced' ? 'bg-slate-600' : 'bg-cyan-300/70') }),
                                    h('span', { className: 'min-w-0 flex-1' },
                                        h('span', { className: 'block truncate text-sm font-semibold text-slate-200' }, m.name),
                                        ks.length
                                            ? h('span', { style: { display: 'block', marginTop: '3px' } }, h(Bar, { value: dn, total: ks.length, thin: true }))
                                            : h('span', { className: 'block truncate text-[10px] text-slate-500' }, m.water)),
                                    h('span', { className: 'text-[10px] tabular-nums text-slate-600' }, ks.length ? dn + '/' + ks.length : '–'));
                            })));
                    }))),

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
                : h(React.Fragment, null,
                h('div', { className: 'no-print scrollbar mb-4 flex gap-2 overflow-x-auto pb-2 lg:hidden' },
                    D.maps.map(function (m) {
                        return h('button', {
                            key: m.id, onClick: function () { setSelectedMap(m.id); },
                            className: cn('shrink-0 rounded-full border px-3 py-2 text-xs font-semibold',
                                selectedMap === m.id ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100' : 'border-white/10 bg-white/[.04] text-slate-400')
                        }, m.name);
                    })),

                h('section', { className: cn('noise relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br p-6 shadow-2xl lg:p-8', accent[map.accent]) },
                    h('div', { className: 'absolute inset-0 bg-gradient-to-b from-white/[.03] to-[#061017]/55' }),
                    h('div', { className: 'relative grid gap-7 xl:grid-cols-[1fr_370px]' },
                        h('div', null,
                            h('div', { className: 'mb-4 flex flex-wrap gap-2' },
                                h(Badge, { tone: map.group === 'DLC' ? 'violet' : map.status === 'announced' ? 'slate' : 'cyan' }, map.group),
                                h(Badge, null, map.region), h(Badge, null, map.water),
                                map.variant ? h(Badge, { tone: 'amber' }, map.variant) : null),
                            h('h1', { className: 'max-w-4xl text-3xl font-black tracking-tight text-white sm:text-5xl' }, map.name),
                            h('p', { className: 'mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base' }, map.summary),
                            h('div', { className: 'mt-6 grid gap-3 sm:grid-cols-3' },
                                h(Mini, { label: t('map.style'), value: map.style }),
                                h(Mini, { label: t('nav.species'), value: mapKeys.length ? t('map.caughtOf', { done: mapDone, total: mapKeys.length }) : t('map.entries', { n: rows.length }) }),
                                h(Mini, { label: t('map.spotsFromFiles'), value: fishery && fishery.spots.length ? String(fishery.spots.length) : DASH })),
                            mapKeys.length ? h('div', { style: { marginTop: '.9rem', maxWidth: '520px' } }, h(Bar, { value: mapDone, total: mapKeys.length })) : null),
                        h('div', { className: 'rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl' },
                            h('div', { className: 'flex items-center gap-2 text-sm font-bold text-cyan-100' }, h(Icon, { name: 'info' }), t('map.readHead')),
                            h('p', { className: 'mt-3 text-sm leading-6 text-slate-400' },
                                t('map.readNote')),
                            h('div', { className: 'mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[.07] p-3 text-xs leading-5 text-amber-100/80' },
                                t('map.emptySpotNote'))))),

                fishery ? h('section', { className: 'no-print mt-5 ufs-maplayout' },
                    h(FisheryMap, {
                        fishery: fishery, selected: selectedSpot, onSelect: setSelectedSpot,
                        caught: caught, highlight: pinned || highlight
                    }),
                    h('div', { className: 'ufs-col' },
                        spotObj
                            ? h(SpotPanel, { spot: spotObj, caught: caught })
                            : h('div', { className: 'ufs-spotcard' },
                                h('h3', null, t('map.speciesHere')),
                                h('div', { className: 'ufs-splist' },
                                    panelList.slice(0, 18).map(function (g) {
                                        return h('div', {
                                            key: g.s,
                                            className: cn('ufs-spline', pinned === g.s && 'pin'),
                                            style: { cursor: 'pointer' },
                                            onMouseEnter: function () { if (!g.guideOnly) setHighlight(g.s); },
                                            onMouseLeave: function () { setHighlight(null); },
                                            onClick: function () { setPinned(pinned === g.s ? null : g.s); }
                                        },
                                            h('span', { className: cn('n', caught[g.s] && 'done') },
                                                (caught[g.s] ? '✓ ' : '') + speciesName(g.s, lang)),
                                            h('span', { className: 'q' },
                                                g.guideOnly ? t('map.guideOnly') : (g.dlc ? t('map.dlcSpecies') : t('map.fishHere', { n: g.fish }))),
                                            h('span', { className: 'd' },
                                                g.guideOnly ? (g.hint || '–')
                                                    : (g.spots.length ? t('map.spotList', { list: g.spots.slice(0, 4).join(', ') })
                                                        : (g.dlc ? 'frei verteilt' : '–'))));
                                    })),
                                panelList.length > 18
                                    ? h('div', { className: 'ufs-muted', style: { fontSize: '11px', marginTop: '.4rem' } },
                                        '+ ' + (panelList.length - 18) + ' weitere Arten')
                                    : null,
                                panelList.some(function (g) { return g.guideOnly; })
                                    ? h('div', { className: 'ufs-muted', style: { fontSize: '10.5px', marginTop: '.5rem', lineHeight: 1.5 } },
                                        t('map.guideOnlyNote'))
                                    : null),
                        !fishery.fitOk
                            ? h('div', { className: 'ufs-note', style: { fontSize: '11.5px' } },
                                // Offshore-Reviere führen zu ihren Spots keine Weltkoordinaten:
                                // dort gibt es keine Reisepunkte, man fährt selbst hinaus.
                                fishery.spots.some(function (s) { return s.wx !== undefined && s.wx !== null; })
                                    ? t('map.noProjection')
                                    : t('map.boatOnly'))
                            : null)) : null,

                h('section', { className: 'no-print mt-5 rounded-3xl border border-white/10 bg-white/[.025] p-4' },
                    h('div', { className: 'flex flex-wrap items-center gap-3' },
                        h('div', { className: 'flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-slate-500' }, h(Icon, { name: 'filter' }), t('map.filter')),
                        h(Select, { value: method, onChange: setMethod, options: methods, labels: { Alle: t('map.filterAll') } }),
                        h(Select, {
                            value: confidence, onChange: setConfidence, options: ['Alle', 'hoch', 'mittel', 'niedrig'],
                            labels: {
                                Alle: t('map.filterAll'), hoch: t('map.filterConfHigh'),
                                mittel: t('map.filterConfMedium'), niedrig: t('map.filterConfLow')
                            }
                        }),
                        h(Select, {
                            value: catchFilter, onChange: setCatchFilter, options: ['Alle', 'offen', 'gefangen'],
                            labels: {
                                Alle: t('map.filterAllSpecies'), offen: t('map.filterOpen'),
                                gefangen: t('map.filterCaught')
                            }
                        }),
                        h(Toggle, { active: lang === 'de', onClick: function () { i18n.setLang(lang === 'de' ? 'en' : 'de'); } },
                            lang === 'de' ? t('map.termsDe') : t('map.termsEn')),
                        h(Toggle, { active: showOverlay, onClick: function () { setShowOverlay(!showOverlay); } }, 'New-Species-DLC'),
                        h(Toggle, { active: onlyFav, onClick: function () { setOnlyFav(!onlyFav); } }, h(Icon, { name: 'star' }), t('map.favorites')),
                        h(Toggle, { active: compact, onClick: function () { setCompact(!compact); } }, t('map.compact')),
                        selectedSpot ? h(Toggle, { active: true, onClick: function () { setSelectedSpot(null); } }, t('map.onlySpot', { n: selectedSpot })) : null,
                        pinned ? h(Toggle, { active: true, onClick: function () { setPinned(null); } }, t('map.onlySpecies', { name: speciesName(pinned, lang) })) : null,
                        h('span', { className: 'ml-auto text-xs tabular-nums text-slate-500' }, t('map.filterCount', { shown: filtered.length, total: rows.length })))),

                map.status === 'announced'
                    ? h('div', { className: 'mt-6 rounded-3xl border border-white/10 bg-white/[.03] p-10 text-center text-slate-400' },
                        h('div', { className: 'text-4xl' }, '◌'),
                        h('h2', { className: 'mt-3 text-xl font-bold text-white' }, t('map.announcedTitle')),
                        h('p', { className: 'mt-2' }, t('map.announcedText')))
                    : h('section', { className: cn('mt-6 grid gap-4', compact ? 'xl:grid-cols-2' : 'grid-cols-1') },
                        filtered.map(function (r) {
                            return h(FishCard, {
                                key: r.f.id, f: r.f, speciesKey: r.key, gameEntry: r.game, gameOnly: r.gameOnly,
                                compact: compact, favorite: favorites.indexOf(r.f.id) >= 0,
                                onFav: function () { toggleFav(r.f.id); },
                                onSource: function () { setSourceOpen(true); },
                                caught: caught, bests: bests, lang: lang,
                                onToggleCatch: toggleCatch,
                                selectedSpot: selectedSpot,
                                onPickSpot: function (n) { setSelectedSpot(selectedSpot === n ? null : n); }
                            });
                        }),
                        !filtered.length
                            ? h('div', { className: 'rounded-3xl border border-dashed border-white/15 p-12 text-center text-slate-500' },
                                t('map.noHits'))
                            : null),

                h('section', { className: 'mt-8 rounded-3xl border border-white/10 bg-white/[.025] p-6 text-sm leading-7 text-slate-400' },
                    h('h2', { className: 'text-lg font-bold text-white' }, t('map.hookAdviceTitle')),
                    h('p', { className: 'mt-2' },
                        t('map.hookAdvice'))),

                h('footer', { className: 'py-10 text-center text-xs text-slate-600' },
                    'UFS Atlas · Guide-Stand ' + D.generated + ' · Spieldaten ' + (G.generated || '–') +
                    ' · Fan-Projekt, nicht offiziell mit den Entwicklern verbunden.')))),

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
