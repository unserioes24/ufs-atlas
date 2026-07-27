import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { setFormatLocale } from '../lib/format'
import { de } from './de'
import { en } from './en'

/**
 * Zwei Ebenen von Sprache:
 *
 *  - Die Texte des Guides stehen hier, je Sprache eine Datei. Fehlt ein
 *    Schlüssel, greift Deutsch, damit nie ein Platzhalter erscheint.
 *  - Namen von Arten, Ködern und Revieren kommen aus der Lokalisierung des
 *    Spiels und liegen in den Spieldaten. Sie werden nicht hier gepflegt.
 */
export const LANGS = ['de', 'en'] as const
export type Lang = (typeof LANGS)[number]

export const LANG_NAMES: Record<Lang, string> = {
  de: 'Deutsch',
  en: 'English',
}

/**
 * German is written `as const` so the keys are known exactly. The dictionary
 * type widens the values back to plain strings — otherwise a translation would
 * have to repeat the German wording to satisfy the compiler.
 */
export type Key = keyof typeof de
export type Dict = Record<Key, string>

const DICTS: Record<Lang, Partial<Dict>> = { de, en }

/** Platzhalter der Form {name} durch Werte ersetzen. */
function fill(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = vars[name]
    return v === undefined ? whole : String(v)
  })
}

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: Key, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<I18n | null>(null)

const STORE_KEY = 'ufs-lang'

function initial(): Lang {
  const saved = localStorage.getItem(STORE_KEY)
  if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang
  // Ohne Wahl richtet sich die Seite nach dem Browser.
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en'
}

// The very first render must already format in the right locale.
setFormatLocale(initial())

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial)

  useEffect(() => {
    localStorage.setItem(STORE_KEY, lang)
    document.documentElement.lang = lang
    setFormatLocale(lang)
  }, [lang])

  const t = useCallback(
    (key: Key, vars?: Record<string, string | number>) => {
      const dict = DICTS[lang] as Partial<Dict>
      return fill(dict[key] ?? de[key], vars)
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang: setLangState, t }), [lang, t])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n used outside the I18nProvider')
  return ctx
}
