/*
 * The original single-file app, now an ES module.
 *
 * It still builds its views with React.createElement instead of JSX; that was
 * the price of running without a build step. Nothing here is meant to stay:
 * piece by piece these views move into typed components under src/components,
 * and this file shrinks until it disappears.
 */
import React from 'react'
import { GAME, GUIDE } from '../data'
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

const { useCallback, useEffect, useMemo, useRef, useState } = React
const h = React.createElement

const D = GUIDE
const G = GAME
const SPECIES = G.species || {};
const FISHERIES = G.fisheries || {};

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

function cn() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
function norm(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

/* ------------------------------------------------------------------ Arten */

const enIndex = {}, deIndex = {};
Object.keys(SPECIES).forEach(function (k) {
    const s = SPECIES[k];
    if (s.en && !enIndex[norm(s.en)]) enIndex[norm(s.en)] = k;
    if (s.de && !deIndex[norm(s.de)]) deIndex[norm(s.de)] = k;
});

/* Der Guide nennt einige Arten anders als das Spiel: teils eine Kurzform,
   teils den gebräuchlicheren Handelsnamen. */
const NAME_ALIAS = {
    apapa: 'APAPA',                     // im Spiel „Apapá“
    grayling: 'WHITE_GRAYLING',         // Baikal, im Spiel „White Grayling“
    commonbleak: 'BLEAK',
    longfineel: 'LONGFIN_EEL',          // im Spiel „New Zealand longfin eel“
    redlionfish: 'COMMON_LIONFISH',
    graysnapper: 'GREY_SNAPER'          // Schreibweise des Spiels
};

/* Manche Fische stecken doppelt in den Spieldaten, einmal je Revier-Generation.
   Steht die eine Fassung nicht im Revier, ist die andere gemeint. */
const EQUIV = [
    ['GREAT_BARRACUDA', 'BARRACUDA'],
    ['GRAY_SNAPPER_C', 'GREY_SNAPER'],
    ['GIANT_GROUPER', 'GIANT_GROUPER_D'],
    ['BLACKTIP_REEF_SHARK', 'BLACKTIP_SHARK_D']
];

/** Guide-Eintrag -> Artenschlüssel der Spieldaten (oder null). */
function speciesKey(name, de, mapId) {
    let k = NAME_ALIAS[norm(name)] || NAME_ALIAS[norm(de)]
        || enIndex[norm(name)] || deIndex[norm(de)] || enIndex[norm(de)] || deIndex[norm(name)] || null;
    if (!k || !mapId) return k;

    // Führt der Schlüssel in diesem Revier ins Leere, die Zwillingsart nehmen.
    const fy = FISHERIES[mapId];
    if (!fy) return k;
    const here = {};
    fy.species.forEach(function (g) { here[g.s] = true; });
    if (here[k]) return k;
    for (let i = 0; i < EQUIV.length; i++) {
        if (EQUIV[i].indexOf(k) < 0) continue;
        for (let j = 0; j < EQUIV[i].length; j++) {
            if (here[EQUIV[i][j]]) return EQUIV[i][j];
        }
    }
    return k;
}
function speciesName(key, lang) {
    const s = SPECIES[key];
    if (!s) return key;
    return (lang === 'en' ? s.en : s.de) || s.en || s.de || key;
}

/* ------------------------------------------------------------ Köderdaten */

/* Jedes Köder-Prefab im Spiel führt Buch darüber, wie stark sich welche Art
   für ihn interessiert – ein Wert zwischen 0 und 1. In gamedata.js steht das
   platzsparend als "Index:Prozent", hier wird es einmal ausgepackt. */
const BAIT_SPECIES = G.baitSpecies || [];
const BAITS = {};
Object.keys(G.baits || {}).forEach(function (k) {
    const b = G.baits[k];
    const fish = {};
    String(b.i || '').split(',').forEach(function (pair) {
        if (!pair) return;
        const p = pair.split(':');
        const key = BAIT_SPECIES[Number(p[0])];
        if (key) fish[key] = Number(p[1]) / 100;
    });
    BAITS[k] = { key: k, en: b.en, de: b.de, kind: b.kind, fish: fish };
});

/** Umgekehrte Sicht: welche Köder taugen für eine Art, absteigend sortiert. */
const BAITS_FOR = {};
Object.keys(BAITS).forEach(function (k) {
    const b = BAITS[k];
    Object.keys(b.fish).forEach(function (s) {
        (BAITS_FOR[s] = BAITS_FOR[s] || []).push({ bait: b, v: b.fish[s] });
    });
});
Object.keys(BAITS_FOR).forEach(function (s) {
    BAITS_FOR[s].sort(function (a, b) { return b.v - a.v || a.bait.de.localeCompare(b.bait.de); });
});

const BAIT_KIND = {
    natural: 'Naturköder', boilie: 'Boilie', fly: 'Fliege', lure: 'Kunstköder'
};
function baitName(b, lang) { return (lang === 'en' ? b.en : b.de) || b.en || b.key; }

/* The size steps themselves now live in src/lib/hooks.ts. */
const HOOKS = G.hooks || null;

/* ------------------------------------------------------- Köder-Übersetzung */

const EXTRA_TERMS = {
    'Red Worm': 'Regenwurm', 'Worm': 'Wurm', 'Earthworm': 'Regenwurm', 'Maggot': 'Made',
    'Live Bait': 'Lebendköder', 'Fly': 'Fliege', 'Corn': 'Mais', 'Pea': 'Erbse', 'Bread': 'Brot',
    'Leech': 'Blutegel', 'Wax Worm': 'Wachswurm', 'Dragonfly': 'Libelle', 'Grasshopper': 'Grashüpfer',
    'Cheese': 'Käse', 'Marshmallow': 'Schaum', 'Dough Ball': 'Teigball', 'Dough': 'Teig',
    'Semolina Ball': 'Grießball', 'Eggs': 'Fischeier', 'Egg': 'Fischei',
    'Natural Egg': 'Natürliches Fischei', 'Artificial Egg': 'Künstliches Fischei',
    'Cutbait Small': 'Kleiner Schnittköder', 'Cutbait Big': 'Großer Schnittköder',
    'Cutbait Large': 'Großer Schnittköder', 'Small Cutbait': 'Kleiner Schnittköder', 'Cutbait': 'Schnittköder',
    'Insects': 'Insekten', 'Boilie': 'Boilie', 'Softbait': 'Gummiköder', 'Soft Bait': 'Gummiköder',
    'Soft lure': 'Gummiköder', 'Spoon': 'Blinker', 'Spinner': 'Spinner', 'Wobbler': 'Wobbler',
    'Hard lure': 'Wobbler', 'Crankbait': 'Wobbler', 'Lure': 'Kunstköder', 'Lures': 'Kunstköder',
    'Straight Slow': 'Straight Slow – sehr langsam einholen',
    'Straight': 'Straight – gleichmäßig einholen',
    'Lift & Drop': 'Lift & Drop – anheben und absinken lassen',
    'Lift and Drop': 'Lift & Drop – anheben und absinken lassen',
    'Stop & Go': 'Stop & Go – einholen, absinken, kurz liegen lassen',
    'Stop and Go': 'Stop & Go – einholen, absinken, kurz liegen lassen',
    'Twitching': 'Twitching – regelmäßig zupfen',
    'Trolling': 'Schleppfischen', 'Slit Finesse': 'Slit Finesse'
};

const TERM_MAP = {};
(function buildTerms() {
    const gl = G.glossary || {};
    [gl.bait, gl.lure, gl.method].forEach(function (grp) {
        if (!grp) return;
        Object.keys(grp).forEach(function (en) { TERM_MAP[en.toLowerCase()] = grp[en]; });
    });
    Object.keys(EXTRA_TERMS).forEach(function (en) { TERM_MAP[en.toLowerCase()] = EXTRA_TERMS[en]; });
})();

const TERM_RX = (function () {
    const keys = Object.keys(TERM_MAP).sort(function (a, b) { return b.length - a.length; });
    if (!keys.length) return null;
    const esc = keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    try {
        return new RegExp('(?<![\\wäöüß])(' + esc.join('|') + ')(?![\\wäöüß])', 'gi');
    } catch (e) {
        return new RegExp('\\b(' + esc.join('|') + ')\\b', 'gi');
    }
})();

/** Ersetzt englische Köder- und Führungsbegriffe durch die Begriffe aus dem Spiel. */
function toGerman(text) {
    if (!text || typeof text !== 'string' || !TERM_RX) return text;
    TERM_RX.lastIndex = 0;
    return text.replace(TERM_RX, function (m) { return TERM_MAP[m.toLowerCase()] || m; });
}

/* -------------------------------------------------------------- Bausteine */

function Badge(props) {
    const tones = {
        cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200', green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
        amber: 'border-amber-400/30 bg-amber-400/10 text-amber-200', red: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
        violet: 'border-violet-400/30 bg-violet-400/10 text-violet-200', slate: 'border-white/10 bg-white/[.045] text-slate-300'
    };
    return h('span', { className: cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide', tones[props.tone || 'slate']) }, props.children);
}
function Confidence(props) {
    const map = { hoch: ['hoch', 'green'], mittel: ['mittel', 'amber'], niedrig: ['abgeleitet', 'red'] };
    const v = map[props.value] || map.mittel;
    return h(Badge, { tone: v[1] }, 'Vertrauen: ' + v[0]);
}
function Icon(props) {
    const icons = {
        search: '⌕', map: '◫', fish: '◈', hook: '⌁', bait: '●', depth: '↕', method: '↝', star: '★',
        source: '↗', filter: '≡', info: 'i', print: '▣', close: '×', check: '✓', import: '↧', game: '▤',
        user: '☺', share: '⇗'
    };
    return h('span', { 'aria-hidden': true, className: cn('inline-flex h-5 w-5 items-center justify-center font-mono', props.className) }, icons[props.name] || '•');
}
function Toggle(props) {
    return h('button', {
        onClick: props.onClick,
        className: cn('inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold transition',
            props.active ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100' : 'border-white/10 bg-white/[.03] text-slate-500 hover:text-slate-300')
    }, props.active ? h(Icon, { name: 'check' }) : null, props.children);
}
function Select(props) {
    return h('select', {
        value: props.value, onChange: function (e) { props.onChange(e.target.value); },
        className: 'rounded-xl border border-white/10 bg-[#0b1821] px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40'
    }, props.options.map(function (o) { return h('option', { key: o, value: o }, (props.labels || {})[o] || o); }));
}
function Mini(props) {
    return h('div', { className: 'rounded-2xl border border-white/10 bg-black/15 p-4' },
        h('div', { className: 'text-[10px] font-bold uppercase tracking-[.16em] text-slate-500' }, props.label),
        h('div', { className: 'mt-1 text-sm font-semibold text-slate-200' }, props.value));
}
function Bar(props) {
    const pct = props.total ? Math.round(props.value / props.total * 100) : 0;
    return h('div', { className: cn('ufs-bar', props.thin && 'thin') }, h('span', { style: { width: pct + '%' } }));
}

/* ------------------------------------------------- Köder- und Wetterblöcke */

/** Die stärksten Köder einer Art, mit Balken für den Interessenwert. */
/* ------------------------------------------------------------- Revierkarte */

function FisheryMap(props) {
    const fy = props.fishery;
    const [hover, setHover] = useState(null);
    const [dotTip, setDotTip] = useState(null);
    const [showDots, setShowDots] = useState(false);
    const spots = fy.spots.filter(function (s) { return typeof s.u === 'number'; });
    if (!spots.length) {
        return h('div', { className: 'ufs-note' },
            'Für dieses Revier enthalten die Spieldateien keine Kartenpunkte – hier wird ausschließlich vom Boot aus gefischt.');
    }
    const hl = props.highlight || null;
    const tip = hover !== null ? spots.filter(function (s) { return s.n === hover; })[0] : null;

    function hasSpecies(s) {
        return hl ? s.fish.some(function (f) { return f.s === hl; }) : false;
    }

    return h('div', null,
        h('div', { className: 'ufs-map-wrap' },
            h('img', { src: fy.map, alt: 'Revierkarte aus den Spieldateien', loading: 'lazy' }),
            h('div', { className: 'ufs-map-layer' },
                showDots && fy.dots ? fy.dots.map(function (d, i) {
                    return h('div', {
                        key: 'd' + i,
                        className: cn('ufs-dot', hl && d[0] === hl && 'hl'),
                        style: { left: (d[1] * 100) + '%', top: (d[2] * 100) + '%' },
                        title: speciesName(d[0], props.lang),
                        onMouseEnter: function () { setDotTip({ s: d[0], u: d[1], v: d[2] }); },
                        onMouseLeave: function () { setDotTip(null); }
                    });
                }) : null,
                dotTip ? (function () {
                    const sp = SPECIES[dotTip.s] || {};
                    return h('div', {
                        className: 'ufs-tip small',
                        style: { left: (dotTip.u * 100) + '%', top: (dotTip.v * 100) + '%' }
                    },
                        h('h4', null, (props.caught[dotTip.s] ? '✓ ' : '') + speciesName(dotTip.s, props.lang)),
                        sp.wMax ? h('div', { className: 'sub' }, sp.wMin + '–' + sp.wMax + ' kg · ' + sp.lMin + '–' + sp.lMax + ' cm') : null);
                })() : null,
                spots.map(function (s) {
                    return h('div', {
                        key: s.n,
                        className: cn('ufs-spot', props.selected === s.n && 'sel', hl && (hasSpecies(s) ? 'hit' : 'dim')),
                        style: { left: (s.u * 100) + '%', top: (s.v * 100) + '%' },
                        onMouseEnter: function () { setHover(s.n); },
                        onMouseLeave: function () { setHover(null); },
                        onClick: function () { props.onSelect(props.selected === s.n ? null : s.n); },
                        title: 'Spot ' + s.n
                    }, s.n);
                }),
                tip ? h('div', {
                    className: 'ufs-tip',
                    style: { left: (tip.u * 100) + '%', top: (tip.v * 100) + '%' }
                },
                    h('h4', null, 'SPOT ' + tip.n),
                    tip.fish.slice(0, 6).map(function (f) {
                        return h('div', { key: f.s, className: 'r' },
                            h('span', { style: props.caught[f.s] ? { color: '#6ee7b7' } : null },
                                (props.caught[f.s] ? '✓ ' : '') + speciesName(f.s, props.lang)),
                            h('span', null, f.f + '×'));
                    }),
                    tip.fish.length > 6 ? h('div', { className: 'more' }, '+ ' + (tip.fish.length - 6) + ' weitere Arten') : null,
                    !tip.fish.length ? h('div', { className: 'more' }, 'Keine Schwärme in Wurfweite') : null) : null)),
        h('div', { className: 'ufs-map-legend' },
            h('span', null, h('b', null, spots.length), ' Reisepunkte aus den Spieldateien'),
            fy.dots && fy.dots.length ? h('button', {
                className: cn('ufs-chip ufs-chip-btn', showDots && 'ufs-chip-on'),
                onClick: function () { setShowDots(!showDots); }
            }, (showDots ? '✓ ' : '') + 'Fischschwärme (' + fy.dots.length + ')') : null,
            hl ? h('span', null, 'Grün markiert: Spots mit ', h('b', null, speciesName(hl, props.lang)))
               : h('span', { className: 'ufs-muted' }, 'Punkt überfahren für Details, klicken zum Filtern'),
            props.selected ? h('button', { className: 'ufs-chip ufs-chip-btn', onClick: function () { props.onSelect(null); } }, 'Auswahl aufheben') : null));
}

/* --------------------------------------------------------------- Spotliste */

function SpotPanel(props) {
    const s = props.spot;
    return h('div', { className: 'ufs-spotcard' },
        h('h3', null, 'Spot ' + s.n + ' · ' + s.fish.length + ' Arten in Reichweite'),
        h('div', { className: 'ufs-splist' },
            s.fish.map(function (f) {
                const sp = SPECIES[f.s] || {};
                return h('div', { key: f.s, className: 'ufs-spline' },
                    h('span', { className: cn('n', props.caught[f.s] && 'done') },
                        (props.caught[f.s] ? '✓ ' : '') + speciesName(f.s, props.lang),
                        sp.wMax ? h('span', { className: 'd' }, '  ' + sp.wMin + '–' + sp.wMax + ' kg') : null),
                    h('span', { className: 'q' }, f.f + ' Fische'),
                    h('span', { className: 'd' }, f.d === 0 ? 'am Spot' : '~' + f.d + ' m'));
            })),
        !s.fish.length ? h('div', { className: 'ufs-muted', style: { fontSize: '12px' } },
            'Keine Schwarmpunkte in Wurfweite – hier wird geschleppt oder vom Boot gefischt.') : null);
}

/* -------------------------------------------------------- Spielstand-Import */

function ImportDialog(props) {
    const [msg, setMsg] = useState(null);
    const [busy, setBusy] = useState(false);
    const inputRef = useRef(null);

    function onFile(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setBusy(true); setMsg(null);
        const rd = new FileReader();
        rd.onload = function () {
            try {
                const res = profileToCatches(parseProfile(rd.result));
                if (!res.total) {
                    setMsg({ bad: true, text: 'Keine Fangzähler gefunden. Bitte PROFILE_0 oder PROFILE_1 wählen (Dateien ohne Endung).' });
                    setBusy(false);
                    return;
                }
                props.onImport(res);
                const who = (res.player && res.player.name) ? res.player.name + ': ' : '';
                const local = who + res.total + ' gefangene Arten übernommen, inklusive persönlicher Rekorde.';

                // Angemeldet? Dann dieselbe Datei zusätzlich ans Konto schicken.
                if (props.me && API_AVAILABLE) {
                    api('/profile/upload', { method: 'POST', body: rd.result })
                        .then(function () { setMsg({ bad: false, text: local + ' Auch im Konto gespeichert.' }); })
                        .catch(function (e) { setMsg({ bad: false, text: local + ' (Serverupload fehlgeschlagen: ' + e.message + ')' }); })
                        .then(function () { setBusy(false); });
                    return;
                }
                setMsg({ bad: false, text: local });
            } catch (err) {
                setMsg({ bad: true, text: 'Datei konnte nicht gelesen werden: ' + err.message });
            }
            setBusy(false);
        };
        rd.onerror = function () { setMsg({ bad: true, text: 'Datei konnte nicht gelesen werden.' }); setBusy(false); };
        rd.readAsArrayBuffer(file);
    }

    return h('div', {
        className: 'ufs-modal-bg',
        onMouseDown: function (e) { if (e.target === e.currentTarget) props.onClose(); }
    }, h('div', { className: 'ufs-modal' },
        h('h2', null, 'Spielstand einlesen'),
        h('p', null, 'Der Guide liest deinen Spielstand aus und hakt alle bereits gefangenen Arten ab. Die Datei bleibt lokal im Browser und wird nirgendwohin gesendet.'),
        h('p', null, 'Zu finden unter:'),
        h('p', null, h('code', null, '%UserProfile%\\AppData\\LocalLow\\PlayWay\\UltimateFishing\\PROFILE_0')),
        h('p', { style: { color: '#64748b' } }, 'PROFILE_0 und PROFILE_1 sind die beiden Profilslots. Die Dateien haben bewusst keine Endung.'),
        h('div', { className: 'ufs-row', style: { marginTop: '1rem' } },
            h('input', { ref: inputRef, type: 'file', className: 'ufs-file', onChange: onFile }),
            h('button', { className: 'ufs-btn primary', onClick: function () { inputRef.current.click(); } },
                h(Icon, { name: 'import' }), busy ? 'Lese …' : 'PROFILE-Datei wählen'),
            h('button', { className: 'ufs-btn', onClick: props.onClose }, 'Schließen')),
        msg ? h('div', {
            className: 'ufs-note',
            style: msg.bad ? null : { borderColor: 'rgba(52,211,153,.3)', background: 'rgba(16,185,129,.08)', color: '#a7f3d0' }
        }, msg.text) : null,
        h('div', { className: 'ufs-sep' }),
        h('p', null, 'Alternativ hakst du Arten von Hand ab – der Stand wird im Browser gespeichert.'),
        h('button', {
            className: 'ufs-btn danger',
            onClick: function () { if (confirm('Wirklich alle Haken und importierten Rekorde entfernen?')) props.onReset(); }
        }, 'Fangliste zurücksetzen')));
}

/* --------------------------------------------------------------- Fischkarte */

function FishCard(props) {
    const t = useI18n().t;
    const f = props.f, lang = props.lang, key = props.speciesKey;
    const sp = key ? SPECIES[key] : null;
    const gm = props.gameEntry;
    const best = key ? props.bests[key] : null;
    const done = key ? !!props.caught[key] : false;

    const spots = gm && gm.spots && gm.spots.length ? gm.spots : null;

    // Werte aus den Spieldateien, die die Angaben des Guides ersetzen.
    const hookIdx = sp && sp.wMax ? fitSteps(HOOKS && HOOKS.hook, sp.wMin || 0, sp.wMax) : [];
    const hookText = hookIdx.length ? stepRange(hookIdx) + '  ' + gapRange(hookIdx) : null;
    const hours = sp && sp.act ? bestHours(sp.act, t('fish.allDay')) : null;
    const top = sp && sp.spin ? spinTop(sp.spin) : null;
    const mTop = sp && sp.m ? methodTop(sp.m) : null;

    return h('article', { id: f.id, className: 'print-card group overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[.055] to-white/[.022] shadow-xl transition hover:border-cyan-300/25' },
        h('div', { className: 'flex flex-wrap items-start gap-4 border-b border-white/10 p-5 lg:p-6' },
            h('div', { className: 'grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-400/[.07] text-xl text-cyan-200' }, '◈'),
            h('div', { className: 'min-w-0 flex-1' },
                h('div', { className: 'flex flex-wrap items-center gap-2' },
                    // Namen aus den Spieldateien haben Vorrang: im Guide fehlt bei
                    // einigen Arten die deutsche Bezeichnung.
                    h('h2', { className: 'text-xl font-black text-white' },
                        lang === 'en' ? ((sp && sp.en) || f.name) : ((sp && sp.de) || f.de || f.name)),
                    h('span', { className: 'text-sm text-slate-500' },
                        '· ' + (lang === 'en' ? ((sp && sp.de) || f.de || f.name) : ((sp && sp.en) || f.name))),
                    f.dlc ? h(Badge, { tone: 'violet' }, f.dlc) : null,
                    props.gameOnly ? h(Badge, { tone: 'cyan' }, 'nur Spieldaten') : null),
                h('div', { className: 'mt-2 flex flex-wrap gap-2' },
                    h(Confidence, { value: f.confidence }),
                    h(Badge, null, f.method),
                    f.time !== 'Keine feste Zeit belegt' ? h(Badge, { tone: 'amber' }, f.time) : null)),
            h('div', { className: 'ufs-col', style: { alignItems: 'flex-end' } },
                key ? h('button', {
                    className: cn('ufs-catch', done && 'on'),
                    onClick: function () { props.onToggleCatch(key); },
                    title: 'Als gefangen markieren'
                }, h('span', { className: 'box' }, done ? '✓' : ''), done ? 'gefangen' : 'offen') : null,
                h('button', {
                    onClick: props.onFav, title: 'Favorit',
                    className: cn('no-print rounded-xl border p-2 transition', props.favorite ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : 'border-white/10 text-slate-600 hover:text-amber-200')
                }, h(Icon, { name: 'star' })))),

        h('div', { className: cn('grid gap-px bg-white/[.06]', props.compact ? 'grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4') },
            h(Fact, {
                icon: 'map', label: 'Spot',
                value: spots
                    ? h('span', { className: 'ufs-row' }, spots.map(function (n) {
                        return h('button', {
                            key: n,
                            className: cn('ufs-chip ufs-chip-btn ufs-chip-spot', props.selectedSpot === n && 'ufs-chip-on'),
                            onClick: function () { props.onPickSpot(n); }
                        }, 'Spot ' + n);
                    }))
                    : f.spots
            }),
            h(Fact, { icon: 'hook', label: 'Haken', value: hookText || f.hook }),
            h(Fact, { icon: 'star', label: 'Beste Zeit', value: hours || f.time }),
            mTop ? h(Fact, {
                icon: 'bait', label: 'Beste Angelart',
                value: h('span', null, mTop.rows.map(function (x) { return t(x.name); }).join(' / '),
                    h('span', { className: 'ufs-muted', style: { fontWeight: 400 } }, '  ' + mTop.value + ' %'))
            }) : null,
            h(Fact, {
                icon: 'method', label: 'Beste Führung',
                value: top
                    ? h('span', null, top.names.map(t).join(' / '),
                        h('span', { className: 'ufs-muted', style: { fontWeight: 400 } },
                            '  ' + Math.round(top.value * 100) + ' %'))
                    : (lang === 'de' ? toGerman(f.method) : f.method)
            })),

        h('div', { className: cn('grid gap-4 p-5 lg:p-6', props.compact ? '' : 'lg:grid-cols-2') },
            // Köder als Marken: die stärksten laut Prefab, nicht die Guide-Aufzählung.
            key && (BAITS_FOR[key] || []).length
                ? h('div', { className: 'rounded-2xl border border-white/10 bg-black/15 p-4' },
                    h('div', { className: 'text-[10px] font-bold uppercase tracking-[.15em] text-slate-600' }, 'Köder'),
                    h('div', { className: 'ufs-row', style: { marginTop: '.5rem' } },
                        (BAITS_FOR[key] || []).slice(0, 8).map(function (e) {
                            return h('span', {
                                key: e.bait.key,
                                className: cn('ufs-chip ufs-baitchip', e.bait.kind),
                                title: BAIT_KIND[e.bait.kind]
                            }, baitName(e.bait, lang), h('b', null, Math.round(e.v * 100) + ' %'));
                        })))
                : h(Detail, { title: 'Köder', value: lang === 'de' ? toGerman(f.bait) : f.bait }),
            h(Detail, { title: 'Grundfutter / Anfütterung', value: lang === 'de' ? toGerman(f.groundbait) : f.groundbait }),

            sp ? h('div', { className: cn('ufs-gamebox', props.compact ? '' : 'lg:col-span-2') },
                h('div', { className: 'hd' }, 'Aus den Spieldateien'),
                h('div', { className: 'ufs-stats' },
                    sp.wMax ? h('span', null, 'Gewicht: ', h('b', null, sp.wMin + '–' + sp.wMax + ' kg')) : null,
                    sp.lMax ? h('span', null, 'Länge: ', h('b', null, sp.lMin + '–' + sp.lMax + ' cm')) : null,
                    gm && gm.points ? h('span', null, 'Schwarmpunkte hier: ', h('b', null, gm.points)) : null,
                    gm && gm.fish ? h('span', null, 'Fische hier: ', h('b', null, gm.fish)) : null,
                    gm && gm.dlc ? h('span', null, h('b', null, 'DLC-Art'), ' – ohne feste Spawnpunkte in der Szene') : null),
                sp.act ? h('div', { style: { marginTop: '.6rem' } }, h(Activity, { act: sp.act })) : null,
                HOOKS && sp.wMax
                    ? h('div', { style: { marginTop: '.7rem' } },
                        h('div', { className: 'hd' }, 'Passende Größenstufen'),
                        h(SizeFit, { sp: sp }))
                    : null,
                sp.m
                    ? h('div', { style: { marginTop: '.7rem' } },
                        h('div', { className: 'hd' }, 'Angelart'),
                        h(MethodList, { m: sp.m }))
                    : null,
                key && (BAITS_FOR[key] || []).length
                    ? h('div', { style: { marginTop: '.7rem' } },
                        h('div', { className: 'hd' }, 'Köder, Interesse laut Prefab'),
                        h(BaitTop, { speciesKey: key }))
                    : null,
                sp.spin
                    ? h('div', { style: { marginTop: '.7rem' } },
                        h('div', { className: 'hd' }, 'Führung beim Spinnfischen'),
                        h(RetrieveList, { spin: sp.spin }))
                    : null,
                sp.bite
                    ? h('div', { style: { marginTop: '.7rem' } },
                        h('div', { className: 'hd' }, 'Wetter'),
                        h(BiteFactors, { bite: sp.bite }))
                    : null,
                best ? h('div', { className: 'ufs-stats', style: { marginTop: '.6rem' } },
                    h('span', null, 'Dein Rekord: ', h('b', null,
                        (best.weight ? best.weight.toFixed(2) + ' kg' : '–') +
                        (best.length ? ' · ' + Math.round(best.length * 100) + ' cm' : ''))),
                    best.count ? h('span', null, 'Fänge: ', h('b', null, best.count)) : null,
                    best.fishery ? h('span', null, 'Rekordrevier: ', h('b', null, fisheryLabel(best.fishery))) : null) : null,
                sp.info ? h('p', { style: { margin: '.6rem 0 0', fontSize: '12px', lineHeight: 1.65, color: '#94a3b8' } }, sp.info) : null) : null,

            f.notes ? h('div', { className: cn('rounded-2xl border border-white/10 bg-black/15 p-4 text-sm leading-6 text-slate-400', props.compact ? '' : 'lg:col-span-2') },
                h('span', { className: 'font-bold text-slate-200' }, 'Praxisnotiz: '), f.notes) : null,

            h('div', { className: cn('no-print flex flex-wrap items-center gap-2 text-xs text-slate-500', props.compact ? '' : 'lg:col-span-2') },
                'Quellen: ',
                f.sources.map(function (s) {
                    return h('button', {
                        key: s, onClick: props.onSource,
                        className: 'rounded-lg border border-white/10 bg-white/[.035] px-2 py-1 hover:text-cyan-200'
                    }, (D.sources[s] || {}).type || s);
                }),
                sp ? h('span', { className: 'ufs-chip' }, h(Icon, { name: 'game' }), 'Spieldateien') : null)));
}

function Fact(props) {
    return h('div', { className: 'bg-[#0b1821]/90 p-4' },
        h('div', { className: 'flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-slate-600' },
            h(Icon, { name: props.icon }), props.label),
        h('div', { className: 'mt-2 text-sm font-semibold leading-6 text-slate-200' }, props.value));
}
function Detail(props) {
    return h('div', { className: 'rounded-2xl border border-white/10 bg-black/15 p-4' },
        h('div', { className: 'text-[10px] font-bold uppercase tracking-[.15em] text-slate-600' }, props.title),
        h('div', { className: 'mt-2 text-sm leading-6 text-slate-300' }, props.value));
}

function Sources(props) {
    return h('div', {
        className: 'fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm',
        onMouseDown: function (e) { if (e.target === e.currentTarget) props.onClose(); }
    }, h('div', { className: 'scrollbar h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#08141c] p-5 shadow-2xl sm:p-8' },
        h('div', { className: 'flex items-center justify-between' },
            h('div', null,
                h('div', { className: 'text-xs font-bold uppercase tracking-[.18em] text-cyan-300' }, 'Recherchebasis'),
                h('h2', { className: 'mt-1 text-2xl font-black text-white' }, 'Quellen & Datenqualität')),
            h('button', { onClick: props.onClose, className: 'rounded-xl border border-white/10 p-2 text-slate-400 hover:bg-white/[.06]' }, h(Icon, { name: 'close' }))),
        h('div', { className: 'mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-4 text-sm leading-6 text-amber-100/80' },
            'Spots, Artenlisten, Gewichts- und Längenspannen, Beißzeitkurven und die Köderinteressen stammen direkt aus den ' +
            'installierten Spieldateien (Unity-Szenen, Fisch- und Köder-Prefabs, Lokalisierungstabelle). Haken- und ' +
            'Führungsempfehlungen bleiben Community-Erfahrungswerte; niedrig bewertete Angaben sind bewusst als Startpunkt markiert.'),
        h('div', { className: 'mt-6 space-y-3' },
            Object.keys(D.sources).map(function (id) {
                const s = D.sources[id];
                return h('a', {
                    key: id, href: s.url, target: '_blank', rel: 'noreferrer',
                    className: 'block rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:border-cyan-400/30 hover:bg-white/[.05]'
                },
                    h('div', { className: 'flex items-start justify-between gap-4' },
                        h('div', null,
                            h('div', { className: 'font-bold text-slate-100' }, s.title),
                            h('div', { className: 'mt-1 text-xs text-cyan-300' }, s.type)),
                        h(Icon, { name: 'source', className: 'text-slate-500' })),
                    h('p', { className: 'mt-3 text-sm leading-6 text-slate-400' }, s.note));
            }))));
}


/* ----------------------------------------------------------- Rekordseite */

function RecordsPage(props) {
    const [sort, setSort] = useState('wMax');
    const [onlyOpen, setOnlyOpen] = useState(false);

    const rows = useMemo(function () {
        const where = {};
        Object.keys(FISHERIES).forEach(function (id) {
            FISHERIES[id].species.forEach(function (g) {
                (where[g.s] = where[g.s] || []).push(id);
            });
        });
        const list = [];
        Object.keys(SPECIES).forEach(function (k) {
            const s = SPECIES[k];
            if (!s.wMax && !where[k]) return;
            const b = props.bests[k] || null;
            list.push({
                key: k, sp: s, best: b, where: where[k] || [],
                pct: (b && b.weight && s.wMax) ? Math.min(1, b.weight / s.wMax) : 0
            });
        });
        list.sort(function (a, b) {
            if (sort === 'name') return speciesName(a.key, props.lang).localeCompare(speciesName(b.key, props.lang));
            if (sort === 'best') return (b.best ? b.best.weight || 0 : -1) - (a.best ? a.best.weight || 0 : -1);
            if (sort === 'pct') return b.pct - a.pct;
            return (b.sp.wMax || 0) - (a.sp.wMax || 0);
        });
        return onlyOpen ? list.filter(function (r) { return !props.caught[r.key]; }) : list;
    }, [sort, onlyOpen, props.bests, props.caught, props.lang]);

    const mapName = {};
    D.maps.forEach(function (m) { mapName[m.id] = m.name; });
    const hasBests = Object.keys(props.bests).length > 0;

    return h('div', null,
        h('div', { className: 'ufs-row', style: { marginBottom: '.9rem' } },
            h(Select, {
                value: sort, onChange: setSort, options: ['wMax', 'best', 'pct', 'name'],
                labels: {
                    wMax: 'nach Maximalgewicht', best: 'nach deinem Rekord',
                    pct: 'nach Ausschöpfung', name: 'alphabetisch'
                }
            }),
            h(Toggle, { active: onlyOpen, onClick: function () { setOnlyOpen(!onlyOpen); } }, 'nur fehlende'),
            h('span', { className: 'ufs-muted', style: { fontSize: '11.5px' } },
                rows.length + ' Arten' + (hasBests ? '' : ' · Spielstand importieren, um deine Rekorde zu sehen'))),
        h('div', { className: 'ufs-spotcard' },
            h('table', { className: 'ufs-rec' },
                h('thead', null, h('tr', null,
                    h('th', null, 'Art'),
                    h('th', null, 'Möglich (kg)'),
                    h('th', null, 'Länge (cm)'),
                    h('th', null, 'Dein Rekord'),
                    h('th', null, 'Ausschöpfung'),
                    h('th', null, 'Reviere'))),
                h('tbody', null, rows.map(function (r) {
                    const s = r.sp, b = r.best;
                    return h('tr', { key: r.key },
                        h('td', { className: cn('n', props.caught[r.key] && 'done') },
                            (props.caught[r.key] ? '✓ ' : '') + speciesName(r.key, props.lang)),
                        h('td', { className: 'num' }, s.wMax ? s.wMin + '–' + s.wMax : '–'),
                        h('td', { className: 'num' }, s.lMax ? s.lMin + '–' + s.lMax : '–'),
                        h('td', { className: 'num' },
                            b && b.weight ? b.weight.toFixed(2) + ' kg' + (b.length ? ' · ' + Math.round(b.length * 100) + ' cm' : '') : '–'),
                        h('td', null, r.pct
                            ? h('div', { className: 'ufs-recbar', title: Math.round(r.pct * 100) + ' % des Maximums' },
                                h('span', { style: { width: (r.pct * 100) + '%' } }))
                            : h('span', { className: 'sub' }, '–')),
                        h('td', { className: 'sub' },
                            r.where.length
                                ? r.where.slice(0, 3).map(function (w) { return mapName[w] || w; }).join(', ') +
                                  (r.where.length > 3 ? ' +' + (r.where.length - 3) : '')
                                : '–'));
                })))));
}

/* ------------------------------------------------------------- Rutensets */

/** Item-Kürzel aus dem Spielstand -> lesbarer Name (Köder über die Spielsprache). */
const ITEM_NAMES = {};
(function () {
    const cats = (G.glossary || {}).categories || [];
    cats.forEach(function (c) {
        c.items.forEach(function (it) {
            const seg = String(it.key).split('/').pop();
            if (seg) ITEM_NAMES[seg] = it.de;
        });
    });
})();

const CATEGORY_LABELS = {
    ROD: 'Ruten', ICE_ROD: 'Eisruten', ROD_STAND: 'Ständer', REEL: 'Rollen', LINE: 'Schnüre',
    FLOAT: 'Posen', HOOK: 'Haken', BAIT: 'Naturköder', BOILIE: 'Boilies', FEEDER: 'Feeder',
    FEEDER_BAIT: 'Feederköder', BITE_INDICATOR: 'Bissanzeiger', LURE: 'Kunstköder',
    SPOON: 'Blinker', SPINNER: 'Spinner', WOBBLER: 'Wobbler', SOFT: 'Gummiköder',
    FLY: 'Fliegen', BOAT: 'Boote', DRILLER: 'Bohrer', FISHING: 'Kescher',
    GAS: 'Gaskocher', BEER: 'Getränke', FILLET: 'Filets', ICE: 'Eis-Ausrüstung'
};
function categoryLabel(c) { return CATEGORY_LABELS[c] || c.replace(/_/g, ' '); }

function itemLabel(id) {
    if (!id) return null;
    let s = String(id).replace(/^(FEEDER_BAIT|BAIT|BOILIE)_/, '');
    if (ITEM_NAMES[s]) return ITEM_NAMES[s];
    const noNum = s.replace(/_\d+$/, '');
    if (ITEM_NAMES[noNum]) return ITEM_NAMES[noNum];
    // Produktbezeichnungen nur aufhübschen: ROD_ABU_GARCIA_02 -> Abu Garcia 02
    const parts = String(id).replace(/^(ICE_ROD|ROD_STAND|FEEDER_BAIT|BITE_INDICATOR|[A-Z]+)_/, '').split('_');
    return parts.map(function (p) {
        if (/^\d+$/.test(p)) return p.replace(/^0+(?=\d)/, '');
        return p.charAt(0) + p.slice(1).toLowerCase();
    }).join(' ');
}

function RodSets(props) {
    const t = useI18n().t;
    const sets = props.sets || [];
    if (!sets.length) return null;
    return h('div', { className: 'ufs-setgrid' }, sets.map(function (s) {
        return h('div', { key: s.n, className: 'ufs-setcard' },
            h('div', { className: 'hd' }, 'Set ' + s.n),
            h('div', { className: 'rows' },
                s.parts.map(function (p) {
                    return h('div', { key: p.slot },
                        h('span', null, t(p.slot)), h('em', null, itemLabel(p.id)));
                }),
                s.baits.length
                    ? h('div', null, h('span', null, 'Köder'),
                        h('em', null, s.baits.map(itemLabel).join(', ')))
                    : null),
            h('div', { className: 'ft' },
                typeof s.hookSize === 'number' ? h('span', null, 'Hakenstufe ', h('b', null, s.hookSize)) : null,
                typeof s.depth === 'number' ? h('span', null, 'Tiefe ', h('b', null, s.depth)) : null,
                typeof s.weight === 'number' ? h('span', null, 'Schrot ', h('b', null, s.weight)) : null));
    }));
}

/* ---------------------------------------------------------- Statistikseite */

function fmtTime(sec) {
    if (!sec) return '–';
    const h2 = Math.floor(sec / 3600), m = Math.round(sec % 3600 / 60);
    return h2 ? h2 + ' h ' + m + ' min' : m + ' min';
}
function fmtNum(n, d) {
    if (n === null || n === undefined) return '–';
    return n.toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
}
/** Abstand zu jetzt in Worten, etwa „vor 3 Tagen“. */
function fmtAgo(iso) {
    const t = Date.parse(iso || '');
    if (isNaN(t)) return 'unbekannt';
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 90) return 'gerade eben';
    if (s < 5400) return 'vor ' + Math.round(s / 60) + ' Min.';
    if (s < 172800) return 'vor ' + Math.round(s / 3600) + ' Std.';
    if (s < 2592000) return 'vor ' + Math.round(s / 86400) + ' Tagen';
    if (s < 31536000) return 'vor ' + Math.round(s / 2592000) + ' Monaten';

    return 'vor über einem Jahr';
}

/** Zeitpunkt kurz und lesbar, etwa „27.07.2026, 14:05“. */
function fmtWhen(iso) {
    const t = Date.parse(iso || '');
    if (isNaN(t)) return 'unbekannt';
    return new Date(t).toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function StatsPage(props) {
    const stats = props.stats;
    const TABS = { fische: 'arten', arten: 'arten', sets: 'sets', vergleich: 'vergleich', reviere: 'reviere' };
    const [tab, setTab] = useState(TABS[props.tab] || 'reviere');

    // Spielstand und Konto sitzen hier, nicht mehr im Kopf.
    const bar = h('div', { className: 'ufs-row', style: { marginBottom: '1rem' } },
        h('button', { className: 'ufs-btn primary', onClick: props.onImport },
            h(Icon, { name: 'import' }), 'Spielstand laden'),
        stats && stats.player
            ? h('button', { className: 'ufs-btn danger', onClick: function () {
                if (confirm('Lokalen Stand samt Haken zurücksetzen?')) props.onReset();
            } }, 'Zurücksetzen')
            : null,
        API_AVAILABLE
            ? (props.me
                ? h('span', { className: 'ufs-chip' }, '◔ angemeldet als ' + props.me.name)
                : h('button', { className: 'ufs-btn', onClick: props.onOpenCommunity }, h(Icon, { name: 'star' }), 'Anmelden'))
            : null);

    if (!stats || !stats.player) {
        return h('div', null, bar, h('div', { className: 'ufs-spotcard' },
            h('h3', null, 'Noch kein Spielstand geladen'),
            h('p', { className: 'ufs-muted', style: { fontSize: '12.5px', lineHeight: 1.6, margin: '.3rem 0 .9rem' } },
                'Diese Seite wird vollständig aus deinem Spielstand gefüllt: Fänge je Revier, Bisse, ' +
                'Angelzeit, Punkte und dein größter Fisch je Art. Es wird nichts hochgeladen, die Datei ' +
                'wird nur im Browser gelesen.'),
            API_AVAILABLE && !props.me
                ? h('p', { className: 'ufs-muted', style: { fontSize: '12px', marginTop: '.9rem' } },
                    'Mit einem Konto liegt der Stand zusätzlich auf dem Server – dann kannst du dich in Gruppen vergleichen.')
                : null));
    }

    const p = stats.player;
    const fRows = Object.keys(stats.fisheries).map(function (id) {
        const m = D.maps.filter(function (x) { return x.id === id; })[0];
        return { id: id, name: m ? m.name : id, st: stats.fisheries[id] };
    }).sort(function (a, b) { return b.st.fish - a.st.fish; });

    const totals = fRows.reduce(function (a, r) {
        a.fish += r.st.fish; a.bites += r.st.bites; a.time += r.st.time;
        a.weight += r.st.weight; a.score += r.st.score;
        return a;
    }, { fish: 0, bites: 0, time: 0, weight: 0, score: 0 });

    const sRows = Object.keys(stats.bests).map(function (k) {
        const sp = SPECIES[k] || {};
        const b = stats.bests[k];
        return { key: k, sp: sp, b: b, pct: (b.weight && sp.wMax) ? Math.min(1, b.weight / sp.wMax) : 0 };
    }).sort(function (a, b) { return (b.b.weight || 0) - (a.b.weight || 0); });

    return h('div', null,
        bar,
        h('div', { className: 'ufs-statgrid' },
            h(Stat, { label: 'Angler', value: p.name || '–', sub: 'Level ' + p.level }),
            h(Stat, { label: 'Punkte', value: fmtNum(p.score), sub: fmtNum(p.exp) + ' EP' }),
            h(Stat, { label: 'Geld', value: fmtNum(p.money), sub: 'Glück ' + Math.round(p.luck * 100) + ' % · Kraft ' + Math.round(p.strength * 100) + ' %' }),
            h(Stat, { label: 'Fänge gesamt', value: fmtNum(totals.fish), sub: fmtNum(totals.bites) + ' Bisse' }),
            h(Stat, { label: 'Gefangenes Gewicht', value: fmtNum(totals.weight, 1) + ' kg', sub: totals.bites ? Math.round(totals.fish / totals.bites * 100) + ' % Trefferquote' : '–' }),
            h(Stat, { label: 'Angelzeit', value: fmtTime(totals.time), sub: stats.total + ' Arten gefangen' })),

        h('div', { className: 'ufs-row', style: { margin: '1rem 0 .8rem' } },
            h(Toggle, { active: tab === 'reviere', onClick: function () { setTab('reviere'); } }, 'Reviere'),
            h(Toggle, { active: tab === 'arten', onClick: function () { setTab('arten'); } }, 'Größte Fische'),
            h(Toggle, { active: tab === 'sets', onClick: function () { setTab('sets'); } }, 'Rutensets')),

        tab === 'sets'
            ? h('div', null,
                h(RodSets, { sets: p.sets }),
                !p.sets || !p.sets.length
                    ? h('div', { className: 'ufs-note' }, 'Der Spielstand enthält keine gespeicherten Rutensets.')
                    : h('div', { className: 'ufs-muted', style: { fontSize: '11.5px', marginTop: '.7rem', lineHeight: 1.55 } },
                        'Die fünf Sets aus dem Spiel mit Rute, Rolle, Schnur, Pose, Haken, Ködern und Montage. ' +
                        'Hakenstufe, Tiefe und Schrot sind die zuletzt eingestellten Werte des jeweiligen Sets.'),
                p.owned && Object.keys(p.owned).length
                    ? h('div', { className: 'ufs-spotcard', style: { marginTop: '.9rem' } },
                        h('h3', null, 'Gekaufte Ausrüstung'),
                        h('div', { className: 'ufs-row' },
                            Object.keys(p.owned).sort(function (a, b) { return p.owned[b] - p.owned[a]; })
                                .map(function (c) {
                                    return h('span', { key: c, className: 'ufs-chip' }, categoryLabel(c) + ': ' + p.owned[c]);
                                })))
                    : null)
            : null,

        tab === 'reviere'
            ? h('div', { className: 'ufs-spotcard', key: 'rev' },
                h('table', { className: 'ufs-rec' },
                    h('thead', null, h('tr', null,
                        h('th', null, 'Revier'), h('th', null, 'Fische'), h('th', null, 'Bisse'),
                        h('th', null, 'Quote'), h('th', null, 'Zeit'), h('th', null, 'Gewicht'),
                        h('th', null, 'Größter Fang'), h('th', null, 'Punkte'))),
                    h('tbody', null, fRows.map(function (r) {
                        const s = r.st;
                        return h('tr', {
                            key: r.id, style: { cursor: 'pointer' },
                            onClick: function () { props.onOpenMap(r.id); }
                        },
                            h('td', { className: 'n' }, r.name),
                            h('td', { className: 'num' }, fmtNum(s.fish)),
                            h('td', { className: 'num' }, fmtNum(s.bites)),
                            h('td', { className: 'num' }, s.bites ? Math.round(s.fish / s.bites * 100) + ' %' : '–'),
                            h('td', { className: 'num' }, fmtTime(s.time)),
                            h('td', { className: 'num' }, fmtNum(s.weight, 1) + ' kg'),
                            h('td', { className: 'num' }, s.bigW ? s.bigW.toFixed(2) + ' kg · ' + Math.round(s.bigL * 100) + ' cm' : '–'),
                            h('td', { className: 'num' }, fmtNum(s.score)));
                    }),
                        h('tr', null,
                            h('td', { className: 'n' }, 'Summe'),
                            h('td', { className: 'num' }, fmtNum(totals.fish)),
                            h('td', { className: 'num' }, fmtNum(totals.bites)),
                            h('td', { className: 'num' }, totals.bites ? Math.round(totals.fish / totals.bites * 100) + ' %' : '–'),
                            h('td', { className: 'num' }, fmtTime(totals.time)),
                            h('td', { className: 'num' }, fmtNum(totals.weight, 1) + ' kg'),
                            h('td', { className: 'num' }, ''),
                            h('td', { className: 'num' }, fmtNum(totals.score))))))
            : tab === 'arten' ? h('div', { className: 'ufs-spotcard' },
                h('table', { className: 'ufs-rec' },
                    h('thead', null, h('tr', null,
                        h('th', null, 'Art'), h('th', null, 'Dein Rekord'), h('th', null, 'Möglich'),
                        h('th', null, 'Ausschöpfung'), h('th', null, 'Fänge'), h('th', null, 'Gesamt'),
                        h('th', null, 'Rekordrevier'))),
                    h('tbody', null, sRows.map(function (r) {
                        return h('tr', {
                            key: r.key, style: { cursor: 'pointer' },
                            onClick: function () { props.onOpenSpecies(r.key); }
                        },
                            h('td', { className: 'n done' }, speciesName(r.key, props.lang)),
                            h('td', { className: 'num' },
                                (r.b.weight ? r.b.weight.toFixed(2) + ' kg' : '–') +
                                (r.b.length ? ' · ' + Math.round(r.b.length * 100) + ' cm' : '')),
                            h('td', { className: 'num' }, r.sp.wMax ? r.sp.wMax + ' kg' : '–'),
                            h('td', null, r.pct
                                ? h('div', { className: 'ufs-recbar', title: Math.round(r.pct * 100) + ' %' },
                                    h('span', { style: { width: (r.pct * 100) + '%' } }))
                                : h('span', { className: 'sub' }, '–')),
                            h('td', { className: 'num' }, fmtNum(r.b.count)),
                            h('td', { className: 'num' }, r.b.sum ? fmtNum(r.b.sum, 1) + ' kg' : '–'),
                            h('td', { className: 'sub' }, fisheryLabel(r.b.fishery) || '–'));
                    }))))
            : null);
}

function Stat(props) {
    return h('div', { className: 'ufs-stat' },
        h('div', { className: 'lb' }, props.label),
        h('div', { className: 'vl' }, props.value),
        props.sub ? h('div', { className: 'sb' }, props.sub) : null);
}

/* ---------------------------------------------------- Gesamtübersicht */

/** Fortschritt über alle Reviere: Arten insgesamt und je Revier. */
function GlobalOverview(props) {
    const caught = props.caught;
    const all = props.allKeys;
    const done = all.filter(function (k) { return caught[k]; }).length;

    const rows = Object.keys(FISHERIES).map(function (id) {
        const m = D.maps.filter(function (x) { return x.id === id; })[0];
        const keys = FISHERIES[id].species.map(function (g) { return g.s; });
        const dn = keys.filter(function (k) { return caught[k]; }).length;
        return { id: id, name: m ? m.name : id, total: keys.length, done: dn };
    }).sort(function (a, b) { return (b.done / (b.total || 1)) - (a.done / (a.total || 1)); });

    const complete = rows.filter(function (r) { return r.total && r.done === r.total; }).length;

    return h('div', null,
        h('div', { className: 'ufs-statgrid', style: { marginBottom: '1rem' } },
            h(Stat, { label: 'Arten gefangen', value: done + ' / ' + all.length, sub: Math.round(done / (all.length || 1) * 100) + ' % der Artenliste' }),
            h(Stat, { label: 'Reviere komplett', value: complete + ' / ' + rows.length, sub: 'alle Arten des Reviers gefangen' }),
            h(Stat, { label: 'Noch offen', value: (all.length - done), sub: 'Arten ohne Haken' })),
        h('div', { style: { marginBottom: '1.2rem' } }, h(Bar, { value: done, total: all.length })),
        h('div', { className: 'ufs-spotcard' },
            h('h3', null, 'Fortschritt je Revier'),
            h('table', { className: 'ufs-rec' },
                h('thead', null, h('tr', null,
                    h('th', null, 'Revier'), h('th', null, 'Gefangen'), h('th', null, 'Fortschritt'), h('th', null, 'Offen'))),
                h('tbody', null, rows.map(function (r) {
                    const open = FISHERIES[r.id].species
                        .filter(function (g) { return !caught[g.s]; })
                        .map(function (g) { return speciesName(g.s, props.lang); });
                    return h('tr', {
                        key: r.id, style: { cursor: 'pointer' },
                        onClick: function () { props.onOpenMap(r.id); }
                    },
                        h('td', { className: cn('n', r.total && r.done === r.total && 'done') },
                            (r.total && r.done === r.total ? '✓ ' : '') + r.name),
                        h('td', { className: 'num' }, r.done + ' / ' + r.total),
                        h('td', null, h('div', { className: 'ufs-recbar' },
                            h('span', { style: { width: (r.total ? r.done / r.total * 100 : 0) + '%' } }))),
                        h('td', { className: 'sub' },
                            open.length ? open.slice(0, 4).join(', ') + (open.length > 4 ? ' +' + (open.length - 4) : '') : '–'));
                })))));
}

/* ------------------------------------------------------------- API-Zugriff */

// Ohne Server (Datei direkt im Browser geöffnet) läuft alles rein lokal weiter.
const API_AVAILABLE = location.protocol === 'http:' || location.protocol === 'https:';

/** Kleiner Wrapper um fetch; wirft bei Fehlern mit der Serverfehlermeldung. */
function api(path, opts) {
    opts = opts || {};
    const init = {
        method: opts.method || 'GET',
        credentials: 'same-origin',
        headers: {}
    };
    if (opts.json !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(opts.json);
    } else if (opts.body !== undefined) {
        init.body = opts.body;
    }
    return fetch('/api' + path, init).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
            if (!r.ok) throw new Error(data.error || ('Serverfehler ' + r.status));
            return data;
        });
    });
}

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

