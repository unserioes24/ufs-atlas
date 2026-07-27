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






/* --------------------------------------------------------- Profilspeicher */

/**
 * Es gibt genau einen lokalen Stand. Ältere Fassungen speicherten mehrere
 * Profile – davon wird einmalig das zuletzt aktive übernommen.
 */
function loadLocal() {
    try {
        const p = JSON.parse(localStorage.getItem('ufs-profiles') || 'null');
        if (p && p.list && p.list.length) {
            const act = p.list.filter(function (x) { return x.id === p.active; })[0] || p.list[0];
            localStorage.removeItem('ufs-profiles');
            return { caught: act.caught || {}, bests: act.bests || {}, stats: act.stats || null };
        }
    } catch (e) { /* auf die Einzelschlüssel zurückfallen */ }
    let caught = {}, bests = {}, stats = null;
    try { caught = JSON.parse(localStorage.getItem('ufs-caught') || '{}'); } catch (e) { }
    try { bests = JSON.parse(localStorage.getItem('ufs-bests') || '{}'); } catch (e) { }
    try { stats = JSON.parse(localStorage.getItem('ufs-stats') || 'null'); } catch (e) { }
    const at = localStorage.getItem('ufs-updated') || null;
    return { caught: caught, bests: bests, stats: stats, updatedAt: at };
}


/* ------------------------------------------------- Teilbares Anglerprofil */

/** Adresse, unter der ein Profil erreichbar ist – der Teil zum Weitergeben. */
function profileUrl(name) {
    return location.origin + location.pathname + '#angler/' + encodeURIComponent(name);
}

const kg1 = function (v) { return fmtNum(v, 1) + ' kg'; };
const kg2 = function (v) { return v ? v.toFixed(2) + ' kg' : '–'; };
const plain = function (v) { return fmtNum(v); };

/**
 * Kennzahlen, die im Vergleich Zeile für Zeile gegenübergestellt werden.
 * Erster Eintrag ist der Wörterbuchschlüssel der Zeile, letzter der Schlüssel
 * der Erklärung – die bleibt bei abgeleiteten Werten wichtig. Leer heißt: keine.
 */
const DUEL_GROUPS = [
    ['duel.progress', [
        ['duel.speciesCaught', function (p) { return p.speciesCount; }, plain, ''],
        ['stats.fisheriesComplete', function (p) { return p.fisheriesComplete; }, plain, 'overview.completeSub'],
        ['duel.fisheriesVisited', function (p) { return Object.keys(p.fisheries || {}).length; }, plain, 'duel.atLeastOneBite'],
        ['stats.level', function (p) { return p.level; }, plain, ''],
        ['stats.points', function (p) { return p.score; }, plain, '']
    ]],
    ['duel.yield', [
        ['stats.catches', function (p) { return p.totals.fish; }, plain, ''],
        ['stats.bites', function (p) { return p.totals.bites; }, plain, ''],
        ['stats.totalWeight', function (p) { return p.totals.weight; }, kg1, ''],
        ['stats.time', function (p) { return p.totals.time; }, fmtTime, '']
    ]],
    ['duel.records', [
        ['duel.heaviestFish', function (p) { return p.biggest.weight; }, kg2, ''],
        ['duel.longestFish', function (p) { return p.biggest.length; },
            function (v) { return v ? Math.round(v * 100) + ' cm' : DASH; }, ''],
        ['duel.weightOneSpecies', function (p) { return p.topSpecies.weight; }, kg1, 'duel.sumStrongest']
    ]],
    ['duel.efficiency', [
        ['duel.bitesUsed', function (p) { return p.totals.bites ? p.totals.fish / p.totals.bites * 100 : 0; },
            function (v) { return fmtNum(v, 1) + ' %'; }, 'duel.catchesPerBite'],
        ['duel.catchesPerHour', function (p) { return p.totals.time ? p.totals.fish / (p.totals.time / 3600) : 0; },
            function (v) { return fmtNum(v, 1); }, ''],
        ['duel.weightPerCatch', function (p) { return p.totals.fish ? p.totals.weight / p.totals.fish : 0; }, kg2, ''],
        ['duel.pointsPerHour', function (p) { return p.totals.time ? p.score / (p.totals.time / 3600) : 0; },
            function (v) { return fmtNum(v, 0); }, '']
    ]]
];

const DUEL_FILTERS = [
    ['alle', 'duel.filterAll'],
    ['diff', 'duel.filterDiff'],
    ['both', 'duel.filterBoth'],
    ['his', 'duel.filterHis'],
    ['mine', 'duel.filterMine'],
    ['lead', 'duel.filterLead'],
    ['behind', 'duel.filterBehind']
];

/**
 * Fortschritt je Revier aus einem Profil ableiten. Die Artenliste eines
 * Reviers steht in den Spieldaten, gefangen ist, was im Profil auftaucht.
 */
function fisheryStats(p) {
    return Object.keys(FISHERIES).map(function (id) {
        const m = D.maps.filter(function (x) { return x.id === id; })[0];
        const keys = FISHERIES[id].species.map(function (g) { return g.s; });
        const done = keys.filter(function (k) { return p.species[k]; });
        const st = (p.fisheries || {})[id] || null;

        return {
            id: id, name: m ? m.name : id, water: m ? m.water : '',
            total: keys.length, done: done.length,
            missing: keys.filter(function (k) { return !p.species[k]; }),
            fish: st ? st.fish : 0, bites: st ? st.bites : 0, weight: st ? st.weight : 0,
            time: st ? st.time : 0, score: st ? st.score : 0,
            bigW: st ? st.bigW : 0, bigL: st ? st.bigL : 0
        };
    });
}

/** Ein Wert im Vergleich: gewinnt, verliert oder gleichauf. */
function duelClass(a, b) {
    if ((a || 0) === (b || 0)) return '';

    return (a || 0) > (b || 0) ? 'win' : 'lose';
}

/**
 * Profilseite eines Anglers. Ohne Anmeldung zeigt sie nur die Zahlen, mit
 * Anmeldung stellt sie beide Profile Wert für Wert gegenüber.
 */
