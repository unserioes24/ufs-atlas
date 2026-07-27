/**
 * The list of sources behind the guide, as a panel sliding in from the right.
 * The entries themselves come from guide.json; the note above them says which
 * figures are read out of the game and which stay community knowledge.
 */
import { GUIDE } from '../data'
import { useI18n } from '../i18n'
import type { Key } from '../i18n'
import { Icon } from './primitives'

export function SourcesPanel({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n()
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="scrollbar h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#08141c] p-5 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">
              {t('sources.eyebrow')}
            </div>
            <h2 className="mt-1 text-2xl font-black text-white">{t('sources.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-slate-400 hover:bg-white/[.06]"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-4 text-sm leading-6 text-amber-100/80">
          {t('sources.note')}
        </div>
        <div className="mt-6 space-y-3">
          {Object.keys(GUIDE.sources).map((id) => {
            const s = GUIDE.sources[id]!
            // The category is a dictionary key, the note comes in both
            // languages. Where either is missing, the German original shows.
            const type = s.typeKey ? t(s.typeKey as Key) : s.type
            const note = lang === 'en' ? s.noteEn || s.note : s.note
            return (
              <a
                key={id}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:border-cyan-400/30 hover:bg-white/[.05]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-bold text-slate-100">{s.title}</div>
                    <div className="mt-1 text-xs text-cyan-300">{type}</div>
                  </div>
                  <Icon name="source" className="text-slate-500" />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{note}</p>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default SourcesPanel