/** Ist a später als b? Ein fehlender Zeitpunkt gilt als „uralt“. */
function newerThan(a, b) {
    const ta = Date.parse(a || '');
    if (isNaN(ta)) return false;
    const tb = Date.parse(b || '');

    return isNaN(tb) || ta > tb;
}

/* ------------------------------------------------------------ Anmeldung */

/**
 * Bot-Prüfung nach dem ALTCHA-Verfahren, ohne Dienst von außen: Der Server
 * nennt SHA-256(salt + zahl), der Browser probiert die Zahlen durch. Für
 * Menschen ein Wimpernschlag, für Massenversand teuer genug.
 *
 * In Blöcken gerechnet, damit die Oberfläche zwischendurch zeichnen kann.
 */
function solveAltcha(c, onProgress) {
    const enc = new TextEncoder();
    const max = c.maxnumber || 100000;
    const started = Date.now();
    const BLOCK = 2000;

    function hex(buf) {
        const b = new Uint8Array(buf);
        let s = '';
        for (let i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
        return s;
    }
    function block(from) {
        const to = Math.min(from + BLOCK - 1, max);
        const jobs = [];
        for (let n = from; n <= to; n++) jobs.push(crypto.subtle.digest('SHA-256', enc.encode(c.salt + n)));
        return Promise.all(jobs).then(function (out) {
            for (let i = 0; i < out.length; i++) {
                if (hex(out[i]) === c.challenge) return from + i;
            }
            if (to >= max) return null;
            if (onProgress) onProgress(to / max);
            return new Promise(function (go) { setTimeout(go, 0); }).then(function () { return block(to + 1); });
        });
    }
    return block(0).then(function (number) {
        if (number === null) throw new Error('Die Bot-Prüfung ging nicht auf. Bitte die Seite neu laden.');
        return btoa(JSON.stringify({
            algorithm: c.algorithm, challenge: c.challenge, number: number,
            salt: c.salt, signature: c.signature, took: Date.now() - started
        }));
    });
}

/** Holt eine Aufgabe, löst sie und reicht die Lösung nach oben. */
function AltchaBox(props) {
    const [state, setState] = useState({ s: 'load', p: 0, err: null });

    useEffect(function () {
        let alive = true;
        if (!window.crypto || !crypto.subtle) {
            setState({ s: 'err', p: 0, err: 'Dieser Browser stellt keine Kryptofunktionen bereit.' });
            return;
        }
        setState({ s: 'load', p: 0, err: null });
        props.onSolved(null);
        api('/auth/challenge')
            .then(function (c) {
                if (!alive) return null;
                setState({ s: 'work', p: 0, err: null });
                return solveAltcha(c, function (p) { if (alive) setState({ s: 'work', p: p, err: null }); });
            })
            .then(function (payload) {
                if (!alive || !payload) return;
                setState({ s: 'ok', p: 1, err: null });
                props.onSolved(payload);
            })
            .catch(function (e) {
                if (alive) setState({ s: 'err', p: 0, err: e.message });
            });
        return function () { alive = false; };
    }, [props.round]);

    const text = state.s === 'ok' ? 'Kein Bot – geprüft'
        : state.s === 'err' ? state.err
            : state.s === 'work' ? 'Prüfung läuft … ' + Math.round(state.p * 100) + ' %'
                : 'Prüfung wird vorbereitet …';

    return h('div', { className: cn('ufs-altcha', state.s === 'ok' && 'ok', state.s === 'err' && 'bad') },
        h('span', { className: 'mark', 'aria-hidden': true },
            state.s === 'ok' ? '✓' : state.s === 'err' ? '!' : '◔'),
        h('span', { className: 'txt' }, text),
        h('span', { className: 'by' }, 'ALTCHA · eigener Server'));
}

function LoginPanel(props) {
    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);
    const [altcha, setAltcha] = useState(null);
    const [round, setRound] = useState(0);
    const [remember, setRemember] = useState(true);

    function send() {
        if (!altcha) return;
        setBusy(true); setMsg(null);
        api('/auth/request', { method: 'POST', json: { email: email, altcha: altcha } })
            .then(function () { setStep('code'); setMsg({ ok: true, t: 'Code ist unterwegs. Er gilt 15 Minuten.' }); })
            .catch(function (e) { setMsg({ ok: false, t: e.message }); })
            // Jede Aufgabe zählt nur einmal – für den nächsten Versuch eine neue holen
            .then(function () { setBusy(false); setRound(function (r) { return r + 1; }); });
    }
    function verify() {
        setBusy(true); setMsg(null);
        api('/auth/verify', { method: 'POST', json: { email: email, code: code, remember: remember } })
            .then(function (d) { props.onLogin(d.user); })
            .catch(function (e) { setMsg({ ok: false, t: e.message }); })
            .then(function () { setBusy(false); });
    }

    return h('div', { className: 'ufs-spotcard', style: { maxWidth: '460px' } },
        h('h3', null, 'Anmelden'),
        h('p', { className: 'ufs-muted', style: { fontSize: '12.5px', lineHeight: 1.6, margin: '0 0 .8rem' } },
            'Kein Passwort: Du bekommst einen sechsstelligen Code per E-Mail. ' +
            'Mit dem Konto liegt dein Profil auf dem Server, du kannst Gruppen beitreten und dich vergleichen.'),
        step === 'email'
            ? h('div', null,
                h(AltchaBox, { round: round, onSolved: setAltcha }),
                h('div', { className: 'ufs-row', style: { marginTop: '.7rem' } },
                    h('input', {
                        type: 'email', value: email, placeholder: 'deine@mail.de',
                        onChange: function (e) { setEmail(e.target.value); },
                        onKeyDown: function (e) { if (e.key === 'Enter' && email && altcha) send(); },
                        className: 'rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50',
                        style: { minWidth: '220px' }
                    }),
                    h('button', { className: 'ufs-btn primary', disabled: busy || !email || !altcha, onClick: send },
                        busy ? 'Sende …' : altcha ? 'Code anfordern' : 'Prüfung läuft …')))
            : h('div', { className: 'ufs-row' },
                h('input', {
                    inputMode: 'numeric', value: code, placeholder: '123456', maxLength: 6,
                    onChange: function (e) { setCode(e.target.value.replace(/\D/g, '')); },
                    onKeyDown: function (e) { if (e.key === 'Enter' && code.length === 6) verify(); },
                    className: 'rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50',
                    style: { width: '140px', letterSpacing: '.3em', fontVariantNumeric: 'tabular-nums' }
                }),
                h('button', { className: 'ufs-btn primary', disabled: busy || code.length !== 6, onClick: verify },
                    busy ? 'Prüfe …' : 'Anmelden'),
                h('button', { className: 'ufs-btn', onClick: function () { setStep('email'); setCode(''); } }, 'Zurück')),
        h('label', { className: 'ufs-check', style: { marginTop: '.8rem' } },
            h('input', {
                type: 'checkbox', checked: remember,
                onChange: function (e) { setRemember(e.target.checked); }
            }),
            h('span', null, 'Angemeldet bleiben'),
            h('span', { className: 'ufs-muted', style: { fontSize: '11.5px' } }, '(90 Tage, nur auf diesem Gerät)')),
        msg ? h('div', {
            className: 'ufs-note',
            style: msg.ok ? { borderColor: 'rgba(52,211,153,.3)', background: 'rgba(16,185,129,.08)', color: '#a7f3d0', marginTop: '.8rem' } : { marginTop: '.8rem' }
        }, msg.t) : null);
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
 * Der vierte Eintrag ist die Erklärung, damit auch abgeleitete Werte
 * nachvollziehbar bleiben.
 */
const DUEL_GROUPS = [
    ['Fortschritt', [
        ['Arten gefangen', function (p) { return p.speciesCount; }, plain, ''],
        ['Reviere komplett', function (p) { return p.fisheriesComplete; }, plain, 'alle Arten des Reviers gefangen'],
        ['Reviere bereist', function (p) { return Object.keys(p.fisheries || {}).length; }, plain, 'mindestens ein Biss'],
        ['Level', function (p) { return p.level; }, plain, ''],
        ['Punkte', function (p) { return p.score; }, plain, '']
    ]],
    ['Ausbeute', [
        ['Fänge', function (p) { return p.totals.fish; }, plain, ''],
        ['Bisse', function (p) { return p.totals.bites; }, plain, ''],
        ['Masse gesamt', function (p) { return p.totals.weight; }, kg1, ''],
        ['Angelzeit', function (p) { return p.totals.time; }, fmtTime, '']
    ]],
    ['Rekorde', [
        ['Schwerster Fisch', function (p) { return p.biggest.weight; }, kg2, ''],
        ['Längster Fisch', function (p) { return p.biggest.length; },
            function (v) { return v ? Math.round(v * 100) + ' cm' : '–'; }, ''],
        ['Masse einer Art', function (p) { return p.topSpecies.weight; }, kg1, 'Summe der schwersten Art']
    ]],
    ['Effizienz', [
        ['Verwertete Bisse', function (p) { return p.totals.bites ? p.totals.fish / p.totals.bites * 100 : 0; },
            function (v) { return fmtNum(v, 1) + ' %'; }, 'Fänge je Biss'],
        ['Fänge je Stunde', function (p) { return p.totals.time ? p.totals.fish / (p.totals.time / 3600) : 0; },
            function (v) { return fmtNum(v, 1); }, ''],
        ['Masse je Fang', function (p) { return p.totals.fish ? p.totals.weight / p.totals.fish : 0; }, kg2, ''],
        ['Punkte je Stunde', function (p) { return p.totals.time ? p.score / (p.totals.time / 3600) : 0; },
            function (v) { return fmtNum(v, 0); }, '']
    ]]
];

const DUEL_FILTERS = [
    ['alle', 'Alle'],
    ['diff', 'Unterschiede'],
    ['both', 'Beide gefangen'],
    ['his', 'Nur er'],
    ['mine', 'Nur ich'],
    ['lead', 'Ich führe'],
    ['behind', 'Er führt']
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
            return { k: k, name: speciesName(k, props.lang), a: a, b: b };
        }).sort(function (x, y) { return x.name.localeCompare(y.name, 'de'); });
    }, [duel, p, mine, props.lang]);

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
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { prompt('Adresse zum Kopieren:', url); });
        else prompt('Adresse zum Kopieren:', url);
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
            'Profile brauchen den Server. Öffne den Guide über ', h('code', null, 'https://ufs-atlas.de'), '.');
    }

    // Menüpunkte: was es beim fremden Profil nicht zu sehen gibt, fällt weg.
    const self = !!(data && data.self);
    const items = [
        { k: 'uebersicht', t: 'Übersicht', s: p ? fmtNum(p.speciesCount) + ' Arten' : 'ohne Spielstand' },
        p ? { k: 'reviere', t: 'Reviere', s: fmtNum(p.fisheriesComplete) + ' komplett' } : null,
        p ? { k: 'arten', t: 'Arten', s: fmtNum(Object.keys(p.species).length) + ' Rekorde' } : null,
        p ? { k: 'offen', t: 'Was noch fehlt', s: (data.meta.totalSpecies - p.speciesCount) + ' Arten' } : null,
        duel ? { k: 'vergleich', t: 'Vergleich mit dir', s: rows.length + ' Arten' } : null,
        {
            k: 'follower', t: 'Follower',
            s: (data ? (data.followers || 0) : 0) + ' folgen · folgt ' + (data ? (data.follows || 0) : 0)
        },
        { k: 'gruppen', t: 'Gruppen', s: (data && data.groups ? data.groups.length : 0) + ' Stück' },
        self ? { k: 'konto', t: 'Einstellungen', s: 'Name, Token, Abmelden' } : null
    ].filter(Boolean);
    const active = items.some(function (x) { return x.k === tab; }) ? tab : 'uebersicht';

    if (!data) {
        return h('div', null,
            h('div', { className: 'ufs-row no-print', style: { marginBottom: '.9rem' } },
                h('button', { className: 'ufs-btn', onClick: props.onBack }, '← Zurück')),
            err ? h('div', { className: 'ufs-note' }, err) : h('p', { className: 'ufs-muted' }, 'Wird geladen …'));
    }

    // Dieselbe Spaltenaufteilung wie die Revieransicht; die Klasse steht so im
    // vorgefertigten Tailwind-Stylesheet und darf nicht abgewandelt werden.
    return h('div', { className: 'grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]' },
        // Seitenmenü im Stil der Revierliste
        h('aside', { className: 'no-print self-start lg:sticky lg:top-24' },
            h('div', { className: 'glass scrollbar max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl border border-white/10 p-3 shadow-2xl' },
                h('div', { className: 'px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-[.18em] text-slate-500' },
                    self ? 'Dein Profil' : 'Profil'),
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
                        copied ? '✓ Kopiert' : 'Link kopieren'),
                    props.me && !self
                        ? h('button', {
                            className: cn('ufs-btn', data.following && 'primary'), style: { width: '100%' },
                            disabled: busy, onClick: toggleFollow
                        }, data.following ? '✓ Du folgst' : 'Folgen')
                        : null,
                    h('button', { className: 'ufs-btn', style: { width: '100%' }, onClick: props.onBack }, '← Zurück')))),

        h('div', { className: 'min-w-0' },
            err ? h('div', { className: 'ufs-note', style: { marginBottom: '.9rem' } }, err) : null,
            h('div', { className: 'ufs-profhead' },
                h('div', null,
                    h('h1', { className: 'text-2xl font-black tracking-tight text-white', style: { margin: 0 } }, data.user.name),
                    h('p', { className: 'ufs-muted', style: { fontSize: '12px', margin: '.25rem 0 0' } },
                        p ? 'Angler ' + (p.anglerName || data.user.name)
                            + (p.version ? ' · Spielstand ' + p.version : '')
                            : 'Noch kein Spielstand hochgeladen.')),
                h('div', { className: 'ufs-row', style: { gap: '.5rem' } },
                    h('span', { className: 'ufs-chip', title: 'Angler, die diesem Profil folgen' },
                        'Follower ', h('b', null, fmtNum(data.followers || 0))),
                    h('span', { className: 'ufs-chip', title: 'Profile, denen dieses Konto folgt' },
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
                    data: data, p: p, mine: mine, lang: props.lang,
                    rows: shown, all: rows, filter: filter, onFilter: setFilter
                })
                : !p
                ? h('div', { className: 'ufs-note' }, 'Dieser Angler hat noch keinen Spielstand hochgeladen.')
                : h(ProfileDetails, { p: p, data: data, lang: props.lang, tab: active }),

            active === 'uebersicht' && !props.me
                ? h('div', { className: 'ufs-note no-print', style: { marginTop: '.9rem' } },
                    'Melde dich an, dann wird dein Profil hier Wert für Wert gegen ' + data.user.name + ' gestellt.')
                : null,
            active === 'uebersicht' && props.me && p && !mine && !self
                ? h('div', { className: 'ufs-note', style: { marginTop: '.9rem' } },
                    'Für den Vergleich fehlt dein eigener Spielstand. Lade ihn unter „Einstellungen“ hoch.')
                : null));
}