function ProfilePage(props) {
    const { t, lang } = useI18n();
    const [data, setData] = useState(null);
    const [err, setErr] = useState(null);
    const [copied, setCopied] = useState(false);
    const [filter, setFilter] = useState('diff');
    const [busy, setBusy] = useState(false);
    // Der Reiter steht in der Adresse, damit sich auch ein einzelner
    // Abschnitt verlinken lässt: #angler/<Name>/gruppen
    const tab = props.tab || 'uebersicht';
    const setTab = props.onTab;

    const name = props.name;
    const load = useCallback(function () {
        if (!name) return;
        api('/users/name/' + encodeURIComponent(name))
            .then(setData)
            .catch(function (e) { setErr(e.message); });
    }, [name]);
    useEffect(function () {
        setData(null); setErr(null);
        load();
    }, [load, props.me && props.me.id]);

    const p = data && data.profile;
    const mine = data && data.me && data.me.profile;
    const duel = !!(p && mine && !data.self);

    /* Artenvergleich: beide Listen zusammenlegen, damit auch Lücken auffallen. */
    const rows = useMemo(function () {
        if (!duel) return [];
        const keys = {};
        Object.keys(p.species).forEach(function (k) { keys[k] = true; });
        Object.keys(mine.species).forEach(function (k) { keys[k] = true; });

        return Object.keys(keys).map(function (k) {
            const a = p.species[k] || null, b = mine.species[k] || null;
            return { k: k, name: speciesName(k, lang), a: a, b: b };
        }).sort(function (x, y) { return x.name.localeCompare(y.name, 'de'); });
    }, [duel, p, mine, lang]);

    const shown = rows.filter(function (r) {
        const aw = r.a ? r.a.best : 0, bw = r.b ? r.b.best : 0;
        if (filter === 'his') return r.a && !r.b;
        if (filter === 'mine') return r.b && !r.a;
        if (filter === 'both') return !!(r.a && r.b);
        if (filter === 'lead') return !!(r.b && (!r.a || bw > aw + 0.0005));
        if (filter === 'behind') return !!(r.a && (!r.b || aw > bw + 0.0005));
        if (filter === 'diff') {
            return !r.a || !r.b || Math.abs(aw - bw) > 0.0005 || r.a.count !== r.b.count;
        }

        return true;
    });

    function copy() {
        const url = profileUrl(data ? data.user.name : props.name);
        const done = function () { setCopied(true); setTimeout(function () { setCopied(false); }, 2000); };
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { prompt(t('profile.copyPrompt'), url); });
        else prompt(t('profile.copyPrompt'), url);
    }
    function toggleFollow() {
        if (!data || !props.me) return;
        setBusy(true);
        api('/follow/' + data.user.id, { method: data.following ? 'DELETE' : 'POST' })
            .then(function () { setData(Object.assign({}, data, { following: !data.following })); })
            .catch(function (e) { setErr(e.message); })
            .then(function () { setBusy(false); });
    }

    if (!API_AVAILABLE) {
        return h('div', { className: 'ufs-note' },
            t('profile.needsServer', { url: 'https://ufs-atlas.de' }));
    }

    // Menüpunkte: was es beim fremden Profil nicht zu sehen gibt, fällt weg.
    const self = !!(data && data.self);
    const items = [
        { k: 'uebersicht', t: t('profile.overview'), s: p ? t('profile.nSpecies', { n: fmtNum(p.speciesCount) }) : t('profile.noSaveYet') },
        p ? { k: 'reviere', t: t('nav.fisheries'), s: t('profile.nComplete', { n: fmtNum(p.fisheriesComplete) }) } : null,
        p ? { k: 'arten', t: t('nav.species'), s: t('profile.nRecords', { n: fmtNum(Object.keys(p.species).length) }) } : null,
        p ? { k: 'offen', t: t('profile.missing'), s: t('profile.nSpecies', { n: data.meta.totalSpecies - p.speciesCount }) } : null,
        duel ? { k: 'vergleich', t: t('profile.duel'), s: t('profile.nSpecies', { n: rows.length }) } : null,
        {
            k: 'follower', t: t('profile.followers'),
            s: (data ? (data.followers || 0) : 0) + ' folgen · folgt ' + (data ? (data.follows || 0) : 0)
        },
        { k: 'gruppen', t: t('profile.groups'), s: t('profile.nPieces', { n: data && data.groups ? data.groups.length : 0 }) },
        self ? { k: 'konto', t: t('profile.settings'), s: t('profile.settingsSub') } : null
    ].filter(Boolean);
    const active = items.some(function (x) { return x.k === tab; }) ? tab : 'uebersicht';

    if (!data) {
        return h('div', null,
            h('div', { className: 'ufs-row no-print', style: { marginBottom: '.9rem' } },
                h('button', { className: 'ufs-btn', onClick: props.onBack }, t('app.back'))),
            err ? h('div', { className: 'ufs-note' }, err) : h('p', { className: 'ufs-muted' }, 'Wird geladen …'));
    }

    // Dieselbe Spaltenaufteilung wie die Revieransicht; die Klasse steht so im
    // vorgefertigten Tailwind-Stylesheet und darf nicht abgewandelt werden.
    return h('div', { className: 'grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]' },
        // Seitenmenü im Stil der Revierliste
        h('aside', { className: 'no-print self-start lg:sticky lg:top-24' },
            h('div', { className: 'glass scrollbar max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl border border-white/10 p-3 shadow-2xl' },
                h('div', { className: 'px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-[.18em] text-slate-500' },
                    self ? t('profile.yours') : t('profile.other')),
                h('div', { className: 'space-y-1' }, items.map(function (it) {
                    return h('button', {
                        key: it.k, onClick: function () { setTab(it.k); },
                        className: cn('group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition',
                            active === it.k ? 'border border-cyan-300/20 bg-cyan-400/10' : 'border border-transparent hover:bg-white/[.045]')
                    },
                        h('span', { className: cn('h-2.5 w-2.5 rounded-full', active === it.k ? 'bg-cyan-300/70' : 'bg-slate-600') }),
                        h('span', { className: 'min-w-0 flex-1' },
                            h('span', { className: 'block truncate text-sm font-semibold text-slate-200' }, it.t),
                            h('span', { className: 'block truncate text-[10px] text-slate-500' }, it.s)));
                })),
                h('div', { className: 'ufs-menuactions' },
                    h('button', { className: 'ufs-btn', style: { width: '100%' }, onClick: copy },
                        copied ? t('app.copied') : t('profile.copyLink')),
                    props.me && !self
                        ? h('button', {
                            className: cn('ufs-btn', data.following && 'primary'), style: { width: '100%' },
                            disabled: busy, onClick: toggleFollow
                        }, data.following ? t('profile.following') : t('profile.follow'))
                        : null,
                    h('button', { className: 'ufs-btn', style: { width: '100%' }, onClick: props.onBack }, t('app.back'))))),

        h('div', { className: 'min-w-0' },
            err ? h('div', { className: 'ufs-note', style: { marginBottom: '.9rem' } }, err) : null,
            h('div', { className: 'ufs-profhead' },
                h('div', null,
                    h('h1', { className: 'text-2xl font-black tracking-tight text-white', style: { margin: 0 } }, data.user.name),
                    h('p', { className: 'ufs-muted', style: { fontSize: '12px', margin: '.25rem 0 0' } },
                        p ? t('profile.anglerLine', { name: p.anglerName || data.user.name })
                            + (p.version ? ' · Spielstand ' + p.version : '')
                            : t('profile.noSave'))),
                h('div', { className: 'ufs-row', style: { gap: '.5rem' } },
                    h('span', { className: 'ufs-chip', title: t('account.followersOf') },
                        'Follower ', h('b', null, fmtNum(data.followers || 0))),
                    h('span', { className: 'ufs-chip', title: t('account.followsOf') },
                        'Folgt ', h('b', null, fmtNum(data.follows || 0))),
                    p ? h('span', { className: 'ufs-stand' },
                        h('span', { className: 'lbl' }, 'Stand des Spielstands'),
                        h('span', { className: 'val' }, fmtWhen(p.updatedAt)),
                        h('span', { className: 'sub' }, fmtAgo(p.updatedAt))) : null)),

            active === 'gruppen'
                ? h(ProfileGroupList, {
                    groups: data.groups || [], self: self,
                    onOpenGroups: props.onOpenGroups
                })
                : active === 'follower'
                ? h(Follows, {
                    userId: data.user.id, name: data.user.name, self: self,
                    onOpenUser: props.onOpenUser
                })
                : active === 'konto' && props.me
                ? h(AccountPanel, {
                    me: props.me, local: props.local, onMe: props.onMe,
                    onLogout: props.onLogout, onOpenUser: props.onOpenUser
                })
                : active === 'vergleich' && duel
                ? h(ProfileDuel, {
                    data: data, p: p, mine: mine,
                    rows: shown, all: rows, filter: filter, onFilter: setFilter
                })
                : !p
                ? h('div', { className: 'ufs-note' }, 'Dieser Angler hat noch keinen Spielstand hochgeladen.')
                : h(ProfileDetails, { p: p, data: data, tab: active }),

            active === 'uebersicht' && !props.me
                ? h('div', { className: 'ufs-note no-print', style: { marginTop: '.9rem' } },
                    t('profile.duelSignIn', { name: data.user.name }))
                : null,
            active === 'uebersicht' && props.me && p && !mine && !self
                ? h('div', { className: 'ufs-note', style: { marginTop: '.9rem' } },
                    t('profile.duelNoSave'))
                : null));
}


