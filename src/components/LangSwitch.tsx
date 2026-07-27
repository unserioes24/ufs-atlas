import { LANGS, LANG_NAMES, useI18n } from '../i18n'
import type { Lang } from '../i18n'
import { cn } from '../lib/format'

/**
 * Switching the language of the guide's own text. Names of species, baits and
 * fisheries come from the game's localisation table and are handled elsewhere.
 */
export function LangSwitch() {
  const { lang, setLang } = useI18n()

  return (
    <div className="ufs-langswitch" role="group" aria-label="Sprache">
      {LANGS.map((l: Lang) => (
        <button
          key={l}
          type="button"
          className={cn('opt', lang === l && 'on')}
          onClick={() => setLang(l)}
          title={LANG_NAMES[l]}
          aria-pressed={lang === l}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