const OWNED_LABEL = {
    ROD: 'Ruten', ICE_ROD: 'Eisruten', REEL: 'Rollen', LINE: 'Schnüre', FLOAT: 'Posen',
    HOOK: 'Haken', BOILIE: 'Boilies', FEEDER: 'Feeder', FEEDER_BAIT: 'Feederköder',
    ROD_STAND: 'Rutenständer', BITE_INDICATOR: 'Bissanzeiger', BAIT: 'Köder', LURE: 'Kunstköder',
    BOAT: 'Boote', SONST: 'Sonstiges'
};

/** Die Gruppen eines Profils; verwaltet werden sie auf der Gruppenseite. */
function ProfileGroupList(props) {
    const groups = props.groups;
    return h('div', { className: 'ufs-spotcard' },
        h('div', { className: 'ufs-row', style: { justifyContent: 'space-between', marginBottom: '.6rem' } },
            h('h3', { style: { margin: 0 } }, props.self ? 'Deine Gruppen' : 'Gruppen'),
            props.self
                ? h('button', { className: 'ufs-btn', onClick: props.onOpenGroups }, 'Gruppen verwalten')
                : null),
        !groups.length
            ? h('p', { className: 'ufs-muted', style: { fontSize: '12.5px', margin: 0 } },
                props.self
                    ? 'Du bist noch in keiner Gruppe.'
                    : 'Dieser Angler ist in keiner öffentlichen Gruppe.')
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
    const p = props.p, lang = props.lang;
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

    const SORTS = [['sum', 'Masse gesamt'], ['best', 'Bestmasse'], ['length', 'Länge'], ['count', 'Stück'], ['name', 'Name']];

    return h('div', null,
        tab !== 'uebersicht' ? null : h('div', { className: 'ufs-statgrid' },
            h(Stat, { label: 'Level', value: fmtNum(p.level), sub: fmtNum(p.score) + ' Punkte' }),
            h(Stat, {
                label: 'Arten', value: fmtNum(p.speciesCount) + ' / ' + props.data.meta.totalSpecies,
                sub: Math.round(p.speciesCount / (props.data.meta.totalSpecies || 1) * 100) + ' % der Artenliste'
            }),
            h(Stat, {
                label: 'Reviere komplett', value: fmtNum(p.fisheriesComplete) + ' / ' + props.data.meta.totalFisheries,
                sub: Object.keys(p.fisheries || {}).length + ' Reviere bereist'
            }),
            h(Stat, { label: 'Fänge', value: fmtNum(p.totals.fish), sub: fmtNum(p.totals.bites) + ' Bisse' }),
            h(Stat, { label: 'Masse gesamt', value: fmtNum(p.totals.weight, 1) + ' kg', sub: 'Ø ' + fmtNum(avg, 2) + ' kg je Fang' }),
            h(Stat, { label: 'Angelzeit', value: fmtTime(p.totals.time), sub: fmtNum(perHour, 1) + ' Fänge je Stunde' }),
            h(Stat, {
                label: 'Schwerster', value: p.biggest.weight ? p.biggest.weight.toFixed(2) + ' kg' : '–',
                sub: p.biggest.weightSpecies ? speciesName(p.biggest.weightSpecies, lang) : ''
            }),
            h(Stat, {
                label: 'Längster', value: p.biggest.length ? Math.round(p.biggest.length * 100) + ' cm' : '–',
                sub: p.biggest.lengthSpecies ? speciesName(p.biggest.lengthSpecies, lang) : ''
            }),
            h(Stat, {
                label: 'Stärkste Art', value: p.topSpecies.weight ? fmtNum(p.topSpecies.weight, 1) + ' kg' : '–',
                sub: p.topSpecies.key ? speciesName(p.topSpecies.key, lang) : ''
            }),
            h(Stat, { label: 'Verwertete Bisse', value: fmtNum(quote, 1) + ' %', sub: 'Fänge je Biss' }),
            p.money ? h(Stat, { label: 'Geld', value: fmtNum(p.money), sub: fmtNum(p.exp) + ' Erfahrung' }) : null,
            p.luck || p.strength ? h(Stat, {
                label: 'Fähigkeiten', value: 'Glück ' + fmtNum(p.luck, 1),
                sub: 'Stärke ' + fmtNum(p.strength, 1)
            }) : null),

        tab !== 'uebersicht' ? null : h('div', { style: { margin: '1rem 0' } },
            h(Bar, { value: p.speciesCount, total: props.data.meta.totalSpecies })),

        tab === 'uebersicht' && owned.length
            ? h('div', { className: 'ufs-spotcard', style: { marginBottom: '.9rem' } },
                h('h3', null, 'Gekaufte Ausrüstung'),
                h('div', { className: 'ufs-row', style: { gap: '.35rem', flexWrap: 'wrap' } },
                    owned.map(function (c) {
                        return h('span', { key: c, className: 'ufs-chip' }, (OWNED_LABEL[c] || c) + ': ' + p.owned[c]);
                    })))
            : null,

        tab === 'reviere' ? h('div', { className: 'ufs-spotcard' },
            h('h3', null, 'Fortschritt je Revier'),
            h('div', { className: 'ufs-scroll' },
                h('table', { className: 'ufs-rec' },
                    h('thead', null, h('tr', null,
                        h('th', null, 'Revier'), h('th', null, 'Arten'), h('th', null, 'Fortschritt'),
                        h('th', null, 'Fänge'), h('th', null, 'Bisse'), h('th', null, 'Masse'),
                        h('th', null, 'Zeit'), h('th', null, 'Punkte'), h('th', null, 'Schwerster'), h('th', null, 'Längster'))),
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
                        h('th', null, '#'), h('th', null, 'Art'), h('th', null, 'Stück'),
                        h('th', null, 'Bestmasse'), h('th', null, 'Beste Länge'),
                        h('th', null, 'Masse gesamt'), h('th', null, 'Ø je Stück'), h('th', null, 'Rekord aus'))),
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
    const p = props.p, mine = props.mine;
    const them = props.data.user.name, me = props.data.me.user.name;
    const lang = props.lang;

    /* Bilanz über alle Arten: wer hat sie, und wer hält den schwereren Fisch. */
    const tally = useMemo(function () {
        const t = { both: 0, his: 0, mine: 0, leadW: 0, behindW: 0, tieW: 0, leadL: 0, behindL: 0, leadC: 0, behindC: 0 };
        props.all.forEach(function (r) {
            if (r.a && r.b) t.both++;
            else if (r.a) t.his++;
            else t.mine++;
            if (!r.a || !r.b) return;
            if (r.b.best > r.a.best + 0.0005) t.leadW++;
            else if (r.a.best > r.b.best + 0.0005) t.behindW++;
            else t.tieW++;
            if (r.b.length > r.a.length + 0.0005) t.leadL++;
            else if (r.a.length > r.b.length + 0.0005) t.behindL++;
            if (r.b.count > r.a.count) t.leadC++;
            else if (r.a.count > r.b.count) t.behindC++;
        });

        return t;
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
            h('td', { className: 'n' }, label, hint ? h('span', { className: 'hint' }, hint) : null),
            h('td', { className: cn('num', duelClass(a, b)) }, fmt(a)),
            h('td', { className: cn('num', duelClass(b, a)) }, fmt(b)),
            h('td', { className: 'sub' },
                (a || 0) === (b || 0) ? 'gleichauf' : ((b > a ? '▲ du ' : '▼ er ') + fmt(Math.abs(b - a)))));
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
                    h('th', null, ''), h('th', null, them), h('th', null, me), h('th', null, 'Differenz'))),
                DUEL_GROUPS.map(function (grp) {
                    return h('tbody', { key: grp[0] },
                        h('tr', { className: 'grp' }, h('td', { colSpan: 4 }, grp[0])),
                        grp[1].map(function (row) {
                            return line(row[0], row[1](p) || 0, row[1](mine) || 0, row[2], row[3]);
                        }));
                }))),

        h('div', { className: 'ufs-spotcard', style: { marginTop: '.9rem' } },
            h('h3', null, 'Artenbilanz'),
            h('div', { className: 'ufs-row', style: { gap: '.4rem', flexWrap: 'wrap' } },
                h('span', { className: 'ufs-chip' }, 'Beide: ' + tally.both),
                h('span', { className: 'ufs-chip' }, 'Nur ' + them + ': ' + tally.his),
                h('span', { className: 'ufs-chip' }, 'Nur du: ' + tally.mine),
                h('span', { className: 'ufs-chip' }, 'Noch keiner: '
                    + Math.max(0, props.data.meta.totalSpecies - props.all.length))),
            h('table', { className: 'ufs-rec ufs-duel', style: { marginTop: '.7rem' } },
                h('thead', null, h('tr', null,
                    h('th', null, 'Gemeinsame Arten'), h('th', null, them), h('th', null, me), h('th', null, 'unentschieden'))),
                h('tbody', null,
                    h('tr', null,
                        h('td', { className: 'n' }, 'Schwererer Fisch'),
                        h('td', { className: cn('num', duelClass(tally.behindW, tally.leadW)) }, tally.behindW),
                        h('td', { className: cn('num', duelClass(tally.leadW, tally.behindW)) }, tally.leadW),
                        h('td', { className: 'sub' }, tally.tieW)),
                    h('tr', null,
                        h('td', { className: 'n' }, 'Längerer Fisch'),
                        h('td', { className: cn('num', duelClass(tally.behindL, tally.leadL)) }, tally.behindL),
                        h('td', { className: cn('num', duelClass(tally.leadL, tally.behindL)) }, tally.leadL),
                        h('td', { className: 'sub' }, tally.both - tally.leadL - tally.behindL)),
                    h('tr', null,
                        h('td', { className: 'n' }, 'Mehr Stück'),
                        h('td', { className: cn('num', duelClass(tally.behindC, tally.leadC)) }, tally.behindC),
                        h('td', { className: cn('num', duelClass(tally.leadC, tally.behindC)) }, tally.leadC),
                        h('td', { className: 'sub' }, tally.both - tally.leadC - tally.behindC))))),

        h('div', { className: 'ufs-spotcard', style: { marginTop: '.9rem' } },
            h('h3', null, 'Revier für Revier'),
            h('div', { className: 'ufs-scroll' },
                h('table', { className: 'ufs-rec ufs-duel' },
                    h('thead', null,
                        h('tr', null,
                            h('th', null, 'Revier'),
                            h('th', { colSpan: 2 }, 'Arten'),
                            h('th', { colSpan: 2 }, 'Fänge'),
                            h('th', { colSpan: 2 }, 'Masse'),
                            h('th', { colSpan: 2 }, 'Zeit'),
                            h('th', { colSpan: 2 }, 'Schwerster')),
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
                'Masse in kg. „Arten“ zählt die Artenliste des Reviers, die Zahlen daneben stammen aus der Revierstatistik des Spielstands.')),

        h('div', { className: 'ufs-spotcard', style: { marginTop: '.9rem' } },
            h('div', { className: 'ufs-row', style: { justifyContent: 'space-between', marginBottom: '.7rem', flexWrap: 'wrap' } },
                h('h3', { style: { margin: 0 } }, 'Art für Art'),
                h('div', { className: 'ufs-row no-print', style: { gap: '.35rem', flexWrap: 'wrap' } },
                    DUEL_FILTERS.map(function (f) {
                        return h(Toggle, {
                            key: f[0], active: props.filter === f[0],
                            onClick: function () { props.onFilter(f[0]); }
                        }, f[1]);
                    }))),
            h('div', { className: 'ufs-scroll' },
                h('table', { className: 'ufs-rec ufs-duel' },
                    h('thead', null,
                        h('tr', null,
                            h('th', null, 'Art'),
                            h('th', { colSpan: 2 }, 'Stück'),
                            h('th', { colSpan: 2 }, 'Bestmasse'),
                            h('th', { colSpan: 2 }, 'Beste Länge'),
                            h('th', { colSpan: 2 }, 'Masse gesamt'),
                            h('th', null, '')),
                        h('tr', { className: 'sub2' },
                            h('th', null, ''),
                            h('th', null, them), h('th', null, me),
                            h('th', null, them), h('th', null, me),
                            h('th', null, them), h('th', null, me),
                            h('th', null, them), h('th', null, me),
                            h('th', null, 'Vorsprung'))),
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
                                Math.abs(d) < 0.0005 ? '–' : (d > 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(2) + ' kg'));
                    })))),
            !props.rows.length ? h('p', { className: 'ufs-muted', style: { fontSize: '12px' } }, 'Keine Art in dieser Auswahl.') : null,
            h('p', { className: 'ufs-muted', style: { fontSize: '11.5px', marginTop: '.6rem' } },
                props.rows.length + ' von ' + props.all.length + ' Arten, die mindestens einer von euch gefangen hat. '
                + 'Bestmasse und Gesamtmasse in kg, Länge in cm.')),

        /* Was dem jeweils anderen noch fehlt – der nützlichste Teil des Vergleichs. */
        h('div', { className: 'ufs-two', style: { marginTop: '.9rem' } },
            h(MissList, { title: 'Die hat nur ' + them, rows: props.all.filter(function (r) { return r.a && !r.b; }), lang: lang }),
            h(MissList, { title: 'Die hast nur du', rows: props.all.filter(function (r) { return r.b && !r.a; }), lang: lang })));
}