/** Die Gruppen eines Profils; verwaltet werden sie auf der Gruppenseite. */
function ProfileGroupList(props) {
    const { t, lang } = useI18n();
    const groups = props.groups;
    return h('div', { className: 'ufs-spotcard' },
        h('div', { className: 'ufs-row', style: { justifyContent: 'space-between', marginBottom: '.6rem' } },
            h('h3', { style: { margin: 0 } }, props.self ? t('profile.yourGroups') : t('profile.groups')),
            props.self
                ? h('button', { className: 'ufs-btn', onClick: props.onOpenGroups }, t('account.manageGroups'))
                : null),
        !groups.length
            ? h('p', { className: 'ufs-muted', style: { fontSize: '12.5px', margin: 0 } },
                props.self
                    ? t('account.notInGroup')
                    : t('profile.noPublicGroup'))
            : h('div', { className: 'ufs-splist' }, groups.map(function (g) {
                return h('div', { key: g.id, className: 'ufs-grouprow' },
                    h('div', { className: 'main' },
                        h('span', { className: 'nm' }, g.name),
                        h('span', { className: 'sub' },
                            g.members + ' Mitglieder' + (g.owner ? ' · du bist Admin' : ' · von ' + g.ownerName))));
            })));
}

/**
 * Das Profil eines einzelnen Anglers in voller Breite: Kennzahlen, Fortschritt
 * je Revier, die Bestenliste seiner Arten und was ihm noch fehlt.
 */
