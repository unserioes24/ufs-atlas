/* UFS Atlas – Ultimate Fishing Simulator Guide
 *
 * Zwei Datenquellen:
 *   window.UFS_DATA  – recherchierter Community-Guide (data.json)
 *   window.UFS_GAME  – direkt aus den Spieldateien extrahiert (gamedata.js)
 *
 * Bewusst ohne Build-Schritt: React kommt als UMD-Bundle, diese Datei ist die
 * lesbare Quelle. h() ist React.createElement.
 */

const { useEffect, useMemo, useRef, useState } = React;
const h = React.createElement;

const D = window.UFS_DATA;
const G = window.UFS_GAME || { species: {}, fisheries: {}, glossary: {} };
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
function fishImage(key) { return 'fish/' + String(key).toLowerCase() + '.jpg'; }

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

/* ------------------------------------------------- Spielstand (Easy Save 2) */

/* Typkennungen von Easy Save 2, wie sie in PROFILE_x direkt hinter dem 0xFF stehen. */
const ES2_INT = 0xE2A80856, ES2_FLOAT = 0x6E3ED76B, ES2_STRING = 0xFDE9F1EE, ES2_BOOL = 0xAD4D7C9C;

/**
 * Liest ein PROFILE_x aus %AppData%\LocalLow\PlayWay\UltimateFishing.
 * Satzformat: '~' + Schlüssellänge + Schlüssel + int32 Blocklänge + 0xFF + Typ-Hash + Wert.
 * Es wird jede Byteposition geprüft, damit ein unbekannter Datentyp den Rest
 * des Durchlaufs nicht verschiebt.
 */
