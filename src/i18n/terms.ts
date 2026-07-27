/**
 * German wording for the English bait and retrieve terms the guide text uses.
 *
 * The guide prose was written with the game's English labels in it. When the
 * page runs in German those labels are swapped for the German ones the game
 * itself shows, so a sentence does not mix two languages. In English nothing is
 * replaced — {@link translateTerms} hands the text straight back.
 *
 * Most of the vocabulary comes out of the game's own localisation table (the
 * glossary in the game data); only the entries below are added by hand: short
 * words the table does not carry, plus a one-line explanation for each retrieve.
 */
import { GAME } from '../data'

const EXTRA: Record<string, string> = {
  'Red Worm': 'Regenwurm',
  Worm: 'Wurm',
  Earthworm: 'Regenwurm',
  Maggot: 'Made',
  'Live Bait': 'Lebendköder',
  Fly: 'Fliege',
  Corn: 'Mais',
  Pea: 'Erbse',
  Bread: 'Brot',
  Leech: 'Blutegel',
  'Wax Worm': 'Wachswurm',
  Dragonfly: 'Libelle',
  Grasshopper: 'Grashüpfer',
  Cheese: 'Käse',
  Marshmallow: 'Schaum',
  'Dough Ball': 'Teigball',
  Dough: 'Teig',
  'Semolina Ball': 'Grießball',
  Eggs: 'Fischeier',
  Egg: 'Fischei',
  'Natural Egg': 'Natürliches Fischei',
  'Artificial Egg': 'Künstliches Fischei',
  'Cutbait Small': 'Kleiner Schnittköder',
  'Cutbait Big': 'Großer Schnittköder',
  'Cutbait Large': 'Großer Schnittköder',
  'Small Cutbait': 'Kleiner Schnittköder',
  Cutbait: 'Schnittköder',
  Insects: 'Insekten',
  Boilie: 'Boilie',
  Softbait: 'Gummiköder',
  'Soft Bait': 'Gummiköder',
  'Soft lure': 'Gummiköder',
  Spoon: 'Blinker',
  Spinner: 'Spinner',
  Wobbler: 'Wobbler',
  'Hard lure': 'Wobbler',
  Crankbait: 'Wobbler',
  Lure: 'Kunstköder',
  Lures: 'Kunstköder',
  'Straight Slow': 'Straight Slow – sehr langsam einholen',
  Straight: 'Straight – gleichmäßig einholen',
  'Lift & Drop': 'Lift & Drop – anheben und absinken lassen',
  'Lift and Drop': 'Lift & Drop – anheben und absinken lassen',
  'Stop & Go': 'Stop & Go – einholen, absinken, kurz liegen lassen',
  'Stop and Go': 'Stop & Go – einholen, absinken, kurz liegen lassen',
  Twitching: 'Twitching – regelmäßig zupfen',
  Trolling: 'Schleppfischen',
  'Slit Finesse': 'Slit Finesse',
}

const MAP: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  const gl = GAME.glossary
  for (const group of [gl?.bait, gl?.lure, gl?.method]) {
    if (!group) continue
    for (const en of Object.keys(group)) {
      const de = group[en]
      if (de) out[en.toLowerCase()] = de
    }
  }
  for (const en of Object.keys(EXTRA)) out[en.toLowerCase()] = EXTRA[en]!
  return out
})()

// Longest first, so "Cutbait Small" wins over "Cutbait". The lookaround keeps
// the match off word fragments; older engines without lookbehind fall back to \b.
const RX: RegExp | null = (() => {
  const keys = Object.keys(MAP).sort((a, b) => b.length - a.length)
  if (!keys.length) return null
  const esc = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  try {
    return new RegExp('(?<![\\wäöüß])(' + esc.join('|') + ')(?![\\wäöüß])', 'gi')
  } catch {
    return new RegExp('\\b(' + esc.join('|') + ')\\b', 'gi')
  }
})()

/** Puts the game's German wording into a guide sentence. */
export function toGerman(text: string): string {
  if (!text || typeof text !== 'string' || !RX) return text
  RX.lastIndex = 0
  return text.replace(RX, (m) => MAP[m.toLowerCase()] || m)
}

/** Same, but only where the chosen language asks for it. */
export function translateTerms(text: string, lang: string): string {
  return lang === 'de' ? toGerman(text) : text
}