/** Kurze Artenliste für „das fehlt dem anderen“. */
function MissList(props) {
    return h('div', { className: 'ufs-spotcard' },
        h('h3', null, props.title, ' ', h('span', { className: 'ufs-muted' }, '(' + props.rows.length + ')')),
        props.rows.length
            ? h('div', { className: 'ufs-row', style: { gap: '.35rem', flexWrap: 'wrap' } },
                props.rows.map(function (r) {
                    return h('span', { key: r.k, className: 'ufs-chip' }, r.name);
                }))
            : h('p', { className: 'ufs-muted', style: { fontSize: '12px', margin: 0 } }, 'Keine – ihr seid gleichauf.'));
}

/** Vergleich mit den Profilen, denen man folgt. */

function AccountPanel(props) {
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
            .then(function (d) { props.onMe(d.user); setName(d.user.name); say('Name gespeichert.'); })
            .catch(fail)
            .then(function () { setBusy(false); });
    }
    function importLocal() {
        if (!localCount) return;
        if (!confirm('Der lokale Stand ersetzt dein Profil im Konto vollständig. Fortfahren?')) return;
        setBusy(true);
        api('/profile/import', {
            method: 'POST',
            json: { caught: local.caught || {}, bests: local.bests || {}, stats: local.stats || null }
        })
            .then(function (d) {
                props.onMe(d.user);
                say('Übernommen: ' + (d.profile ? d.profile.speciesCount : 0) + ' Arten im Konto.');
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

        h('h3', null, 'Benutzername'),
        h('p', { className: 'ufs-muted', style: { fontSize: '12.5px', lineHeight: 1.6, margin: '.2rem 0 .6rem' } },
            'Unter diesem Namen finden dich andere in der Suche und in Gruppen. Er ist einmalig – ' +
            'wenn ihn schon jemand hat, musst du dir einen anderen aussuchen.'),
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
            }, 'Namen speichern')),

        h('h3', null, 'Dein Profil teilen'),
        h('p', { className: 'ufs-muted', style: { fontSize: '12.5px', lineHeight: 1.6, margin: '.2rem 0 .6rem' } },
            'Diese Adresse zeigt dein Profil. Wer angemeldet ist und sie öffnet, sieht seinen eigenen Stand ' +
            'daneben – Kennzahl für Kennzahl, Revier für Revier und Art für Art.'),
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
                    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { say('Adresse kopiert.'); }, function () { });
                    else say(url);
                }
            }, 'Kopieren'),
            h('button', {
                className: 'ufs-btn primary',
                onClick: function () { props.onOpenUser(me.name); }
            }, 'Profil ansehen')),

        h('h3', null, 'Lokalen Stand übernehmen'),
        h('p', { className: 'ufs-muted', style: { fontSize: '12.5px', lineHeight: 1.6, margin: '.2rem 0 .6rem' } },
            localCount
                ? 'In diesem Browser sind ' + localCount + ' Arten abgehakt' +
                  (local.stats && local.stats.player ? ' – dazu die Werte des zuletzt geladenen Spielstands' : '') +
                  '. Damit lässt sich das Profil im Konto füllen, ohne die PROFILE-Datei erneut zu laden.'
                : 'In diesem Browser ist nichts gespeichert. Hake unter „Reviere“ Arten ab oder lade unter „Statistik“ einen Spielstand.'),
        h('div', { className: 'ufs-row', style: { marginBottom: '1.1rem' } },
            h('button', {
                className: 'ufs-btn', disabled: busy || !localCount, onClick: importLocal
            }, h(Icon, { name: 'import' }), 'Lokalen Stand ins Konto übernehmen')),

        h('h3', null, 'Spielstand automatisch hochladen'),
        h('p', { className: 'ufs-muted', style: { fontSize: '12.5px', lineHeight: 1.6, margin: '.2rem 0 .6rem' } },
            'Mit diesem Befehl lädst du deinen Spielstand ohne Anmeldung hoch – etwa aus der ' +
            'Windows-Aufgabenplanung nach jeder Angelsession. Jeder Upload ersetzt dein Profil vollständig.'),
        h('pre', { className: 'ufs-cmd' }, cmd),
        h('div', { className: 'ufs-row' },
            h('button', {
                className: 'ufs-btn',
                onClick: function () { navigator.clipboard && navigator.clipboard.writeText(cmd); }
            }, 'Befehl kopieren'),
            h('button', {
                className: 'ufs-btn danger',
                onClick: function () {
                    if (!confirm('Neuen Token erzeugen? Der alte funktioniert danach nicht mehr.')) return;
                    api('/auth/token/new', { method: 'POST' }).then(function (d) { setToken(d.token); });
                }
            }, 'Token erneuern'),
            h('button', { className: 'ufs-btn', onClick: props.onLogout }, 'Abmelden')));
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
                        spots: g.spots && g.spots.length ? 'Spots ' + g.spots.join(', ') : 'siehe Karte',
                        hook: 'an die Fischgröße anpassen', bait: '—', groundbait: '—',
                        depth: 'Schwarmtiefe im Spiel prüfen', method: 'nicht im Guide erfasst',
                        retrieve: '—', time: 'Keine feste Zeit belegt',
                        notes: 'Diese Art steht in den Spieldateien dieses Reviers, aber noch nicht im recherchierten Guide.',
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
                        title: me ? 'Dein Profil – die Adresse lässt sich weitergeben' : 'Anmelden',
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
                    h('div', { className: 'px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-[.18em] text-slate-500' }, 'Karten'),
                    h('button', {
                        onClick: function () { setSelectedMap('__all__'); },
                        className: cn('group mb-3 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition',
                            selectedMap === '__all__' ? 'border border-cyan-300/20 bg-cyan-400/10' : 'border border-transparent hover:bg-white/[.045]')
                    },
                        h('span', { className: 'h-2.5 w-2.5 rounded-full bg-cyan-300/70' }),
                        h('span', { className: 'min-w-0 flex-1' },
                            h('span', { className: 'block truncate text-sm font-semibold text-slate-200' }, 'Gesamtübersicht'),
                            h('span', { style: { display: 'block', marginTop: '3px' } },
                                h(Bar, { value: allDone, total: allKeys.length, thin: true }))),
                        h('span', { className: 'text-[10px] tabular-nums text-slate-600' }, allDone + '/' + allKeys.length)),
                    Object.keys(grouped).map(function (group) {
                        return h('div', { key: group, className: 'mb-4' },
                            h('div', { className: 'px-3 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-600' }, group),
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
                    'Stand aus deinem Konto übernommen (' + fmtWhen(syncNote) + ').',
                    h('button', {
                        className: 'ufs-btn', style: { marginLeft: '.6rem', padding: '.15rem .6rem' },
                        onClick: function () { setSyncNote(null); }
                    }, 'Ok')) : null,
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
                    stats: saveStats, lang: lang, tab: statsTab,
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
                    initialOpen: openSpecies, onOpen: setOpenSpecies, toGerman: toGerman
                })
                : isGlobal ? h(GlobalOverview, {
                    caught: caught, allKeys: allKeys, lang: lang,
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
                                h(Mini, { label: 'Angelstil', value: map.style }),
                                h(Mini, { label: 'Arten', value: mapKeys.length ? (mapDone + ' von ' + mapKeys.length + ' gefangen') : (rows.length + ' Einträge') }),
                                h(Mini, { label: 'Spots laut Spieldaten', value: fishery && fishery.spots.length ? String(fishery.spots.length) : '–' })),
                            mapKeys.length ? h('div', { style: { marginTop: '.9rem', maxWidth: '520px' } }, h(Bar, { value: mapDone, total: mapKeys.length })) : null),
                        h('div', { className: 'rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl' },
                            h('div', { className: 'flex items-center gap-2 text-sm font-bold text-cyan-100' }, h(Icon, { name: 'info' }), 'So liest du die Angaben'),
                            h('p', { className: 'mt-3 text-sm leading-6 text-slate-400' },
                                'Spots, Artenlisten, Gewicht, Länge, Beißzeiten und die Köderinteressen kommen direkt aus ' +
                                'den Spieldateien – die Prozentwerte im Block „Aus den Spieldateien“ sind die Zahlen des Spiels. ' +
                                'Hakengröße, Führung und Tiefenangabe darüber sind Community-Erfahrungswerte.'),
                            h('div', { className: 'mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[.07] p-3 text-xs leading-5 text-amber-100/80' },
                                'Fische bewegen sich. Bei leerem Spot: Hunter Vision bzw. Fischfinder nutzen, Hakengröße reduzieren oder die Karte neu laden.')))),

                fishery ? h('section', { className: 'no-print mt-5 ufs-maplayout' },
                    h(FisheryMap, {
                        fishery: fishery, selected: selectedSpot, onSelect: setSelectedSpot,
                        caught: caught, lang: lang, highlight: pinned || highlight
                    }),
                    h('div', { className: 'ufs-col' },
                        spotObj
                            ? h(SpotPanel, { spot: spotObj, caught: caught, lang: lang })
                            : h('div', { className: 'ufs-spotcard' },
                                h('h3', null, 'Arten in diesem Revier'),
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
                                                g.guideOnly ? 'nur Guide' : (g.dlc ? 'DLC-Art' : g.fish + ' Fische')),
                                            h('span', { className: 'd' },
                                                g.guideOnly ? (g.hint || '–')
                                                    : (g.spots.length ? 'Spot ' + g.spots.slice(0, 4).join(', ')
                                                        : (g.dlc ? 'frei verteilt' : '–'))));
                                    })),
                                panelList.length > 18
                                    ? h('div', { className: 'ufs-muted', style: { fontSize: '11px', marginTop: '.4rem' } },
                                        '+ ' + (panelList.length - 18) + ' weitere Arten')
                                    : null,
                                panelList.some(function (g) { return g.guideOnly; })
                                    ? h('div', { className: 'ufs-muted', style: { fontSize: '10.5px', marginTop: '.5rem', lineHeight: 1.5 } },
                                        '„nur Guide“ heißt: Die Szene des Spiels enthält für diese Art keine Spawnpunkte. ' +
                                        'Das betrifft vor allem die Arten aus dem New-Fish-Species-DLC, die das Spiel erst zur Laufzeit ergänzt. ' +
                                        'Spotangabe stammt dann aus der Community-Recherche.')
                                    : null),
                        !fishery.fitOk
                            ? h('div', { className: 'ufs-note', style: { fontSize: '11.5px' } },
                                // Offshore-Reviere führen zu ihren Spots keine Weltkoordinaten:
                                // dort gibt es keine Reisepunkte, man fährt selbst hinaus.
                                fishery.spots.some(function (s) { return s.wx !== undefined && s.wx !== null; })
                                    ? 'Bei diesem Revier lassen sich die Weltkoordinaten der Schwärme nicht verlässlich auf das Kartenbild '
                                        + 'projizieren. Spotnummern und die Artenzuordnung je Spot stimmen trotzdem – nur die zusätzlichen '
                                        + 'Schwarm-Punkte bleiben ausgeblendet.'
                                    : 'Für dieses Revier enthalten die Spieldateien keine Kartenpunkte – hier wird ausschließlich vom Boot aus gefischt.')
                            : null)) : null,

                h('section', { className: 'no-print mt-5 rounded-3xl border border-white/10 bg-white/[.025] p-4' },
                    h('div', { className: 'flex flex-wrap items-center gap-3' },
                        h('div', { className: 'flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-slate-500' }, h(Icon, { name: 'filter' }), 'Filter'),
                        h(Select, { value: method, onChange: setMethod, options: methods }),
                        h(Select, {
                            value: confidence, onChange: setConfidence, options: ['Alle', 'hoch', 'mittel', 'niedrig'],
                            labels: { hoch: 'hohes Vertrauen', mittel: 'mittleres Vertrauen', niedrig: 'abgeleitete Werte' }
                        }),
                        h(Select, {
                            value: catchFilter, onChange: setCatchFilter, options: ['Alle', 'offen', 'gefangen'],
                            labels: { Alle: 'alle Arten', offen: 'nur fehlende', gefangen: 'nur gefangene' }
                        }),
                        h(Toggle, { active: lang === 'de', onClick: function () { i18n.setLang(lang === 'de' ? 'en' : 'de'); } },
                            lang === 'de' ? 'Köder & Führung: Deutsch' : 'Köder & Führung: Englisch'),
                        h(Toggle, { active: showOverlay, onClick: function () { setShowOverlay(!showOverlay); } }, 'New-Species-DLC'),
                        h(Toggle, { active: onlyFav, onClick: function () { setOnlyFav(!onlyFav); } }, h(Icon, { name: 'star' }), 'Favoriten'),
                        h(Toggle, { active: compact, onClick: function () { setCompact(!compact); } }, 'Kompakt'),
                        selectedSpot ? h(Toggle, { active: true, onClick: function () { setSelectedSpot(null); } }, 'nur Spot ' + selectedSpot) : null,
                        pinned ? h(Toggle, { active: true, onClick: function () { setPinned(null); } }, 'nur ' + speciesName(pinned, lang)) : null,
                        h('span', { className: 'ml-auto text-xs tabular-nums text-slate-500' }, filtered.length + ' von ' + rows.length))),

                map.status === 'announced'
                    ? h('div', { className: 'mt-6 rounded-3xl border border-white/10 bg-white/[.03] p-10 text-center text-slate-400' },
                        h('div', { className: 'text-4xl' }, '◌'),
                        h('h2', { className: 'mt-3 text-xl font-bold text-white' }, 'Noch keine belastbaren Guide-Daten'),
                        h('p', { className: 'mt-2' }, 'Italy DLC ist auf Steam angekündigt, aber ohne veröffentlichten Termin und ohne spielbare Spotdaten.'))
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
                                'Keine Treffer. Filter zurücksetzen oder einen kleineren Suchbegriff verwenden.')
                            : null),

                h('section', { className: 'mt-8 rounded-3xl border border-white/10 bg-white/[.025] p-6 text-sm leading-7 text-slate-400' },
                    h('h2', { className: 'text-lg font-bold text-white' }, 'Hakenwahl und leere Spots'),
                    h('p', { className: 'mt-2' },
                        'Die Hakenangaben sind Community-Bereiche und oft auf große Exemplare ausgelegt. Meldet das Spiel „Haken zu groß“, ' +
                        'beginne zwei bis vier Stufen kleiner – die Längen- und Gewichtsspanne im Spieldaten-Block ist dafür der beste Anhaltspunkt. ' +
                        'Vergrößere erst, nachdem du die Zielart am Spot sicher gefangen hast. Bei Naturködern erhöhen drei Köderstücke den Anziehungsradius; ' +
                        'bei Kunstködern zählen Geschwindigkeit und Rollenübersetzung zusammen.')),

                h('footer', { className: 'py-10 text-center text-xs text-slate-600' },
                    'UFS Atlas · Guide-Stand ' + D.generated + ' · Spieldaten ' + (G.generated || '–') +
                    ' · Fan-Projekt, nicht offiziell mit den Entwicklern verbunden.')))),

        sourceOpen ? h(Sources, { onClose: function () { setSourceOpen(false); } }) : null,
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