function parseProfile(buffer) {
    const u8 = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    const out = {};
    const dec = new TextDecoder('utf-8');
    for (let i = 0; i + 8 < u8.length; i++) {
        if (u8[i] !== 0x7E) continue;
        const kl = u8[i + 1];
        if (kl < 3 || kl > 64 || i + 2 + kl + 5 > u8.length) continue;
        let ok = true, key = '';
        for (let j = 0; j < kl; j++) {
            const c = u8[i + 2 + j];
            if (!((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 47)) { ok = false; break; }
            key += String.fromCharCode(c);
        }
        if (!ok) continue;
        let p = i + 2 + kl;
        const blob = dv.getInt32(p, true); p += 4;
        if (blob < 5 || blob > 65536 || p + blob > u8.length) continue;
        if (u8[p] !== 0xFF) continue;
        const type = dv.getUint32(p + 1, true);
        const vp = p + 5;
        if (type === ES2_INT && vp + 4 <= u8.length) out[key] = dv.getInt32(vp, true);
        else if (type === ES2_FLOAT && vp + 4 <= u8.length) out[key] = dv.getFloat32(vp, true);
        else if (type === ES2_BOOL && vp < u8.length) out[key] = u8[vp] !== 0;
        else if (type === ES2_STRING && vp < u8.length) {
            const sl = u8[vp];
            if (sl < 128 && vp + 1 + sl <= u8.length) out[key] = dec.decode(u8.subarray(vp + 1, vp + 1 + sl));
        }
    }
    return out;
}

/**
 * Manche Arten werden je Modellvariante getrennt gezählt (BROWN_TROUT und
 * BROWN_TROUT_B). Auf den Basisschlüssel zusammenführen, sofern es ihn gibt –
 * Arten wie TIGER_SHARK_D heißen aber wirklich so und bleiben unangetastet.
 */
function normSpeciesKey(k) {
    if (SPECIES[k]) return k;
    const m = /^(.*)_[A-Z]{1,2}$/.exec(k);
    if (m && SPECIES[m[1]]) return m[1];
    return k;
}

/** Wandelt rohe Profilwerte in Fangstatus, Rekorde und Statistik um. */
function profileToCatches(raw) {
    const caught = {}, bests = {};
    Object.keys(raw).forEach(function (k) {
        const m = /^([A-Z0-9_]+)_caughtCount$/.exec(k);
        if (!m) return;
        const n = raw[m[1] + '_caughtCount'] | 0;
        if (n <= 0) return;
        const key = normSpeciesKey(m[1]);
        const w = raw[m[1] + '_weight'], l = raw[m[1] + '_length'], f = raw[m[1] + '_fishery'];
        const sum = raw[m[1] + '_caughtWeightSum'];
        caught[key] = true;
        const b = bests[key] || (bests[key] = { count: 0, weight: null, length: null, fishery: null, sum: 0 });
        b.count += n;
        if (typeof sum === 'number') b.sum += sum;
        if (typeof w === 'number' && (b.weight === null || w > b.weight)) {
            b.weight = w;
            b.length = typeof l === 'number' ? l : b.length;
            b.fishery = typeof f === 'string' && f ? f : b.fishery;
        }
    });

    // Revierstatistik: LEVELS/<X>_NAME[_WINTER]_Stats_*
    const fisheries = {};
    Object.keys(FISHERIES).forEach(function (id) {
        const pre = FISHERIES[id].save;
        if (!pre) return;
        const g = function (n) { const v = raw[pre + '_Stats_' + n]; return typeof v === 'number' ? v : 0; };
        const st = {
            fish: g('fishCaught'), bites: g('bitesAmount'), score: g('score'),
            time: g('timeSpent'), weight: g('weightSum'),
            bigW: g('biggestWeight'), bigL: g('biggestLength'),
            entries: typeof raw[pre + '_availableEntries'] === 'number' ? raw[pre + '_availableEntries'] : null
        };
        if (st.fish || st.bites || st.time || st.weight) fisheries[id] = st;
    });

    // Die fünf Rutensets: Set 1 ohne Index, Sets 2–5 mit Index im Schlüssel
    const SLOTS = [
        ['ROD', 'Rute'], ['ICE_ROD', 'Eisrute'], ['REEL', 'Rolle'], ['LINE', 'Schnur'],
        ['FLOAT', 'Pose'], ['HOOK', 'Haken'], ['BOILIE', 'Boilie'], ['FEEDER', 'Feeder'],
        ['FEEDER_BAIT', 'Feederköder'], ['ROD_STAND', 'Ständer'], ['BITE_INDICATOR', 'Bissanzeiger']
    ];
    const sets = [];
    for (let n = 1; n <= 5; n++) {
        const eq = n === 1 ? 'currentEquipment_' : 'currentEquipment_' + n + '_';
        const bt = n === 1 ? 'currentBaits_' : 'currentBaits_' + n + '_';
        const sfx = n === 1 ? '' : n + '_';
        const parts = [];
        SLOTS.forEach(function (s) {
            const v = raw[eq + s[0]];
            if (typeof v === 'string' && v) parts.push({ slot: s[1], id: v });
        });
        const baits = [];
        for (let i = 0; i < 3; i++) {
            const v = raw[bt + i];
            if (typeof v === 'string' && v) baits.push(v);
        }
        if (!parts.length && !baits.length) continue;
        sets.push({
            n: n, parts: parts, baits: baits,
            depth: raw['currentFloatDepth' + sfx],
            weight: raw['currentFloatWeight' + sfx],
            hookSize: raw['currentHookSize' + sfx]
        });
    }

    // Besitz je Kategorie aus den <ITEM>_isBought-Schlüsseln
    const owned = {};
    Object.keys(raw).forEach(function (k) {
        const m = /^([A-Z][A-Z0-9_]+)_isBought$/.exec(k);
        if (!m || raw[k] !== true) return;
        const cat = /^(ICE_ROD|ROD_STAND|FEEDER_BAIT|BITE_INDICATOR|[A-Z]+)/.exec(m[1]);
        const c = cat ? cat[1] : 'SONST';
        owned[c] = (owned[c] || 0) + 1;
    });

    const player = {
        sets: sets,
        owned: owned,
        name: raw.playerName || null,
        level: raw.playersLevel || 0,
        score: raw.playersScore || 0,
        money: raw.playersMoney || 0,
        exp: raw.playersExperience || 0,
        luck: raw.playersLuck || 0,
        strength: raw.playersStrength || 0,
        version: raw.gameVersion || null
    };
    return {
        caught: caught, bests: bests, fisheries: fisheries, player: player,
        total: Object.keys(caught).length
    };
}

function fisheryLabel(loc) {
    if (!loc) return null;
    const m = /^LEVELS\/(.+)_NAME$/.exec(loc);
    if (!m) return loc;
    return m[1].replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
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
        source: '↗', filter: '≡', info: 'i', print: '▣', close: '×', check: '✓', import: '↧', game: '▤'
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
function BaitTop(props) {
    const list = BAITS_FOR[props.speciesKey] || [];
    const [all, setAll] = useState(false);
    if (!list.length) return null;
    const limit = all ? list.length : (props.limit || 8);
    const shown = list.slice(0, limit);
    return h('div', { className: 'ufs-baitlist' },
        shown.map(function (e) {
            return h('div', { key: e.bait.key, className: 'row' },
                h('span', { className: 'nm' }, baitName(e.bait, props.lang)),
                h('span', { className: cn('kd', e.bait.kind) }, BAIT_KIND[e.bait.kind] || e.bait.kind),
                h('span', { className: 'bar' }, h('span', { style: { width: Math.round(e.v * 100) + '%' } })),
                h('span', { className: 'vl' }, Math.round(e.v * 100) + ' %'));
        }),
        list.length > limit || all
            ? h('button', {
                className: 'ufs-chip ufs-chip-btn', style: { marginTop: '.4rem' },
                onClick: function (ev) { ev.stopPropagation(); setAll(!all); }
            }, all ? 'weniger' : 'alle ' + list.length + ' Köder')
            : null);
}

/** Wetterregler: die drei Kurven, die das Spiel je Art tatsächlich füllt. */
const BITE_LABEL = { wind: 'Wind', cloudiness: 'Bewölkung', rain: 'Regen' };
const BITE_HINT = {
    wind: 'windstill → stürmisch', cloudiness: 'klar → bedeckt', rain: 'trocken → Dauerregen'
};

function BiteFactors(props) {
    const b = props.bite;
    if (!b) return null;
    const keys = ['wind', 'cloudiness', 'rain'].filter(function (k) { return b[k] && b[k].length; });
    if (!keys.length) return null;
    return h('div', { className: 'ufs-bite' },
        keys.map(function (k) {
            const c = b[k];
            const from = c[0][1], to = c[c.length - 1][1];
            const better = to > from;
            return h('div', { key: k, className: 'row' },
                h('span', { className: 'nm' }, BITE_LABEL[k]),
                h('span', { className: 'hint' }, BITE_HINT[k]),
                h('span', { className: 'bar' },
                    h('span', {
                        className: better ? 'up' : 'down',
                        style: { width: Math.round(Math.min(1, to) * 100) + '%' }
                    })),
                h('span', { className: cn('vl', better && 'up') },
                    Math.round(from * 100) + ' → ' + Math.round(to * 100) + ' %'));
        }));
}

/* -------------------------------------------------------- Aktivitätskurve */

function Activity(props) {
    const pts = props.act;
    if (!pts || pts.length < 2) return null;
    const W = 100, H = 30;
    const xy = pts.map(function (p) { return [p[0] / 24 * W, H - p[1] * (H - 3) - 1.5]; });
    const line = xy.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    const area = line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';
    let top = 0;
    pts.forEach(function (p) { if (p[1] > top) top = p[1]; });
    const peaks = pts.filter(function (p) { return p[1] >= top - 0.01 && p[0] < 24; })
        .map(function (p) { return p[0] + ':00'; });
    return h('div', null,
        h('svg', { className: 'ufs-act', viewBox: '0 0 100 30', preserveAspectRatio: 'none' },
            [6, 12, 18].map(function (t) {
                return h('line', { key: t, className: 'grid', x1: t / 24 * W, y1: 0, x2: t / 24 * W, y2: H });
            }),
            h('path', { className: 'area', d: area }),
            h('path', { className: 'line', d: line })),
        h('div', { className: 'ufs-actlabels' },
            h('span', null, '0'), h('span', null, '6'), h('span', null, '12'), h('span', null, '18'), h('span', null, '24 Uhr')),
        peaks.length ? h('div', { className: 'ufs-stats', style: { marginTop: '.35rem' } },
            h('span', null, 'Beste Beißzeit: ', h('b', null, peaks.join(', ')))) : null);
}

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
    const f = props.f, lang = props.lang, key = props.speciesKey;
    const sp = key ? SPECIES[key] : null;
    const gm = props.gameEntry;
    const best = key ? props.bests[key] : null;
    const done = key ? !!props.caught[key] : false;
    const [imgOk, setImgOk] = useState(true);
    const [show3d, setShow3d] = useState(false);

    const spots = gm && gm.spots && gm.spots.length ? gm.spots : null;

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
            h(Fact, { icon: 'hook', label: 'Haken', value: f.hook }),
            h(Fact, { icon: 'depth', label: 'Ködertiefe', value: f.depth }),
            h(Fact, { icon: 'method', label: 'Methode', value: lang === 'de' ? toGerman(f.method) : f.method })),

        h('div', { className: cn('grid gap-4 p-5 lg:p-6', props.compact ? '' : 'lg:grid-cols-2') },
            h(Detail, { title: 'Köder', value: lang === 'de' ? toGerman(f.bait) : f.bait }),
            h(Detail, { title: 'Grundfutter / Anfütterung', value: lang === 'de' ? toGerman(f.groundbait) : f.groundbait }),
            h(Detail, { title: 'Führung', value: lang === 'de' ? toGerman(f.retrieve) : f.retrieve }),
            h(Detail, { title: 'Zeit / Sicht', value: f.time }),

            sp ? h('div', { className: cn('ufs-gamebox', props.compact ? '' : 'lg:col-span-2') },
                h('div', { className: 'hd' }, 'Aus den Spieldateien'),
                key && MODELS[key]
                    ? h('div', { style: { marginBottom: '.7rem' } },
                        show3d
                            ? h(FishModel, { speciesKey: key })
                            : h('button', {
                                className: 'ufs-btn', style: { width: '100%', justifyContent: 'center' },
                                onClick: function () { setShow3d(true); }
                            }, '◈ 3D-Modell aus dem Spiel anzeigen'))
                    : (key && imgOk ? h('figure', { style: { margin: '0 0 .7rem' } },
                        h('img', {
                            className: 'ufs-fishimg', src: fishImage(key), loading: 'lazy',
                            alt: 'Spieltextur ' + speciesName(key, 'de'),
                            onError: function () { setImgOk(false); }
                        }),
                        h('figcaption', { style: { fontSize: '10px', color: '#64748b', marginTop: '.25rem' } },
                            'Modelltextur aus dem Spiel')) : null),
                h('div', { className: 'ufs-stats' },
                    sp.wMax ? h('span', null, 'Gewicht: ', h('b', null, sp.wMin + '–' + sp.wMax + ' kg')) : null,
                    sp.lMax ? h('span', null, 'Länge: ', h('b', null, sp.lMin + '–' + sp.lMax + ' cm')) : null,
                    gm && gm.points ? h('span', null, 'Schwarmpunkte hier: ', h('b', null, gm.points)) : null,
                    gm && gm.fish ? h('span', null, 'Fische hier: ', h('b', null, gm.fish)) : null,
                    gm && gm.dlc ? h('span', null, h('b', null, 'DLC-Art'), ' – ohne feste Spawnpunkte in der Szene') : null),
                sp.act ? h('div', { style: { marginTop: '.6rem' } }, h(Activity, { act: sp.act })) : null,
                key && (BAITS_FOR[key] || []).length
                    ? h('div', { style: { marginTop: '.7rem' } },
                        h('div', { className: 'hd' }, 'Köder, Interesse laut Prefab'),
                        h(BaitTop, { speciesKey: key, lang: lang }))
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

/* --------------------------------------------------------- 3D-Fischmodell */

const MODELS = {};
(window.UFS_MODELS || []).forEach(function (k) { MODELS[k] = true; });

/** Lädt models/<key>.js per <script>-Tag (fetch ist unter file:// gesperrt). */
function loadMesh(key, cb) {
    window.UFS_MESH = window.UFS_MESH || {};
    if (window.UFS_MESH[key]) { cb(window.UFS_MESH[key]); return; }
    const s = document.createElement('script');
    s.src = 'models/' + key + '.js';
    s.onload = function () { cb(window.UFS_MESH[key] || null); };
    s.onerror = function () { cb(null); };
    document.head.appendChild(s);
}
function meshBlob(entry) { return typeof entry === 'string' ? entry : (entry && entry.m); }
function meshTexture(entry) { return (entry && typeof entry === 'object') ? entry.t : null; }

/** Entpackt das UFSM-Format zu Float32-Attributen inklusive berechneter Normalen. */
function decodeMesh(b64) {
    const bin = atob(b64);
    const buf = new ArrayBuffer(bin.length);
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const dv = new DataView(buf);
    if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'UFSM') return null;
    const vCount = dv.getUint16(6, true);
    const iCount = dv.getUint32(8, true);
    const minX = dv.getFloat32(12, true), minY = dv.getFloat32(16, true), minZ = dv.getFloat32(20, true);
    const sx = dv.getFloat32(24, true), sy = dv.getFloat32(28, true), sz = dv.getFloat32(32, true);
    let p = 36;
    const pos = new Float32Array(vCount * 3);
    for (let v = 0; v < vCount; v++) {
        pos[v * 3] = minX + (dv.getInt16(p, true) + 16000) / 32000 * sx; p += 2;
        pos[v * 3 + 1] = minY + (dv.getInt16(p, true) + 16000) / 32000 * sy; p += 2;
        pos[v * 3 + 2] = minZ + (dv.getInt16(p, true) + 16000) / 32000 * sz; p += 2;
    }
    const uv = new Float32Array(vCount * 2);
    for (let v = 0; v < vCount; v++) {
        uv[v * 2] = dv.getUint16(p, true) / 65535; p += 2;
        uv[v * 2 + 1] = 1 - dv.getUint16(p, true) / 65535; p += 2;
    }
    const idx = new Uint16Array(iCount);
    for (let i = 0; i < iCount; i++) { idx[i] = dv.getUint16(p, true); p += 2; }

    // Normalen aus den Dreiecken mitteln – im Export sind keine enthalten.
    const nrm = new Float32Array(vCount * 3);
    for (let i = 0; i + 2 < iCount; i += 3) {
        const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
        const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz;
        nrm[b] += nx; nrm[b + 1] += ny; nrm[b + 2] += nz;
        nrm[c] += nx; nrm[c + 1] += ny; nrm[c + 2] += nz;
    }
    for (let v = 0; v < vCount; v++) {
        const o = v * 3;
        const l = Math.sqrt(nrm[o] * nrm[o] + nrm[o + 1] * nrm[o + 1] + nrm[o + 2] * nrm[o + 2]) || 1;
        nrm[o] /= l; nrm[o + 1] /= l; nrm[o + 2] /= l;
    }

    // Zentrum und Radius für die Kamera
    let cx = 0, cy = 0, cz = 0;
    for (let v = 0; v < vCount; v++) { cx += pos[v * 3]; cy += pos[v * 3 + 1]; cz += pos[v * 3 + 2]; }
    cx /= vCount; cy /= vCount; cz /= vCount;
    let rad = 0;
    for (let v = 0; v < vCount; v++) {
        const dx = pos[v * 3] - cx, dy = pos[v * 3 + 1] - cy, dz = pos[v * 3 + 2] - cz;
        const d = dx * dx + dy * dy + dz * dz;
        if (d > rad) rad = d;
    }
    rad = Math.sqrt(rad) || 1;
    return { pos: pos, uv: uv, nrm: nrm, idx: idx, count: iCount, center: [cx, cy, cz], radius: rad };
}

const VS = [
    'attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aUv;',
    'uniform mat4 uMvp; uniform mat4 uModel;',
    'varying vec2 vUv; varying vec3 vNrm;',
    'void main(){ vUv=aUv; vNrm=mat3(uModel)*aNrm; gl_Position=uMvp*vec4(aPos,1.0); }'
].join('\n');
const FS = [
    'precision mediump float;',
    'uniform sampler2D uTex; uniform float uHasTex;',
    'varying vec2 vUv; varying vec3 vNrm;',
    'void main(){',
    '  vec3 n=normalize(vNrm);',
    '  float d=max(dot(n,normalize(vec3(0.4,0.8,0.6))),0.0)*0.65+0.45;',
    '  float rim=pow(1.0-max(dot(n,vec3(0.0,0.0,1.0)),0.0),2.0)*0.25;',
    '  vec3 base = uHasTex>0.5 ? texture2D(uTex,vUv).rgb : vec3(0.55,0.68,0.75);',
    '  gl_FragColor=vec4(base*d + vec3(0.35,0.75,0.85)*rim, 1.0);',
    '}'
].join('\n');

function mul(a, b) {
    const o = new Float32Array(16);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
}

function FishModel(props) {
    const key = props.speciesKey;
    const canvasRef = useRef(null);
    const stateRef = useRef({ yaw: 0.6, pitch: 0.15, drag: false, auto: true });
    const [status, setStatus] = useState('load');

    useEffect(function () {
        let raf = 0, gl = null, disposed = false;
        const cv = canvasRef.current;
        if (!cv) return;

        loadMesh(key, function (entry) {
            if (disposed) return;
            const b64 = meshBlob(entry);
            if (!b64) { setStatus('none'); return; }
            const texUri = meshTexture(entry);
            const mesh = decodeMesh(b64);
            if (!mesh) { setStatus('none'); return; }
            gl = cv.getContext('webgl', { antialias: true, alpha: false });
            if (!gl) { setStatus('nogl'); return; }
            setStatus('ok');

            function sh(type, src) {
                const s = gl.createShader(type);
                gl.shaderSource(s, src); gl.compileShader(s);
                return s;
            }
            const prog = gl.createProgram();
            gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
            gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
            gl.linkProgram(prog);
            gl.useProgram(prog);

            function buf(data, size, name) {
                const b = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, b);
                gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
                const loc = gl.getAttribLocation(prog, name);
                gl.enableVertexAttribArray(loc);
                gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
            }
            buf(mesh.pos, 3, 'aPos');
            buf(mesh.nrm, 3, 'aNrm');
            buf(mesh.uv, 2, 'aUv');
            const ib = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);

            const uMvp = gl.getUniformLocation(prog, 'uMvp');
            const uModel = gl.getUniformLocation(prog, 'uModel');
            const uHasTex = gl.getUniformLocation(prog, 'uHasTex');
            gl.uniform1f(uHasTex, 0);

            if (texUri) {
                const tex = gl.createTexture();
                const img = new Image();
                img.onload = function () {
                    if (disposed) return;
                    try {
                        gl.bindTexture(gl.TEXTURE_2D, tex);
                        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                        gl.useProgram(prog);
                        gl.uniform1f(uHasTex, 1);
                    } catch (e) { /* ohne Textur weiterzeichnen */ }
                };
                img.src = texUri;
            }

            gl.enable(gl.DEPTH_TEST);
            gl.clearColor(0.024, 0.055, 0.078, 1);

            function frame() {
                if (disposed) return;
                const st = stateRef.current;
                if (st.auto && !st.drag) st.yaw += 0.006;
                const w = cv.clientWidth, hgt = cv.clientHeight;
                if (cv.width !== w || cv.height !== hgt) { cv.width = w; cv.height = hgt; }
                gl.viewport(0, 0, cv.width, cv.height);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

                const asp = cv.width / Math.max(1, cv.height);
                const f = 1 / Math.tan(0.5 * 0.9);
                const near = mesh.radius * 0.05, far = mesh.radius * 12;
                const proj = new Float32Array([
                    f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1,
                    0, 0, 2 * far * near / (near - far), 0]);
                const cy = Math.cos(st.yaw), sy2 = Math.sin(st.yaw);
                const cp = Math.cos(st.pitch), sp2 = Math.sin(st.pitch);
                const model = new Float32Array([
                    cy, sy2 * sp2, -sy2 * cp, 0,
                    0, cp, sp2, 0,
                    sy2, -cy * sp2, cy * cp, 0,
                    0, 0, 0, 1]);
                const dist = mesh.radius * 1.95;
                const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
                    -(model[0] * mesh.center[0] + model[4] * mesh.center[1] + model[8] * mesh.center[2]),
                    -(model[1] * mesh.center[0] + model[5] * mesh.center[1] + model[9] * mesh.center[2]),
                    -(model[2] * mesh.center[0] + model[6] * mesh.center[1] + model[10] * mesh.center[2]) - dist, 1]);
                gl.uniformMatrix4fv(uModel, false, model);
                gl.uniformMatrix4fv(uMvp, false, mul(proj, mul(view, model)));
                gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
                raf = requestAnimationFrame(frame);
            }
            frame();
        });

        function down(e) { stateRef.current.drag = true; stateRef.current.lx = e.clientX; stateRef.current.ly = e.clientY; }
        function move(e) {
            const st = stateRef.current;
            if (!st.drag) return;
            st.yaw += (e.clientX - st.lx) * 0.01;
            st.pitch = Math.max(-1.3, Math.min(1.3, st.pitch + (e.clientY - st.ly) * 0.01));
            st.lx = e.clientX; st.ly = e.clientY;
        }
        function up() { stateRef.current.drag = false; }
        cv.addEventListener('mousedown', down);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);

        return function () {
            disposed = true;
            cancelAnimationFrame(raf);
            cv.removeEventListener('mousedown', down);
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
    }, [key]);

    return h('div', { className: 'ufs-model' },
        h('canvas', { ref: canvasRef, className: 'ufs-canvas' }),
        status === 'load' ? h('div', { className: 'ufs-model-msg' }, 'Modell wird geladen …') : null,
        status === 'none' ? h('div', { className: 'ufs-model-msg' }, 'Für diese Art liegt kein Modell vor.') : null,
        status === 'nogl' ? h('div', { className: 'ufs-model-msg' }, 'WebGL ist im Browser nicht verfügbar.') : null,
        status === 'ok' ? h('div', { className: 'ufs-model-hint' }, 'ziehen zum Drehen') : null);
}

