/**
 * Readable names for the equipment a save file lists.
 *
 * The save file only stores short ids like ROD_ABU_GARCIA_02 or LEECH. Baits and
 * rig parts are in the game's own localisation table, which the game data
 * carries in both languages — those are looked up. Product names are not
 * translated anywhere, so they are merely tidied up.
 */
import { GAME } from '../data'
import { de } from '../i18n/de'
import type { Key } from '../i18n'

/** id fragment -> name per language, taken from the glossary. */
const ITEM_NAMES: Record<string, { en: string; de: string }> = {}
for (const cat of GAME.glossary?.categories ?? []) {
  for (const item of cat.items) {
    const seg = String(item.key).split('/').pop()
    if (seg) ITEM_NAMES[seg] = { en: item.en, de: item.de }
  }
}

/** ROD_ABU_GARCIA_02 -> Abu Garcia 02 */
function prettify(id: string): string {
  const parts = id.replace(/^(ICE_ROD|ROD_STAND|FEEDER_BAIT|BITE_INDICATOR|[A-Z]+)_/, '').split('_')
  return parts
    .map((p) =>
      /^\d+$/.test(p) ? p.replace(/^0+(?=\d)/, '') : p.charAt(0) + p.slice(1).toLowerCase(),
    )
    .join(' ')
}

export function itemLabel(id: string | null | undefined, lang: string): string | null {
  if (!id) return null
  const s = String(id).replace(/^(FEEDER_BAIT|BAIT|BOILIE)_/, '')
  const hit = ITEM_NAMES[s] ?? ITEM_NAMES[s.replace(/_\d+$/, '')]
  if (hit) return (lang === 'en' ? hit.en : hit.de) || hit.en
  return prettify(String(id))
}

/**
 * Name of an equipment class. Classes the dictionary does not know fall back to
 * the raw name with the underscores taken out — a new class in a game update
 * then shows up readable instead of disappearing.
 */
export function categoryLabel(c: string, t: (k: Key) => string): string {
  const key = ('cat.' + c) as Key
  return key in de ? t(key) : c.replace(/_/g, ' ')
}
