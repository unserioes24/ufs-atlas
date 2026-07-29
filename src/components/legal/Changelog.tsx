/**
 * The changelog, as an overlay off the footer.
 *
 * Each release is split into what holds everywhere, what only the offline
 * download gets, and what needs the hosted site. In the offline build the server
 * group would be a list of things that cannot happen here, so it stays out.
 */
import { useEffect } from 'react'
import { CHANGELOG } from '../../data/changelog'
import type { ChangeGroups } from '../../data/changelog'
import { useI18n } from '../../i18n'
import type { Key } from '../../i18n'
import { API_AVAILABLE } from '../../lib/api'
import { Icon } from '../primitives'

const GROUPS: Array<{ id: keyof ChangeGroups; label: Key }> = [
  { id: 'general', label: 'changelog.general' },
  { id: 'offline', label: 'changelog.offline' },
  { id: 'server', label: 'changelog.server' },
]

export function Changelog({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = before
    }
  }, [onClose])

  return (
    <div
      className="ufs-sheet-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="ufs-sheet" role="dialog" aria-label={t('changelog.title')}>
        <div className="ufs-sheet-head">
          <span>{t('changelog.title')}</span>
          <button className="ufs-btn" onClick={onClose} title={t('app.close')}>
            <Icon name="close" />
            <span className="lbl">{t('app.close')}</span>
          </button>
        </div>
        <div className="ufs-sheet-body">
          <p className="ufs-muted" style={{ fontSize: '12.5px', lineHeight: 1.65, marginTop: 0 }}>
            {t('changelog.lead')}
          </p>
          {CHANGELOG.map((rel) => {
            const groups = lang === 'en' ? rel.en : rel.de
            return (
              <section key={rel.version} className="ufs-release">
                <h3>
                  <span className="v">{rel.version}</span>
                  <span className="dt">
                    {new Date(rel.date).toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-DE', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </h3>
                {GROUPS.map((g) => {
                  const items = groups[g.id]
                  if (!items?.length) return null
                  // The offline download has no server side to speak of.
                  if (g.id === 'server' && !API_AVAILABLE) return null
                  return (
                    <div key={g.id} className="grp">
                      <h4>{t(g.label)}</h4>
                      <ul>
                        {items.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Changelog
