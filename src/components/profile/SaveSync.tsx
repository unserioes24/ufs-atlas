/**
 * Two ways the save file gets to the account, and one warning.
 *
 * `AheadNote` appears when this browser holds a newer state than the account.
 * The account is not allowed to overwrite it silently – that would throw away
 * the newer save file – so the state stays and the offer is to push it up.
 *
 * `SaveUpload` sends the PROFILE file itself to the server. The API route with
 * a token exists for the scheduled job; in the browser a file picker is the
 * shorter way, and the file is parsed on the server exactly the same.
 */
import { useRef, useState } from 'react'
import { api } from '../../lib/api'
import { fmtWhen } from '../../lib/format'
import { useI18n } from '../../i18n'
import type { LocalState } from '../../types'
import { Icon } from '../primitives'

export interface AheadNoteProps {
  /** The account's timestamp, or null when the account holds nothing yet. */
  serverAt: string | null
  local: LocalState
  onDone: (when: string) => void
}

export function AheadNote({ serverAt, local, onDone }: AheadNoteProps) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  async function push() {
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ profile?: { updatedAt?: string } }>('/profile/import', {
        method: 'POST',
        json: local,
      })
      setHidden(true)
      // The server's own timestamp, not this browser's clock: stamping it with
      // new Date() lands a few milliseconds after the server wrote its row, and
      // the next page load would call this state the newer one all over again.
      onDone(res.profile?.updatedAt ?? new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ufs-ahead no-print">
      <div className="tx">
        <b>{t('sync.aheadTitle')}</b>{' '}
        {serverAt
          ? t('sync.aheadText', { when: fmtWhen(serverAt) })
          : t('sync.aheadTextEmpty')}
        {error ? <span className="er"> {error}</span> : null}
      </div>
      <div className="ufs-row" style={{ gap: '.4rem' }}>
        <button className="ufs-btn primary" onClick={push} disabled={busy}>
          <Icon name="share" />
          {busy ? t('sync.uploading') : t('sync.upload')}
        </button>
        <button className="ufs-btn" onClick={() => setHidden(true)}>
          {t('sync.later')}
        </button>
      </div>
    </div>
  )
}

export interface SaveUploadProps {
  onDone: (when: string) => void
}

/** File picker straight to /profile/upload – the server does the parsing. */
export function SaveUpload({ onDone }: SaveUploadProps) {
  const { t } = useI18n()
  const ref = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function send(file: File) {
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api<{ profile?: { updatedAt?: string; speciesCount?: number } }>(
        '/profile/upload',
        { method: 'POST', body: form },
      )
      const when = res.profile?.updatedAt ?? new Date().toISOString()
      setMsg(t('sync.uploadedN', { n: res.profile?.speciesCount ?? 0 }))
      onDone(when)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <div>
      <p className="ufs-muted" style={{ fontSize: '12px', lineHeight: 1.6, margin: '0 0 .6rem' }}>
        {t('sync.uploadLead')}
      </p>
      <input
        ref={ref}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void send(f)
        }}
      />
      <button className="ufs-btn primary" disabled={busy} onClick={() => ref.current?.click()}>
        <Icon name="share" />
        {busy ? t('sync.uploading') : t('sync.pickFile')}
      </button>
      {msg ? (
        <p style={{ fontSize: '12px', margin: '.6rem 0 0', color: '#4ade80' }}>
          {msg}
        </p>
      ) : null}
      {error ? (
        <p style={{ fontSize: '12px', margin: '.6rem 0 0', color: '#f87171' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