/* -------------------------------------------------------------- Köderseite */

const BAIT_GROUPS = [
    { kind: 'natural', title: 'Naturköder', note: 'Werden am Haken angeboten, mehrere Stücke vergrößern den Anziehungsradius.' },
    { kind: 'boilie', title: 'Boilies', note: 'Für Karpfen und Großfisch, an der Haarmontage.' },
    { kind: 'fly', title: 'Fliegen', note: 'Vier Typen, unterschiedlich tief geführt.' },
    { kind: 'lure', title: 'Kunstköder', note: 'Werden aktiv geführt; die Führungsart entscheidet mit über den Biss.' }
];

function BaitPage(props) {
    const [open, setOpen] = useState(null);
    const [q, setQ] = useState('');
    const [onlySpecies, setOnlySpecies] = useState(null);
    const lang = props.lang;

    const list = useMemo(function () {
        const all = Object.keys(BAITS).map(function (k) { return BAITS[k]; });
        return all.filter(function (b) {
            if (onlySpecies && !b.fish[onlySpecies]) return false;
            if (!q) return true;
            const needle = q.toLowerCase();
            if ((b.de + ' ' + b.en).toLowerCase().indexOf(needle) >= 0) return true;
            // auch nach Fischnamen suchen: „Karpfen“ findet alle Karpfenköder
            return Object.keys(b.fish).some(function (s) {
                return speciesName(s, lang).toLowerCase().indexOf(needle) >= 0;
            });
        }).sort(function (a, b) {
            if (onlySpecies) return b.fish[onlySpecies] - a.fish[onlySpecies];
            return baitName(a, lang).localeCompare(baitName(b, lang));
        });
    }, [q, onlySpecies, lang]);

    if (!Object.keys(BAITS).length) {
        return h('div', { className: 'ufs-note' },
            'Keine Köderdaten geladen. Die Tabelle entsteht beim Auslesen der Spieldateien.');
    }

    function card(b) {
        const isOpen = open === b.key;
        const entries = Object.keys(b.fish)
            .map(function (s) { return { s: s, v: b.fish[s] }; })
            .sort(function (x, y) { return y.v - x.v; });
        const top = entries.slice(0, 3).map(function (e) { return speciesName(e.s, lang); }).join(', ');
        return h('div', {
            key: b.key,
            className: cn('ufs-baitcard has', isOpen && 'open'),
            onClick: function () { setOpen(isOpen ? null : b.key); }
        },
            h('div', { className: 'de' }, baitName(b, lang)),
            h('div', { className: 'en' }, lang === 'en' ? b.de : b.en),
            h('div', { className: 'cnt' },
                entries.length + ' Arten' + (top ? ' · am stärksten: ' + top : '')),
            isOpen
                ? h('div', { className: 'list', style: { gridTemplateColumns: '1fr' } },
                    h('div', { className: 'ufs-baitlist' }, entries.map(function (e) {
                        return h('div', { key: e.s, className: 'row' },
                            h('span', { className: 'nm' }, speciesName(e.s, lang)),
                            h('span', { className: 'bar' }, h('span', { style: { width: Math.round(e.v * 100) + '%' } })),
                            h('span', { className: 'vl' }, Math.round(e.v * 100) + ' %'));
                    })))
                : null);
    }

    return h('div', null,
        h('div', { className: 'ufs-note ok', style: { marginBottom: '1rem' } },
            'Jedes Köder-Prefab im Spiel führt eine Liste, wie stark sich welche Art für ihn interessiert – ',
            'ein Wert zwischen 0 und 100 %. Diese Tabellen stehen hier unverändert. ',
            'Sie sagen nichts über Hakengröße und Führung; das bleiben Erfahrungswerte.'),

        h('div', { className: 'ufs-row', style: { marginBottom: '.9rem' } },
            h('input', {
                value: q, onChange: function (e) { setQ(e.target.value); },
                placeholder: 'Köder oder Fisch suchen …',
                className: 'rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50',
                style: { minWidth: '240px' }
            }),
            onlySpecies
                ? h(Toggle, { active: true, onClick: function () { setOnlySpecies(null); } },
                    'nur für ' + speciesName(onlySpecies, lang))
                : null,
            h('span', { className: 'ufs-muted', style: { fontSize: '11.5px' } },
                list.length + ' von ' + Object.keys(BAITS).length + ' Ködern')),

        BAIT_GROUPS.map(function (g) {
            const items = list.filter(function (b) { return b.kind === g.kind; });
            if (!items.length) return null;
            return h('section', { key: g.kind, className: 'ufs-spotcard', style: { marginBottom: '1rem' } },
                h('h3', null, g.title + ' · ' + items.length),
                h('p', { className: 'ufs-muted', style: { fontSize: '11.5px', margin: '0 0 .7rem', lineHeight: 1.55 } }, g.note),
                h('div', { className: 'ufs-baitgrid' }, items.map(card)));
        }),

        h('section', { className: 'ufs-spotcard' },
            h('h3', null, 'Was der Biss sonst noch braucht'),
            h('p', { className: 'ufs-muted', style: { fontSize: '12px', lineHeight: 1.65, margin: '.2rem 0 0' } },
                'Neben dem Köder gewichtet das Spiel neun Regler, jeder mit einer eigenen Kurve je Art: ',
                'Uhrzeit, Hunger, Ködertiefe, Temperatur, Wind, Luftdruck, Bewölkung, Regen und Ködergeschwindigkeit. ',
                'Gefüllt sind davon nur vier – Uhrzeit, Wind, Bewölkung und Regen. Die übrigen fünf stehen bei allen ',
                '134 Arten auf der Konstanten 1 und wirken damit nicht. ',
                h('b', { style: { color: '#cbd5e1' } }, 'Insbesondere die Ködertiefe: '),
                'sie entscheidet nicht darüber, ob ein Fisch beißt, sondern nur darüber, ob der Köder dort ankommt, ',
                'wo der Schwarm steht. Tiefenangaben in Guides sind also Beobachtungen über den Standort der Fische, ',
                'keine Vorliebe.')));
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
    const sets = props.sets || [];
    if (!sets.length) return null;
    return h('div', { className: 'ufs-setgrid' }, sets.map(function (s) {
        return h('div', { key: s.n, className: 'ufs-setcard' },
            h('div', { className: 'hd' }, 'Set ' + s.n),
            h('div', { className: 'rows' },
                s.parts.map(function (p) {
                    return h('div', { key: p.slot },
                        h('span', null, p.slot), h('em', null, itemLabel(p.id)));
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

/* ------------------------------------------------------------- Artenseite */

/** Sammelt je Art die Guide-Angaben über alle Reviere hinweg. */
const SPECIES_GUIDE = (function () {
    const out = {};
    D.fish.forEach(function (f) {
        const k = speciesKey(f.name, f.de, f.mapId);
        if (!k) return;
        const e = out[k] = out[k] || { baits: {}, methods: {}, hooks: {}, maps: {}, retrieves: {}, depths: {} };
        String(f.bait || '').split(/[,;/]| oder /).forEach(function (b) {
            b = b.trim();
            if (b && b !== '—') e.baits[b] = (e.baits[b] || 0) + 1;
        });
        if (f.method) e.methods[f.method] = (e.methods[f.method] || 0) + 1;
        if (f.hook) e.hooks[f.hook] = (e.hooks[f.hook] || 0) + 1;
        if (f.retrieve && f.retrieve !== '—') e.retrieves[f.retrieve] = (e.retrieves[f.retrieve] || 0) + 1;
        if (f.depth) e.depths[f.depth] = (e.depths[f.depth] || 0) + 1;
        e.maps[f.mapId] = true;
    });
    return out;
})();

function topKeys(obj, n) {
    return Object.keys(obj || {}).sort(function (a, b) { return obj[b] - obj[a]; }).slice(0, n || 6);
}

function SpeciesPage(props) {
    // Direktlink auf eine Art: Suche vorbelegen, damit die Karte oben steht.
    const [q, setQ] = useState(function () {
        return props.initialOpen && SPECIES[props.initialOpen] ? speciesName(props.initialOpen, props.lang) : '';
    });
    const [open, setOpen] = useState(props.initialOpen || null);
    const [onlyOpenFish, setOnlyOpenFish] = useState(false);
    const mapName = {};
    D.maps.forEach(function (m) { mapName[m.id] = m.name; });

    const rows = useMemo(function () {
        const where = {};
        Object.keys(FISHERIES).forEach(function (id) {
            FISHERIES[id].species.forEach(function (g) { (where[g.s] = where[g.s] || []).push(id); });
        });
        const list = Object.keys(SPECIES).map(function (k) {
            return { key: k, sp: SPECIES[k], where: where[k] || [], guide: SPECIES_GUIDE[k] || null };
        }).filter(function (r) {
            if (!r.sp.wMax && !r.where.length && !r.guide) return false;
            if (onlyOpenFish && props.caught[r.key]) return false;
            if (q) {
                const hay = (r.key + ' ' + (r.sp.de || '') + ' ' + (r.sp.en || '')).toLowerCase();
                if (hay.indexOf(q.toLowerCase()) < 0) return false;
            }
            return true;
        });
        list.sort(function (a, b) { return speciesName(a.key, props.lang).localeCompare(speciesName(b.key, props.lang)); });
        return list;
    }, [q, onlyOpenFish, props.caught, props.lang]);

    return h('div', null,
        h('div', { className: 'ufs-row', style: { marginBottom: '.9rem' } },
            h('input', {
                value: q, onChange: function (e) { setQ(e.target.value); },
                placeholder: 'Art suchen …',
                className: 'rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50',
                style: { minWidth: '220px' }
            }),
            h(Toggle, { active: onlyOpenFish, onClick: function () { setOnlyOpenFish(!onlyOpenFish); } }, 'nur fehlende'),
            h('span', { className: 'ufs-muted', style: { fontSize: '11.5px' } }, rows.length + ' Arten')),

        h('div', { className: 'ufs-baitgrid' }, rows.map(function (r) {
            const s = r.sp, g = r.guide;
            const isOpen = open === r.key;
            return h('div', {
                key: r.key,
                className: cn('ufs-baitcard has', isOpen && 'open'),
                onClick: function (e) {
                    if (e.target.tagName === 'CANVAS') return;
                    const nk = isOpen ? null : r.key;
                    setOpen(nk);
                    if (props.onOpen) props.onOpen(nk);
                }
            },
                h('div', { className: 'de' },
                    (props.caught[r.key] ? '✓ ' : '') + speciesName(r.key, props.lang)),
                h('div', { className: 'en' }, props.lang === 'en' ? (s.de || '') : (s.en || '')),
                h('div', { className: 'cnt' },
                    (s.wMax ? s.wMin + '–' + s.wMax + ' kg' : 'ohne Größenangabe') +
                    (s.lMax ? ' · ' + s.lMin + '–' + s.lMax + ' cm' : '')),
                isOpen ? h('div', { className: 'list', style: { gridTemplateColumns: '1fr' } },
                    MODELS[r.key] ? h('div', { style: { margin: '.2rem 0 .6rem' } }, h(FishModel, { speciesKey: r.key })) : null,
                    h('div', null, h('span', null, 'Reviere'), h('em', null,
                        r.where.length ? r.where.map(function (w) { return mapName[w] || w; }).join(', ') : 'keine Spawnpunkte')),
                    g && Object.keys(g.baits).length
                        ? h('div', null, h('span', null, 'Köder'), h('em', null,
                            topKeys(g.baits, 6).map(function (b) { return props.lang === 'de' ? toGerman(b) : b; }).join(', '))) : null,
                    g && Object.keys(g.methods).length
                        ? h('div', null, h('span', null, 'Methode'), h('em', null, topKeys(g.methods, 3).join(' · '))) : null,
                    g && Object.keys(g.hooks).length
                        ? h('div', null, h('span', null, 'Haken'), h('em', null, topKeys(g.hooks, 3).join(' · '))) : null,
                    g && Object.keys(g.retrieves).length
                        ? h('div', null, h('span', null, 'Führung'), h('em', null,
                            topKeys(g.retrieves, 2).map(function (b) { return props.lang === 'de' ? toGerman(b) : b; }).join(' · '))) : null,
                    props.bests[r.key] && props.bests[r.key].weight
                        ? h('div', null, h('span', null, 'Dein Rekord'), h('em', null,
                            props.bests[r.key].weight.toFixed(2) + ' kg' +
                            (props.bests[r.key].length ? ' · ' + Math.round(props.bests[r.key].length * 100) + ' cm' : ''))) : null,
                    s.act ? h('div', { style: { display: 'block', marginTop: '.4rem' } }, h(Activity, { act: s.act })) : null,
                    (BAITS_FOR[r.key] || []).length
                        ? h('div', { style: { display: 'block', marginTop: '.5rem' } },
                            h('span', { style: { color: '#64748b' } }, 'Köder'),
                            h(BaitTop, { speciesKey: r.key, lang: props.lang, limit: 6 }))
                        : null,
                    s.bite
                        ? h('div', { style: { display: 'block', marginTop: '.5rem' } },
                            h('span', { style: { color: '#64748b' } }, 'Wetter'),
                            h(BiteFactors, { bite: s.bite }))
                        : null,
                    s.info ? h('div', { style: { display: 'block', marginTop: '.4rem', color: '#94a3b8', lineHeight: 1.55 } }, s.info) : null
                ) : null);
        })));
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
    return { caught: caught, bests: bests, stats: stats };
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
        api('/auth/verify', { method: 'POST', json: { email: email, code: code } })
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
        msg ? h('div', {
            className: 'ufs-note',
            style: msg.ok ? { borderColor: 'rgba(52,211,153,.3)', background: 'rgba(16,185,129,.08)', color: '#a7f3d0', marginTop: '.8rem' } : { marginTop: '.8rem' }
        }, msg.t) : null);
}

/* ---------------------------------------------------------- Gruppenansicht */

const BOARDS = [
    ['biggestFish', 'Schwerster Fisch', 'kg'],
    ['longestFish', 'Längster Fisch', 'cm'],
    ['totalWeight', 'Meiste Masse gesamt', 'kg'],
    ['topSpeciesWeight', 'Meiste Masse einer Art', 'kg'],
    ['species', 'Meiste Arten', ''],
    ['fisheriesComplete', 'Komplette Reviere', ''],
    ['fish', 'Meiste Fänge', ''],
    ['time', 'Meiste Angelzeit', 'h']
];

function boardValue(key, v) {
    if (key === 'longestFish') return Math.round(v * 100) + ' cm';
    if (key === 'time') return fmtTime(v);
    if (key === 'biggestFish' || key === 'totalWeight' || key === 'topSpeciesWeight') return fmtNum(v, 2) + ' kg';
    return fmtNum(v);
}

function GroupView(props) {
    const g = props.data;
    const names = (g.meta && g.meta.speciesNames) || {};
    return h('div', null,
        h('div', { className: 'ufs-row', style: { marginBottom: '.8rem' } },
            h('h3', { style: { margin: 0, fontSize: '15px', fontWeight: 800, color: '#e2e8f0' } }, g.group.name),
            h('span', { className: 'ufs-chip ufs-mono', title: 'Beitrittscode' }, 'Code ' + g.group.code),
            h('span', { className: 'ufs-muted', style: { fontSize: '11.5px' } }, g.members.length + ' Mitglieder'),
            h('button', { className: 'ufs-btn', onClick: props.onLeave }, 'Verlassen')),
        h('div', { className: 'ufs-boardgrid' }, BOARDS.map(function (b) {
            const rows = (g.boards[b[0]] || []).slice(0, 5);
            return h('div', { key: b[0], className: 'ufs-spotcard' },
                h('h3', null, b[1]),
                rows.length
                    ? h('div', { className: 'ufs-splist' }, rows.map(function (r, i) {
                        return h('div', { key: r.id, className: cn('ufs-spline', r.self && 'pin') },
                            h('span', { className: 'n' }, (i + 1) + '. ' + r.name),
                            h('span', { className: 'q' }, boardValue(b[0], r.value)),
                            h('span', { className: 'd' }, r.label ? (names[r.label] || r.label) : ''));
                    }))
                    : h('div', { className: 'ufs-muted', style: { fontSize: '12px' } }, 'Noch keine Daten'));
        })),
        h('div', { className: 'ufs-spotcard', style: { marginTop: '.9rem' } },
            h('h3', null, 'Mitglieder'),
            h('table', { className: 'ufs-rec' },
                h('thead', null, h('tr', null,
                    h('th', null, 'Angler'), h('th', null, 'Arten'), h('th', null, 'Reviere komplett'),
                    h('th', null, 'Fänge'), h('th', null, 'Masse'), h('th', null, 'Schwerster'), h('th', null, 'Stand'))),
                h('tbody', null, g.members.map(function (m) {
                    return h('tr', {
                        key: m.id, style: { cursor: 'pointer' },
                        onClick: function () { props.onOpenUser(m.id); }
                    },
                        h('td', { className: cn('n', m.self && 'done') }, (m.self ? '▸ ' : '') + m.name),
                        h('td', { className: 'num' }, fmtNum(m.species)),
                        h('td', { className: 'num' }, fmtNum(m.fisheriesComplete)),
                        h('td', { className: 'num' }, fmtNum(m.fish)),
                        h('td', { className: 'num' }, fmtNum(m.weight, 1) + ' kg'),
                        h('td', { className: 'num' }, m.bigW ? m.bigW.toFixed(2) + ' kg' : '–'),
                        h('td', { className: 'sub' }, m.updatedAt ? m.updatedAt.slice(0, 10) : 'kein Profil'));
                })))));
}

/** Fremdes Profil ansehen. */
function UserModal(props) {
    const [data, setData] = useState(null);
    const [err, setErr] = useState(null);
    useEffect(function () {
        api('/users/' + props.id).then(setData).catch(function (e) { setErr(e.message); });
    }, [props.id]);

    const p = data && data.profile;
    return h('div', {
        className: 'ufs-modal-bg',
        onMouseDown: function (e) { if (e.target === e.currentTarget) props.onClose(); }
    }, h('div', { className: 'ufs-modal', style: { maxWidth: '720px' } },
        h('div', { className: 'ufs-row', style: { justifyContent: 'space-between' } },
            h('h2', { style: { margin: 0 } }, data ? data.user.name : 'Profil'),
            h('button', { className: 'ufs-btn', onClick: props.onClose }, 'Schließen')),
        err ? h('div', { className: 'ufs-note', style: { marginTop: '.8rem' } }, err) : null,
        !data ? h('p', null, 'Wird geladen …') : null,
        data && !p ? h('p', null, 'Dieser Angler hat noch keinen Spielstand hochgeladen.') : null,
        p ? h('div', null,
            h('div', { className: 'ufs-statgrid', style: { marginTop: '.9rem' } },
                h(Stat, { label: 'Angler', value: p.anglerName || data.user.name, sub: 'Level ' + p.level }),
                h(Stat, { label: 'Arten', value: fmtNum(p.speciesCount), sub: 'von ' + data.meta.totalSpecies }),
                h(Stat, { label: 'Reviere komplett', value: fmtNum(p.fisheriesComplete), sub: 'von ' + data.meta.totalFisheries }),
                h(Stat, { label: 'Fänge', value: fmtNum(p.totals.fish), sub: fmtNum(p.totals.weight, 1) + ' kg' }),
                h(Stat, {
                    label: 'Schwerster', value: p.biggest.weight ? p.biggest.weight.toFixed(2) + ' kg' : '–',
                    sub: p.biggest.weightSpecies ? speciesName(p.biggest.weightSpecies, props.lang) : ''
                }),
                h(Stat, {
                    label: 'Längster', value: p.biggest.length ? Math.round(p.biggest.length * 100) + ' cm' : '–',
                    sub: p.biggest.lengthSpecies ? speciesName(p.biggest.lengthSpecies, props.lang) : ''
                })),
            h('div', { className: 'ufs-row', style: { marginTop: '.9rem' } },
                h('button', {
                    className: cn('ufs-btn', data.following && 'primary'),
                    onClick: function () {
                        const m = data.following ? 'DELETE' : 'POST';
                        api('/follow/' + props.id, { method: m })
                            .then(function () { setData(Object.assign({}, data, { following: !data.following })); });
                    }
                }, data.following ? '✓ Du folgst' : 'Folgen')),
            h('p', { className: 'ufs-muted', style: { fontSize: '11.5px', marginTop: '.7rem' } },
                'Stand: ' + (p.updatedAt ? p.updatedAt.slice(0, 10) : 'unbekannt'))) : null));
}

/* ------------------------------------------------------- Community-Seite */

function CommunityPage(props) {
    const me = props.me;
    const [tab, setTab] = useState('gruppen');
    const [groups, setGroups] = useState([]);
    const [openGroup, setOpenGroup] = useState(null);
    const [groupData, setGroupData] = useState(null);
    const [follows, setFollows] = useState([]);
    const [search, setSearch] = useState([]);
    const [q, setQ] = useState('');
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);

    function loadGroups() {
        api('/groups').then(function (d) { setGroups(d.groups); }).catch(function (e) { setErr(e.message); });
    }
    function loadFollowing() {
        api('/following').then(function (d) { setFollows(d.entries); }).catch(function (e) { setErr(e.message); });
    }
    useEffect(function () {
        if (!me) return;
        loadGroups();
        loadFollowing();
    }, [me && me.id]);
    useEffect(function () {
        if (!openGroup) { setGroupData(null); return; }
        api('/groups/' + openGroup).then(setGroupData).catch(function (e) { setErr(e.message); });
    }, [openGroup]);

    if (!API_AVAILABLE) {
        return h('div', { className: 'ufs-note' },
            'Konten und Gruppen brauchen den Server. Öffne den Guide dafür über ',
            h('code', null, 'https://fish.tobee94.de'),
            ' statt als lokale Datei.');
    }
    if (!me) {
        return h(LoginPanel, { onLogin: props.onLogin });
    }

    return h('div', null,
        h('div', { className: 'ufs-row', style: { marginBottom: '.9rem' } },
            h(Toggle, { active: tab === 'gruppen', onClick: function () { setTab('gruppen'); } }, 'Gruppen'),
            h(Toggle, { active: tab === 'folgen', onClick: function () { setTab('folgen'); } }, 'Folgen & Vergleich'),
            h(Toggle, { active: tab === 'konto', onClick: function () { setTab('konto'); } }, 'Konto'),
            h('span', { className: 'ufs-muted', style: { marginLeft: 'auto', fontSize: '12px' } },
                'angemeldet als ', h('b', { style: { color: '#cbd5e1' } }, me.name))),
        err ? h('div', { className: 'ufs-note', style: { marginBottom: '.8rem' } }, err) : null,

        tab === 'gruppen' ? h('div', null,
            openGroup && groupData
                ? h('div', null,
                    h('button', { className: 'ufs-btn', style: { marginBottom: '.8rem' }, onClick: function () { setOpenGroup(null); } }, '← Alle Gruppen'),
                    h(GroupView, {
                        data: groupData,
                        onOpenUser: props.onOpenUser,
                        onLeave: function () {
                            api('/groups/' + openGroup + '/leave', { method: 'POST' })
                                .then(function () { setOpenGroup(null); loadGroups(); });
                        }
                    }))
                : h('div', null,
                    h('div', { className: 'ufs-spotcard', style: { marginBottom: '.9rem' } },
                        h('h3', null, 'Deine Gruppen'),
                        groups.length
                            ? h('div', { className: 'ufs-splist' }, groups.map(function (g) {
                                return h('div', {
                                    key: g.id, className: 'ufs-spline', style: { cursor: 'pointer' },
                                    onClick: function () { setOpenGroup(g.id); }
                                },
                                    h('span', { className: 'n' }, g.name + (g.owner ? ' (deine)' : '')),
                                    h('span', { className: 'q' }, g.members + ' Mitglieder'),
                                    h('span', { className: 'd' }, 'Code ' + g.code));
                            }))
                            : h('div', { className: 'ufs-muted', style: { fontSize: '12px' } },
                                'Noch keine Gruppe. Leg eine an oder tritt mit einem Code bei.')),
                    h('div', { className: 'ufs-row' },
                        h('button', {
                            className: 'ufs-btn primary', disabled: busy,
                            onClick: function () {
                                const n = prompt('Name der Gruppe?');
                                if (!n) return;
                                setBusy(true);
                                api('/groups', { method: 'POST', json: { name: n } })
                                    .then(function () { loadGroups(); })
                                    .catch(function (e) { setErr(e.message); })
                                    .then(function () { setBusy(false); });
                            }
                        }, '+ Gruppe anlegen'),
                        h('button', {
                            className: 'ufs-btn',
                            onClick: function () {
                                const c = prompt('Beitrittscode?');
                                if (!c) return;
                                api('/groups/join', { method: 'POST', json: { code: c } })
                                    .then(function () { loadGroups(); })
                                    .catch(function (e) { setErr(e.message); });
                            }
                        }, 'Gruppe beitreten'))))
            : null,

        tab === 'folgen' ? h('div', null,
            h('div', { className: 'ufs-row', style: { marginBottom: '.8rem' } },
                h('input', {
                    value: q, placeholder: 'Angler suchen …',
                    onChange: function (e) { setQ(e.target.value); },
                    onKeyDown: function (e) {
                        if (e.key !== 'Enter') return;
                        api('/users?q=' + encodeURIComponent(q)).then(function (d) { setSearch(d.users); });
                    },
                    className: 'rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50',
                    style: { minWidth: '220px' }
                }),
                h('button', {
                    className: 'ufs-btn',
                    onClick: function () { api('/users?q=' + encodeURIComponent(q)).then(function (d) { setSearch(d.users); }); }
                }, 'Suchen')),
            search.length ? h('div', { className: 'ufs-spotcard', style: { marginBottom: '.9rem' } },
                h('h3', null, 'Suchergebnis'),
                h('div', { className: 'ufs-splist' }, search.map(function (u) {
                    return h('div', { key: u.id, className: 'ufs-spline' },
                        h('span', { className: 'n', style: { cursor: 'pointer' }, onClick: function () { props.onOpenUser(u.id); } }, u.name),
                        h('span', { className: 'q' }, u.species + ' Arten · ' + u.fish + ' Fänge'),
                        h('button', {
                            className: 'ufs-chip ufs-chip-btn',
                            onClick: function () { api('/follow/' + u.id, { method: 'POST' }).then(loadFollowing); }
                        }, 'folgen'));
                }))) : null,
            h(FollowCompare, { entries: follows, lang: props.lang, onOpenUser: props.onOpenUser, onUnfollow: function (id) { api('/follow/' + id, { method: 'DELETE' }).then(loadFollowing); } }))
            : null,

        tab === 'konto' ? h(AccountPanel, {
            me: me, local: props.local,
            onMe: props.onMe, onLogout: props.onLogout
        }) : null);
}

/** Vergleich mit den Profilen, denen man folgt. */
function FollowCompare(props) {
    const rows = (props.entries || []).filter(function (e) { return e.profile; }).map(function (e) {
        const p = e.profile;
        return {
            id: e.user.id, name: e.user.name, self: e.self,
            species: p.speciesCount, complete: p.fisheriesComplete,
            fish: p.totals.fish, weight: p.totals.weight, time: p.totals.time,
            bigW: p.biggest.weight, bigWKey: p.biggest.weightSpecies,
            bigL: p.biggest.length, bigLKey: p.biggest.lengthSpecies,
            top: p.topSpecies.weight, topKey: p.topSpecies.key
        };
    });
    if (!rows.length) {
        return h('div', { className: 'ufs-note' },
            'Du folgst noch niemandem. Suche oben nach einem Angler – danach stehen hier alle Werte nebeneinander.');
    }
    const best = {};
    ['species', 'complete', 'fish', 'weight', 'bigW', 'bigL', 'top'].forEach(function (f) {
        best[f] = Math.max.apply(null, rows.map(function (r) { return r[f] || 0; }));
    });
    function td(r, f, text) {
        return h('td', { className: cn('num', r[f] > 0 && r[f] === best[f] && 'win') }, (r[f] > 0 && r[f] === best[f] ? '★ ' : '') + text);
    }
    return h('div', { className: 'ufs-spotcard' },
        h('table', { className: 'ufs-rec' },
            h('thead', null, h('tr', null,
                h('th', null, 'Angler'), h('th', null, 'Arten'), h('th', null, 'Reviere'),
                h('th', null, 'Fänge'), h('th', null, 'Masse'), h('th', null, 'Schwerster'),
                h('th', null, 'Längster'), h('th', null, 'Beste Art'), h('th', null, ''))),
            h('tbody', null, rows.map(function (r) {
                return h('tr', { key: r.id },
                    h('td', {
                        className: cn('n', r.self && 'done'), style: { cursor: 'pointer' },
                        onClick: function () { props.onOpenUser(r.id); }
                    }, (r.self ? '▸ ' : '') + r.name),
                    td(r, 'species', fmtNum(r.species)),
                    td(r, 'complete', fmtNum(r.complete)),
                    td(r, 'fish', fmtNum(r.fish)),
                    td(r, 'weight', fmtNum(r.weight, 1) + ' kg'),
                    td(r, 'bigW', r.bigW ? r.bigW.toFixed(2) + ' kg' : '–'),
                    td(r, 'bigL', r.bigL ? Math.round(r.bigL * 100) + ' cm' : '–'),
                    td(r, 'top', r.top ? fmtNum(r.top, 1) + ' kg' : '–'),
                    h('td', { className: 'sub' }, r.self ? '' :
                        h('button', {
                            className: 'ufs-chip ufs-chip-btn',
                            onClick: function () { props.onUnfollow(r.id); }
                        }, 'entfolgen')));
            }))));
}

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
    const [openUser, setOpenUser] = useState(null);

    // Anmeldezustand vom Server holen, sofern es einen gibt
    useEffect(function () {
        if (!API_AVAILABLE) return;
        api('/auth/me').then(function (d) { setMe(d.user); }).catch(function () { /* offline weiterarbeiten */ });
    }, []);
    const [selectedSpot, setSelectedSpot] = useState(null);
    const [highlight, setHighlight] = useState(null);
    const [lang, setLang] = useState(function () { return localStorage.getItem('ufs-lang') || 'de'; });
    const [favorites, setFavorites] = useState(function () {
        try { return JSON.parse(localStorage.getItem('ufs-favs') || '[]'); } catch (e) { return []; }
    });
    const [local, setLocal] = useState(loadLocal);
    const caught = local.caught || {};
    const bests = local.bests || {};
    const saveStats = local.stats || null;
    function patchLocal(patch) {
        setLocal(function (l) { return Object.assign({}, l, patch); });
    }
    const searchRef = useRef(null);

    useEffect(function () { localStorage.setItem('ufs-favs', JSON.stringify(favorites)); }, [favorites]);
    useEffect(function () {
        localStorage.setItem('ufs-caught', JSON.stringify(local.caught || {}));
        localStorage.setItem('ufs-bests', JSON.stringify(local.bests || {}));
        localStorage.setItem('ufs-stats', JSON.stringify(local.stats || null));
    }, [local]);
    useEffect(function () { localStorage.setItem('ufs-lang', lang); }, [lang]);
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
    useEffect(function () {
        function apply() {
            const parts = decodeURIComponent((location.hash || '').replace(/^#/, '')).split('/');
            const head = (parts[0] || '').toLowerCase();
            if (head === 'koeder') { setView('bait'); return; }
            if (head === 'gruppen' || head === 'community') { setView('community'); return; }
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
        if (view === 'bait') hash = '#koeder';
        else if (view === 'community') hash = '#gruppen';
        else if (view === 'stats') hash = '#statistik';
        else if (view === 'arten') hash = '#arten' + (openSpecies ? '/' + openSpecies : '');
        if (location.hash !== hash) history.replaceState(null, '', hash);
    }, [view, selectedMap, selectedSpot, openSpecies]);

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
            stats: { player: res.player, fisheries: res.fisheries, bests: res.bests, total: res.total }
        });
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
            h('div', { className: 'mx-auto flex max-w-[1700px] items-center gap-4 px-4 py-3 lg:px-7' },
                h('button', { onClick: function () { setSelectedMap(playable[0].id); }, className: 'flex shrink-0 items-center gap-3 text-left' },
                    h('span', { className: 'grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/20 to-blue-500/10 shadow-glow' },
                        h(Icon, { name: 'fish', className: 'text-cyan-200' })),
                    h('span', null,
                        h('span', { className: 'block text-sm font-black tracking-[.22em] text-cyan-200' }, 'UFS ATLAS'),
                        h('span', { className: 'block text-[10px] text-slate-500' }, 'Ultimate Fishing Simulator 1'))),
                h('div', { className: 'relative ml-auto w-full max-w-xl' },
                    h(Icon, { name: 'search', className: 'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500' }),
                    h('input', {
                        ref: searchRef, value: query, onChange: function (e) { setQuery(e.target.value); },
                        placeholder: 'Fisch, Köder, Spot oder Methode suchen …  /',
                        className: 'w-full rounded-2xl border border-white/10 bg-white/[.045] py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-cyan-400/50 focus:bg-white/[.07]'
                    })),
                h('div', { className: 'ufs-row', style: { flexWrap: 'nowrap' } },
                    h('button', {
                        className: cn('ufs-btn', view === 'map' && 'primary'),
                        onClick: function () { setView('map'); }
                    }, h(Icon, { name: 'map' }), 'Reviere'),
                    h('button', {
                        className: cn('ufs-btn', view === 'arten' && 'primary'),
                        onClick: function () { setView('arten'); }
                    }, h(Icon, { name: 'fish' }), 'Arten'),
                    h('button', {
                        className: cn('ufs-btn', view === 'bait' && 'primary'),
                        onClick: function () { setView('bait'); }
                    }, h(Icon, { name: 'bait' }), 'Köder'),
                    h('button', {
                        className: cn('ufs-btn', view === 'stats' && 'primary'),
                        onClick: function () { setView('stats'); }
                    }, h(Icon, { name: 'scale' }), 'Statistik'),
                    API_AVAILABLE ? h('button', {
                        className: cn('ufs-btn', view === 'community' && 'primary'),
                        onClick: function () { setView('community'); }
                    }, h(Icon, { name: 'star' }), 'Gruppen') : null,
                    h('span', { className: 'ufs-chip ufs-mono', title: 'Gefangene Arten insgesamt' }, '✓ ' + allDone + ' / ' + allKeys.length),
                    h('button', { className: 'ufs-btn', onClick: function () { setSourceOpen(true); } }, h(Icon, { name: 'source' }), 'Quellen')))),

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
                view === 'map' && !isGlobal ? null : h('h1', { className: 'mb-4 text-2xl font-black tracking-tight text-white' },
                    view === 'bait' ? 'Köder & Methoden'
                        : view === 'arten' ? 'Fischarten'
                        : view === 'community' ? 'Gruppen & Vergleich'
                        : view === 'stats' ? 'Statistik'
                        : 'Gesamtübersicht'),
                view === 'bait' ? h(BaitPage, { lang: lang })
                : view === 'community' ? h(CommunityPage, {
                    me: me, lang: lang, local: local,
                    onMe: function (u) { setMe(u); },
                    onLogin: function (u) { setMe(u); },
                    onLogout: function () { api('/auth/logout', { method: 'POST' }).then(function () { setMe(null); }); },
                    onOpenUser: setOpenUser
                })
                : view === 'stats' ? h(StatsPage, {
                    stats: saveStats, lang: lang, tab: statsTab,
                    me: me,
                    onOpenCommunity: function () { setView('community'); },
                    onReset: function () { setLocal({ caught: {}, bests: {}, stats: null }); },
                    onImport: function () { setImportOpen(true); },
                    onOpenMap: function (id) { setSelectedMap(id); setView('map'); },
                    onOpenSpecies: function (k) { setOpenSpecies(k); setView('arten'); }
                })
                : view === 'arten' ? h(SpeciesPage, {
                    lang: lang, caught: caught, bests: bests,
                    initialOpen: openSpecies, onOpen: setOpenSpecies
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
                        !fishery.fitOk && fishery.spots.length
                            ? h('div', { className: 'ufs-note', style: { fontSize: '11.5px' } },
                                'Bei diesem Revier lassen sich die Weltkoordinaten der Schwärme nicht verlässlich auf das Kartenbild projizieren. ' +
                                'Spotnummern und die Artenzuordnung je Spot stimmen trotzdem – nur die zusätzlichen Schwarm-Punkte bleiben ausgeblendet.')
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
                        h(Toggle, { active: lang === 'de', onClick: function () { setLang(lang === 'de' ? 'en' : 'de'); } },
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
        openUser ? h(UserModal, { id: openUser, lang: lang, onClose: function () { setOpenUser(null); } }) : null,
        importOpen ? h(ImportDialog, {
            me: me,
            onClose: function () { setImportOpen(false); },
            onImport: applyImport,
            onReset: function () { setLocal({ caught: {}, bests: {}, stats: null }); }
        }) : null);
}

ReactDOM.createRoot(document.getElementById('root')).render(h(App, null));
