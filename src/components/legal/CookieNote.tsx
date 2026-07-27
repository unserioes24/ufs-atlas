/**
 * A line about cookies, shown once.
 *
 * There is nothing to consent to and nothing to refuse: the two cookies the
 * site sets are the session and the "stay signed in" ticket, both of which only
 * exist once you sign in and both of which are needed for that to work. No
 * analytics, no third parties, nothing to track with. So this informs rather
 * than asks, and the button only makes it go away.
 *
 * Opened straight from disk there is no server, no sign-in and no cookie, so
 * the note never appears there.
 */
import { useState } from 'react'
import { API_AVAILABLE } from '../../lib/api'
import { useI18n } from '../../i18n'

const KEY = 'ufs-cookie-note'

export function CookieNote({ onPrivacy }: { onPrivacy: () => void }) {
  const { t } = useI18n()
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return true
    }
  })

  if (!API_AVAILABLE || seen) return null

  return (
    <div className="ufs-cookienote no-print" role="note">
      <p>
        {t('cookie.text')}{' '}
        <button type="button" className="ufs-link" onClick={onPrivacy}>
          {t('legal.privacy')}
        </button>
      </p>
      <button
        type="button"
        className="ufs-btn primary"
        onClick={() => {
          try {
            localStorage.setItem(KEY, '1')
          } catch {
            // Private mode: then it shows again next visit, which is fine.
          }
          setSeen(true)
        }}
      >
        {t('cookie.ok')}
      </button>
    </div>
  )
}

export default CookieNote