function ProfileDetails(props) {
    const { t, lang } = useI18n();
    const p = props.p;
    const tab = props.tab || 'uebersicht';
    const [sort, setSort] = useState('sum');

    const keys = Object.keys(p.species);
    const rows = useMemo(function () {
        return keys.map(function (k) {
            const s = p.species[k];
            const m = D.maps.filter(function (x) { return x.id === s.fishery; })[0];
            return {
                k: k, name: speciesName(k, lang), count: s.count, best: s.best,
                length: s.length, sum: s.sum, where: m ? m.name : (s.fishery || '')
            };
        }).sort(function (a, b) {
            if (sort === 'name') return a.name.localeCompare(b.name, 'de');
            if (sort === 'count') return b.count - a.count;
            if (sort === 'best') return b.best - a.best;
            if (sort === 'length') return b.length - a.length;

            return b.sum - a.sum;
        });
    }, [p, lang, sort]);

    const fish = useMemo(function () {
        return fisheryStats(p).sort(function (a, b) {
            return (b.done / (b.total || 1)) - (a.done / (a.total || 1)) || a.name.localeCompare(b.name, 'de');
        });
    }, [p]);

    const quote = p.totals.bites ? p.totals.fish / p.totals.bites * 100 : 0;
    const perHour = p.totals.time ? p.totals.fish / (p.totals.time / 3600) : 0;
    const avg = p.totals.fish ? p.totals.weight / p.totals.fish : 0;
    const owned = Object.keys(p.owned || {}).sort(function (a, b) { return p.owned[b] - p.owned[a]; });

    const SORTS = [['sum', 'profile.sortSum'], ['best', 'profile.sortBest'], ['length', 'profile.sortLength'], ['count', 'profile.sortCount'], ['name', 'profile.sortName']];

    return h('div', null,
        tab !== 'uebersicht' ? null : h('div', { className: 'ufs-statgrid' },
            h(Stat, { label: t('stats.level'), value: fmtNum(p.level), sub: fmtNum(p.score) + ' ' + t('stats.points') }),
            h(Stat, {
                label: t('nav.species'), value: fmtNum(p.speciesCount) + ' / ' + props.data.meta.totalSpecies,
                sub: Math.round(p.speciesCount / (props.data.meta.totalSpecies || 1) * 100) + ' % der Artenliste'
            }),
            h(Stat, {
                label: t('stats.fisheriesComplete'), value: fmtNum(p.fisheriesComplete) + ' / ' + props.data.meta.totalFisheries,
                sub: Object.keys(p.fisheries || {}).length + ' Reviere bereist'
            }),
            h(Stat, { label: t('stats.catches'), value: fmtNum(p.totals.fish), sub: t('stats.bitesN', { n: fmtNum(p.totals.bites) }) }),
            h(Stat, { label: t('stats.totalWeight'), value: fmtNum(p.totals.weight, 1) + ' kg', sub: t('profile.avgPerCatch', { n: fmtNum(avg, 2) }) }),
            h(Stat, { label: t('stats.time'), value: fmtTime(p.totals.time), sub: t('profile.catchesPerHourSub', { n: fmtNum(perHour, 1) }) }),
            h(Stat, {
                label: t('stats.heaviest'), value: p.biggest.weight ? p.biggest.weight.toFixed(2) + ' kg' : DASH,
                sub: p.biggest.weightSpecies ? speciesName(p.biggest.weightSpecies, lang) : ''
            }),
            h(Stat, {
                label: t('stats.longest'), value: p.biggest.length ? Math.round(p.biggest.length * 100) + ' cm' : DASH,
                sub: p.biggest.lengthSpecies ? speciesName(p.biggest.lengthSpecies, lang) : ''
            }),
            h(Stat, {
                label: t('profile.topSpecies'), value: p.topSpecies.weight ? fmtNum(p.topSpecies.weight, 1) + ' kg' : DASH,
                sub: p.topSpecies.key ? speciesName(p.topSpecies.key, lang) : ''
            }),
            h(Stat, { label: t('duel.bitesUsed'), value: fmtNum(quote, 1) + ' %', sub: t('duel.catchesPerBite') }),
            p.money ? h(Stat, { label: t('stats.money'), value: fmtNum(p.money), sub: t('profile.experience', { n: fmtNum(p.exp) }) }) : null,
            p.luck || p.strength ? h(Stat, {
                label: t('profile.skills'), value: t('profile.luck', { n: fmtNum(p.luck, 1) }),
                sub: t('profile.strength', { n: fmtNum(p.strength, 1) })
            }) : null),

        tab !== 'uebersicht' ? null : h('div', { style: { margin: '1rem 0' } },
            h(Bar, { value: p.speciesCount, total: props.data.meta.totalSpecies })),

        tab === 'uebersicht' && owned.length
            ? h('div', { className: 'ufs-spotcard', style: { marginBottom: '.9rem' } },
                h('h3', null, t('stats.ownedGear')),
                h('div', { className: 'ufs-row', style: { gap: '.35rem', flexWrap: 'wrap' } },
                    owned.map(function (c) {
                        return h('span', { key: c, className: 'ufs-chip' }, categoryLabel(c, t) + ': ' + p.owned[c]);
                    })))
            : null,

        tab === 'reviere' ? h('div', { className: 'ufs-spotcard' },
            h('h3', null, 'Fortschritt je Revier'),
            h('div', { className: 'ufs-scroll' },
                h('table', { className: 'ufs-rec' },
                    h('thead', null, h('tr', null,
                        h('th', null, t('stats.colFishery')), h('th', null, t('nav.species')), h('th', null, t('overview.colProgress')),
                        h('th', null, t('stats.catches')), h('th', null, t('stats.bites')), h('th', null, t('profile.colWeight')),
                        h('th', null, t('stats.colTime')), h('th', null, t('stats.points')), h('th', null, t('stats.heaviest')), h('th', null, t('stats.longest')))),
                    h('tbody', null, fish.map(function (f) {
                        return h('tr', { key: f.id },
                            h('td', { className: cn('n', f.total && f.done === f.total && 'done') },
                                f.name, h('span', { className: 'hint' }, f.water)),
                            h('td', { className: 'num' }, f.done + ' / ' + f.total),
                            h('td', { style: { minWidth: '110px' } }, h(Bar, { value: f.done, total: f.total || 1, thin: true })),
                            h('td', { className: 'num' }, fmtNum(f.fish)),
                            h('td', { className: 'num' }, fmtNum(f.bites)),
                            h('td', { className: 'num' }, fmtNum(f.weight, 1) + ' kg'),
                            h('td', { className: 'num' }, f.time ? fmtTime(f.time) : '–'),
                            h('td', { className: 'num' }, fmtNum(f.score)),
                            h('td', { className: 'num' }, f.bigW ? f.bigW.toFixed(2) + ' kg' : '–'),
                            h('td', { className: 'num' }, f.bigL ? Math.round(f.bigL * 100) + ' cm' : '–'));
                    })))) ) : null,

        tab === 'arten' ? h('div', { className: 'ufs-spotcard' },
            h('div', { className: 'ufs-row', style: { justifyContent: 'space-between', marginBottom: '.7rem', flexWrap: 'wrap' } },
                h('h3', { style: { margin: 0 } }, 'Rekorde je Art'),
                h('div', { className: 'ufs-row no-print', style: { gap: '.35rem', flexWrap: 'wrap' } },
                    SORTS.map(function (s) {
                        return h(Toggle, { key: s[0], active: sort === s[0], onClick: function () { setSort(s[0]); } }, s[1]);
                    }))),
            h('div', { className: 'ufs-scroll' },
                h('table', { className: 'ufs-rec' },
                    h('thead', null, h('tr', null,
                        h('th', null, '#'), h('th', null, t('stats.colSpecies')), h('th', null, t('profile.sortCount')),
                        h('th', null, t('profile.sortBest')), h('th', null, t('profile.colBestLength')),
                        h('th', null, t('stats.totalWeight')), h('th', null, t('profile.colAvgPerPiece')), h('th', null, t('profile.colRecordFrom')))),
                    h('tbody', null, rows.map(function (r, i) {
                        return h('tr', { key: r.k },
                            h('td', { className: 'sub' }, i + 1),
                            h('td', { className: 'n' }, r.name),
                            h('td', { className: 'num' }, fmtNum(r.count)),
                            h('td', { className: 'num' }, r.best ? r.best.toFixed(2) + ' kg' : '–'),
                            h('td', { className: 'num' }, r.length ? Math.round(r.length * 100) + ' cm' : '–'),
                            h('td', { className: 'num' }, fmtNum(r.sum, 1) + ' kg'),
                            h('td', { className: 'num' }, r.count ? (r.sum / r.count).toFixed(2) + ' kg' : '–'),
                            h('td', { className: 'sub' }, r.where || '–'));
                    })))),
            !rows.length ? h('p', { className: 'ufs-muted', style: { fontSize: '12px' } }, 'Noch keine Art gefangen.') : null) : null,

        tab === 'offen' ? h('div', null, fish.filter(function (f) { return f.missing.length; }).map(function (f) {
            return h('div', { key: f.id, className: 'ufs-spotcard', style: { marginBottom: '.7rem' } },
                h('h3', null, f.name, ' ', h('span', { className: 'ufs-muted' }, '(' + f.missing.length + ' offen)')),
                h('div', { className: 'ufs-row', style: { gap: '.35rem', flexWrap: 'wrap' } },
                    f.missing.map(function (k) {
                        return h('span', { key: k, className: 'ufs-chip' }, speciesName(k, lang));
                    })));
        })) : null);
}

/**
 * Der eigentliche Vergleich. Erst die Stände beider Seiten, dann Kennzahlen,
 * Reviere und schließlich jede Art einzeln mit Anzahl und Rekorden.
 */
function ProfileDuel(props) {
    const { t, lang } = useI18n();
    const p = props.p, mine = props.mine;
    const them = props.data.user.name, me = props.data.me.user.name;

    /* Bilanz über alle Arten: wer hat sie, und wer hält den schwereren Fisch. */
    const tally = useMemo(function () {
        const n = { both: 0, his: 0, mine: 0, leadW: 0, behindW: 0, tieW: 0, leadL: 0, behindL: 0, leadC: 0, behindC: 0 };
        props.all.forEach(function (r) {
            if (r.a && r.b) n.both++;
            else if (r.a) n.his++;
            else n.mine++;
            if (!r.a || !r.b) return;
            if (r.b.best > r.a.best + 0.0005) n.leadW++;
            else if (r.a.best > r.b.best + 0.0005) n.behindW++;
            else n.tieW++;
            if (r.b.length > r.a.length + 0.0005) n.leadL++;
            else if (r.a.length > r.b.length + 0.0005) n.behindL++;
            if (r.b.count > r.a.count) n.leadC++;
            else if (r.a.count > r.b.count) n.behindC++;
        });

        return n;
    }, [props.all]);

    const fishA = useMemo(function () { return fisheryStats(p); }, [p]);
    const fishB = useMemo(function () { return fisheryStats(mine); }, [mine]);
    const fishRows = fishA.map(function (a, i) { return { a: a, b: fishB[i] }; })
        .filter(function (r) { return r.a.total || r.a.fish || r.b.fish; })
        .sort(function (x, y) {
            return (y.a.done + y.b.done) - (x.a.done + x.b.done) || x.a.name.localeCompare(y.a.name, 'de');
        });

    function line(label, a, b, fmt, hint) {
        return h('tr', { key: label },
            h('td', { className: 'n' }, t(label), hint ? h('span', { className: 'hint' }, t(hint)) : null),
            h('td', { className: cn('num', duelClass(a, b)) }, fmt(a)),
            h('td', { className: cn('num', duelClass(b, a)) }, fmt(b)),
            h('td', { className: 'sub' },
                (a || 0) === (b || 0) ? t('duel.level') : ((b > a ? t('duel.youLead') : t('duel.theyLead')) + ' ' + fmt(Math.abs(b - a)))));
    }

    return h('div', null,
        /* Beide Stände nebeneinander – ohne Datum ist ein Vergleich wertlos. */
        h('div', { className: 'ufs-duelhead' },
            h('div', { className: 'ufs-duelside them' },
                h('span', { className: 'who' }, them),
                h('span', { className: 'sub' }, 'Angler ' + (p.anglerName || them) + ' · Level ' + fmtNum(p.level)),
                h('span', { className: 'sub' }, 'Stand: ' + fmtWhen(p.updatedAt) + ' (' + fmtAgo(p.updatedAt) + ')')),
            h('div', { className: 'ufs-duelvs' }, 'vs'),
            h('div', { className: 'ufs-duelside mine' },
                h('span', { className: 'who' }, me),
                h('span', { className: 'sub' }, 'Angler ' + (mine.anglerName || me) + ' · Level ' + fmtNum(mine.level)),
                h('span', { className: 'sub' }, 'Stand: ' + fmtWhen(mine.updatedAt) + ' (' + fmtAgo(mine.updatedAt) + ')'))),

        h('div', { className: 'ufs-spotcard', style: { marginTop: '.9rem' } },
            h('h3', null, 'Kennzahlen'),
            h('table', { className: 'ufs-rec ufs-duel' },
                h('thead', null, h('tr', null,
                    h('th', null, ''), h('th', null, them), h('th', null, me), h('th', null, t('profile.colDifference')))),
                DUEL_GROUPS.map(function (grp) {
                    return h('tbody', { key: grp[0] },
                        h('tr', { className: 'grp' }, h('td', { colSpan: 4 }, t(grp[0]))),
                        grp[1].map(function (row) {
                            return line(row[0], row[1](p) || 0, row[1](mine) || 0, row[2], row[3]);
                        }));
                }))),

        h('div', { className: 'ufs-spotcard', style: { marginTop: '.9rem' } },
            h('h3', null, t('profile.speciesBalance')),
            h('div', { className: 'ufs-row', style: { gap: '.4rem', flexWrap: 'wrap' } },
                h('span', { className: 'ufs-chip' }, t('profile.bothHave', { n: tally.both })),
                h('span', { className: 'ufs-chip' }, t('profile.onlyName', { name: them, n: tally.his })),
                h('span', { className: 'ufs-chip' }, 'Nur du: ' + tally.mine),
                h('span', { className: 'ufs-chip' }, 'Noch keiner: '
                    + Math.max(0, props.data.meta.totalSpecies - props.all.length))),
            h('table', { className: 'ufs-rec ufs-duel', style: { marginTop: '.7rem' } },
                h('thead', null, h('tr', null,
                    h('th', null, t('profile.colCommonSpecies')), h('th', null, them), h('th', null, me), h('th', null, t('profile.colDraw')))),
                h('tbody', null,
                    h('tr', null,
                        h('td', { className: 'n' }, 'Schwererer Fisch'),
                        h('td', { className: cn('num', duelClass(tally.behindW, tally.leadW)) }, tally.behindW),
                        h('td', { className: cn('num', duelClass(tally.leadW, tally.behindW)) }, tally.leadW),
                        h('td', { className: 'sub' }, tally.tieW)),
                    h('tr', null,
                        h('td', { className: 'n' }, t('duel.longerFish')),
                        h('td', { className: cn('num', duelClass(tally.behindL, tally.leadL)) }, tally.behindL),
                        h('td', { className: cn('num', duelClass(tally.leadL, tally.behindL)) }, tally.leadL),
                        h('td', { className: 'sub' }, tally.both - tally.leadL - tally.behindL)),
                    h('tr', null,
                        h('td', { className: 'n' }, t('duel.morePieces')),
                        h('td', { className: cn('num', duelClass(tally.behindC, tally.leadC)) }, tally.behindC),
                        h('td', { className: cn('num', duelClass(tally.leadC, tally.behindC)) }, tally.leadC),
                        h('td', { className: 'sub' }, tally.both - tally.leadC - tally.behindC))))),

        h('div', { className: 'ufs-spotcard', style: { marginTop: '.9rem' } },
            h('h3', null, t('duel.fisheryByFishery')),
            h('div', { className: 'ufs-scroll' },
                h('table', { className: 'ufs-rec ufs-duel' },
                    h('thead', null,
                        h('tr', null,
                            h('th', null, t('stats.colFishery')),
                            h('th', { colSpan: 2 }, t('nav.species')),
                            h('th', { colSpan: 2 }, t('stats.catches')),
                            h('th', { colSpan: 2 }, t('profile.colWeight')),
                            h('th', { colSpan: 2 }, t('stats.colTime')),
                            h('th', { colSpan: 2 }, t('stats.heaviest'))),
                        h('tr', { className: 'sub2' },
                            h('th', null, ''),
                            h('th', null, them), h('th', null, me),
                            h('th', null, them), h('th', null, me),
                            h('th', null, them), h('th', null, me),
                            h('th', null, them), h('th', null, me),
                            h('th', null, them), h('th', null, me))),
                    h('tbody', null, fishRows.map(function (r) {
                        const a = r.a, b = r.b;
                        return h('tr', { key: a.id },
                            h('td', { className: 'n' }, a.name),
                            h('td', { className: cn('num', duelClass(a.done, b.done)) }, a.done + '/' + a.total),
                            h('td', { className: cn('num', duelClass(b.done, a.done)) }, b.done + '/' + b.total),
                            h('td', { className: cn('num', duelClass(a.fish, b.fish)) }, fmtNum(a.fish)),
                            h('td', { className: cn('num', duelClass(b.fish, a.fish)) }, fmtNum(b.fish)),
                            h('td', { className: cn('num', duelClass(a.weight, b.weight)) }, fmtNum(a.weight, 1)),
                            h('td', { className: cn('num', duelClass(b.weight, a.weight)) }, fmtNum(b.weight, 1)),
                            h('td', { className: cn('num', duelClass(a.time, b.time)) }, a.time ? fmtTime(a.time) : '–'),
                            h('td', { className: cn('num', duelClass(b.time, a.time)) }, b.time ? fmtTime(b.time) : '–'),
                            h('td', { className: cn('num', duelClass(a.bigW, b.bigW)) }, a.bigW ? a.bigW.toFixed(2) : '–'),
                            h('td', { className: cn('num', duelClass(b.bigW, a.bigW)) }, b.bigW ? b.bigW.toFixed(2) : '–'));
                    })))),
            h('p', { className: 'ufs-muted', style: { fontSize: '11.5px', marginTop: '.6rem' } },
                t('profile.fisheryNote'))),

        h('div', { className: 'ufs-spotcard', style: { marginTop: '.9rem' } },
            h('div', { className: 'ufs-row', style: { justifyContent: 'space-between', marginBottom: '.7rem', flexWrap: 'wrap' } },
                h('h3', { style: { margin: 0 } }, t('duel.speciesBySpecies')),
                h('div', { className: 'ufs-row no-print', style: { gap: '.35rem', flexWrap: 'wrap' } },
                    DUEL_FILTERS.map(function (f) {
                        return h(Toggle, {
                            key: f[0], active: props.filter === f[0],
                            onClick: function () { props.onFilter(f[0]); }
                        }, t(f[1]));
                    }))),
            h('div', { className: 'ufs-scroll' },
                h('table', { className: 'ufs-rec ufs-duel' },
                    h('thead', null,
                        h('tr', null,
                            h('th', null, t('stats.colSpecies')),
                            h('th', { colSpan: 2 }, t('profile.sortCount')),
                            h('th', { colSpan: 2 }, t('profile.sortBest')),
                            h('th', { colSpan: 2 }, t('profile.colBestLength')),
                            h('th', { colSpan: 2 }, t('stats.totalWeight')),
                            h('th', null, '')),
                        h('tr', { className: 'sub2' },
                            h('th', null, ''),
                            h('th', null, them), h('th', null, me),
                            h('th', null, them), h('th', null, me),
                            h('th', null, them), h('th', null, me),
                            h('th', null, them), h('th', null, me),
                            h('th', null, t('profile.colLead')))),
                    h('tbody', null, props.rows.map(function (r) {
                        const a = r.a || { count: 0, best: 0, length: 0, sum: 0 };
                        const b = r.b || { count: 0, best: 0, length: 0, sum: 0 };
                        const d = (b.best || 0) - (a.best || 0);
                        return h('tr', { key: r.k },
                            h('td', { className: 'n' }, r.name,
                                !r.a ? h('span', { className: 'hint' }, 'ihm fehlt sie')
                                    : !r.b ? h('span', { className: 'hint' }, 'dir fehlt sie') : null),
                            h('td', { className: cn('num', duelClass(a.count, b.count)) }, a.count || '–'),
                            h('td', { className: cn('num', duelClass(b.count, a.count)) }, b.count || '–'),
                            h('td', { className: cn('num', duelClass(a.best, b.best)) }, a.best ? a.best.toFixed(2) : '–'),
                            h('td', { className: cn('num', duelClass(b.best, a.best)) }, b.best ? b.best.toFixed(2) : '–'),
                            h('td', { className: cn('num', duelClass(a.length, b.length)) }, a.length ? Math.round(a.length * 100) : '–'),
                            h('td', { className: cn('num', duelClass(b.length, a.length)) }, b.length ? Math.round(b.length * 100) : '–'),
                            h('td', { className: cn('num', duelClass(a.sum, b.sum)) }, a.sum ? fmtNum(a.sum, 1) : '–'),
                            h('td', { className: cn('num', duelClass(b.sum, a.sum)) }, b.sum ? fmtNum(b.sum, 1) : '–'),
                            h('td', { className: 'sub' },
                                Math.abs(d) < 0.0005 ? DASH : (d > 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(2) + ' kg'));
                    })))),
            !props.rows.length ? h('p', { className: 'ufs-muted', style: { fontSize: '12px' } }, 'Keine Art in dieser Auswahl.') : null,
            h('p', { className: 'ufs-muted', style: { fontSize: '11.5px', marginTop: '.6rem' } },
                props.rows.length + ' von ' + props.all.length + ' Arten, die mindestens einer von euch gefangen hat. '
                + t('profile.speciesNote'))),

        /* Was dem jeweils anderen noch fehlt – der nützlichste Teil des Vergleichs. */
        h('div', { className: 'ufs-two', style: { marginTop: '.9rem' } },
            h(MissList, { title: t('profile.onlyThem', { name: them }), rows: props.all.filter(function (r) { return r.a && !r.b; }) }),
            h(MissList, { title: t('profile.onlyYou'), rows: props.all.filter(function (r) { return r.b && !r.a; }) })));
}

/** Kurze Artenliste für „das fehlt dem anderen“. */
function MissList(props) {
    const { t, lang } = useI18n();
    return h('div', { className: 'ufs-spotcard' },
        h('h3', null, props.title, ' ', h('span', { className: 'ufs-muted' }, '(' + props.rows.length + ')')),
        props.rows.length
            ? h('div', { className: 'ufs-row', style: { gap: '.35rem', flexWrap: 'wrap' } },
                props.rows.map(function (r) {
                    return h('span', { key: r.k, className: 'ufs-chip' }, r.name);
                }))
            : h('p', { className: 'ufs-muted', style: { fontSize: '12px', margin: 0 } }, t('profile.tie')));
}

/** Vergleich mit den Profilen, denen man folgt. */

function AccountPanel(props) {
    const { t, lang } = useI18n();
    const me = props.me;
    const local = props.local || { caught: {}, bests: {}, stats: null };
    const [token, setToken] = useState(me.apiToken);
    const [name, setName] = useState(me.name);
    const [msg, setMsg] = useState(null);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    const localCount = Object.keys(local.caught || {}).length;

    function say(text) { setErr(null); setMsg(text); }
    function fail(e) { setMsg(null); setErr(e.message); }

    function saveName() {
        const wish = name.trim();
        if (!wish || wish === me.name) return;
        setBusy(true);
        api('/profile/name', { method: 'POST', json: { name: wish } })
            .then(function (d) { props.onMe(d.user); setName(d.user.name); say(t('account.nameSaved')); })
            .catch(fail)
            .then(function () { setBusy(false); });
    }
    function importLocal() {
        if (!localCount) return;
        if (!confirm(t('account.pushAsk'))) return;
        setBusy(true);
        api('/profile/import', {
            method: 'POST',
            json: { caught: local.caught || {}, bests: local.bests || {}, stats: local.stats || null }
        })
            .then(function (d) {
                props.onMe(d.user);
                say(t('account.pushed', { n: d.profile ? d.profile.speciesCount : 0 }));
            })
            .catch(fail)
            .then(function () { setBusy(false); });
    }

    const cmd = 'curl -H "X-Api-Token: ' + token + '" --data-binary "@%UserProfile%\\AppData\\LocalLow\\PlayWay\\UltimateFishing\\PROFILE_0" ' +
        location.origin + '/api/profile/upload';
    return h('div', { className: 'ufs-spotcard' },
        h('h3', null, 'Konto'),
        h('div', { className: 'ufs-stats', style: { marginBottom: '.9rem' } },
            h('span', null, 'Angemeldet als ', h('b', null, me.name)),
            me.email ? h('span', null, me.email) : null),

        err ? h('div', { className: 'ufs-note', style: { marginBottom: '.8rem' } }, err) : null,
        msg ? h('div', { className: 'ufs-note ok', style: { marginBottom: '.8rem' } }, msg) : null,

        h('h3', null, t('account.userName')),
        h('p', { className: 'ufs-muted', style: { fontSize: '12.5px', lineHeight: 1.6, margin: '.2rem 0 .6rem' } },
            t('account.nameHint')),
        h('div', { className: 'ufs-row', style: { marginBottom: '1.1rem' } },
            h('input', {
                value: name, maxLength: 32, placeholder: 'dein Name',
                onChange: function (e) { setName(e.target.value); },
                onKeyDown: function (e) { if (e.key === 'Enter') saveName(); },
                className: 'rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50',
                style: { minWidth: '220px' }
            }),
            h('button', {
                className: 'ufs-btn primary', disabled: busy || !name.trim() || name.trim() === me.name,
                onClick: saveName
            }, t('account.saveName'))),

        h('h3', null, 'Dein Profil teilen'),
        h('p', { className: 'ufs-muted', style: { fontSize: '12.5px', lineHeight: 1.6, margin: '.2rem 0 .6rem' } },
            t('account.linkHint')),
        h('div', { className: 'ufs-row', style: { marginBottom: '1.1rem' } },
            h('input', {
                readOnly: true, value: profileUrl(me.name),
                onFocus: function (e) { e.target.select(); },
                className: 'rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none',
                style: { flex: '1 1 260px', minWidth: '220px' }
            }),
            h('button', {
                className: 'ufs-btn',
                onClick: function () {
                    const url = profileUrl(me.name);
                    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { say(t('account.addressCopied')); }, function () { });
                    else say(url);
                }
            }, t('app.copy')),
            h('button', {
                className: 'ufs-btn primary',
                onClick: function () { props.onOpenUser(me.name); }
            }, t('account.viewProfile'))),

        h('h3', null, t('account.push')),
        h('p', { className: 'ufs-muted', style: { fontSize: '12.5px', lineHeight: 1.6, margin: '.2rem 0 .6rem' } },
            localCount
                ? t('account.localHas', { n: localCount }) +
                  (local.stats && local.stats.player ? ' ' + t('account.localWithSave') : '')
                : t('account.localEmpty')),
        h('div', { className: 'ufs-row', style: { marginBottom: '1.1rem' } },
            h('button', {
                className: 'ufs-btn', disabled: busy || !localCount, onClick: importLocal
            }, h(Icon, { name: 'import' }), t('account.push'))),

        h('h3', null, 'Spielstand automatisch hochladen'),
        h('p', { className: 'ufs-muted', style: { fontSize: '12.5px', lineHeight: 1.6, margin: '.2rem 0 .6rem' } },
            t('account.tokenHint')),
        h('pre', { className: 'ufs-cmd' }, cmd),
        h('div', { className: 'ufs-row' },
            h('button', {
                className: 'ufs-btn',
                onClick: function () { navigator.clipboard && navigator.clipboard.writeText(cmd); }
            }, t('account.copyCommand')),
            h('button', {
                className: 'ufs-btn danger',
                onClick: function () {
                    if (!confirm(t('account.newTokenAsk'))) return;
                    api('/auth/token/new', { method: 'POST' }).then(function (d) { setToken(d.token); });
                }
            }, t('account.newToken')),
            h('button', { className: 'ufs-btn', onClick: props.onLogout }, t('auth.logout'))));
}

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
                if (!newerThan(st.updatedAt, localStorage.getItem('ufs-updated'))) return;
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
    const [local, setLocal] = useState(loadLocal);
    const caught = local.caught || {};
    const bests = local.bests || {};
    const saveStats = local.stats || null;
    function patchLocal(patch) {
        // Jede eigene Änderung bekommt einen Zeitstempel, damit beim nächsten
        // Laden entschieden werden kann, welcher Stand der neuere ist.
        const stamped = Object.assign({ updatedAt: new Date().toISOString() }, patch);
        setLocal(function (l) { return Object.assign({}, l, stamped); });
    }
    const searchRef = useRef(null);

    useEffect(function () { localStorage.setItem('ufs-favs', JSON.stringify(favorites)); }, [favorites]);
    useEffect(function () {
        localStorage.setItem('ufs-caught', JSON.stringify(local.caught || {}));
        localStorage.setItem('ufs-bests', JSON.stringify(local.bests || {}));
        localStorage.setItem('ufs-stats', JSON.stringify(local.stats || null));
        if (local.updatedAt) localStorage.setItem('ufs-updated', local.updatedAt);
        else localStorage.removeItem('ufs-updated');
    }, [local]);

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

    /* Adressleiste als Zustand: #koeder, #arten, #revier/<id>, #revier/<id>/spot3 */
    const routeReady = useRef(false);
    const histReady = useRef(false);
    useEffect(function () {
        function apply() {
            const parts = decodeURIComponent((location.hash || '').replace(/^#/, '')).split('/');
            const head = (parts[0] || '').toLowerCase();
            // Die Startseite stellt den Dienst vor; ohne Server gibt es
            // nichts vorzustellen, dann beginnt der Guide bei den Revieren.
            if (head === 'start' && API_AVAILABLE) { setView('start'); return; }
            if (head === '' && API_AVAILABLE) { setView('start'); return; }
            if (head === 'koeder') { setView('bait'); return; }
            if (head === 'angler' && parts[1]) {
                setAngler(parts[1]);
                setAnglerTab(parts[2] || 'uebersicht');
                setView('angler');
                return;
            }
            if (head === 'gruppen') { setView('gruppen'); setGroupId(parts[1] ? Number(parts[1]) : null); return; }
            if (head === 'anmelden') { setView('anmelden'); return; }
            if (head === 'statistik') { setView('stats'); setStatsTab(parts[1] || 'reviere'); return; }
            if (head === 'arten') { setView('arten'); setOpenSpecies(parts[1] ? parts[1].toUpperCase() : null); return; }
            if (head === 'gesamt') { setView('map'); setSelectedMap('__all__'); return; }
            if (head === 'revier' && parts[1]) {
                const m = D.maps.filter(function (x) { return x.id === parts[1]; })[0];
                if (m) {
                    setView('map');
                    setSelectedMap(m.id);
                    const sp = /^spot(\d+)$/i.exec(parts[2] || '');
                    setTimeout(function () { setSelectedSpot(sp ? parseInt(sp[1], 10) : null); }, 0);
                    return;
                }
            }
            setView('map');
        }
        apply();
        routeReady.current = true;
        window.addEventListener('hashchange', apply);
        return function () { window.removeEventListener('hashchange', apply); };
    }, []);
    useEffect(function () {
        if (!routeReady.current) return;
        let hash = selectedMap === '__all__'
            ? '#gesamt'
            : '#revier/' + selectedMap + (selectedSpot ? '/spot' + selectedSpot : '');
        if (view === 'start') hash = '#start';
        else if (view === 'bait') hash = '#koeder';
        else if (view === 'angler' && angler) {
            hash = '#angler/' + encodeURIComponent(angler)
                + (anglerTab && anglerTab !== 'uebersicht' ? '/' + anglerTab : '');
        }
        else if (view === 'gruppen') hash = '#gruppen' + (groupId ? '/' + groupId : '');
        else if (view === 'anmelden') hash = '#anmelden';
        else if (view === 'stats') hash = '#statistik';
        else if (view === 'arten') hash = '#arten' + (openSpecies ? '/' + openSpecies : '');
        // Jeder Wechsel ist ein eigener Schritt im Verlauf, damit „Zurück“ im
        // Browser tut, was man erwartet. Der erste Aufruf ersetzt nur, sonst
        // läge beim Öffnen sofort ein zusätzlicher Eintrag im Verlauf.
        if (location.hash === hash) return;
        if (histReady.current) history.pushState(null, '', hash);
        else { history.replaceState(null, '', hash); histReady.current = true; }
    }, [view, selectedMap, selectedSpot, openSpecies, angler, anglerTab]);

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
                    name: angler, me: me, lang: lang, local: local,
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
                        setLocal({ caught: {}, bests: {}, stats: null, updatedAt: new Date().toISOString() });
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
                setLocal({ caught: {}, bests: {}, stats: null, updatedAt: new Date().toISOString() });
            }
        }) : null);
}

export default App
