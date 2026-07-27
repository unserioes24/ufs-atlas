/**
 * Reading a PROFILE file. The file is parsed in the browser; only when you are
 * signed in is the same file handed to the server so the account carries the
 * state too.
 */
import { useRef, useState } from 'react'
import { API_AVAILABLE, api } from '../../lib/api'
import { useI18n } from '../../i18n'
import { parseProfile, profileToCatches } from '../../lib/savegame'
import type { SaveSummary } from '../../lib/savegame'
import { Icon } from '../primitives'

export interface ImportDialogProps {
  me: { name: string } | null
  onImport: (res: SaveSummary) => void
  onReset: () => void
  onClose: () => void
}

export function ImportDialog({ me, onImport, onReset, onClose }: ImportDialogProps) {
  const { t } = useI18n()
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setMsg(null)
    const rd = new FileReader()
    rd.onload = () => {
      try {
        const buf = rd.result as ArrayBuffer
        const res = profileToCatches(parseProfile(buf))
        if (!res.total) {
          setMsg({ bad: true, text: t('import.noCounters') })
          setBusy(false)
          return
        }
        onImport(res)
        const done = t('import.done', {
          who: res.player?.name ? res.player.name + ': ' : '',
          n: res.total,
        })

        // Signed in? Then the same file goes to the account as well.
        if (me && API_AVAILABLE) {
          api('/profile/upload', { method: 'POST', body: buf })
            .then(() => setMsg({ bad: false, text: done + ' ' + t('import.alsoServer') }))
            .catch((err: Error) =>
              setMsg({
                bad: false,
                text: done + ' ' + t('import.serverFailed', { error: err.message }),
              }),
            )
            .then(() => setBusy(false))
          return
        }
        setMsg({ bad: false, text: done })
      } catch (err) {
        setMsg({ bad: true, text: t('import.unreadable', { error: (err as Error).message }) })
      }
      setBusy(false)
    }
    rd.onerror = () => {
      setMsg({ bad: true, text: t('import.unreadablePlain') })
      setBusy(false)
    }
    rd.readAsArrayBuffer(file)
  }

  return (
    <div
      className="ufs-modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="ufs-modal">
        <h2>{t('import.title')}</h2>
        <p>{t('import.lead')}</p>
        <p>{t('import.whereLead')}</p>
        <p>
          <code>%UserProfile%\AppData\LocalLow\PlayWay\UltimateFishing\PROFILE_0</code>
        </p>
        <p style={{ color: '#64748b' }}>{t('import.slots')}</p>
        <div className="ufs-row" style={{ marginTop: '1rem' }}>
          <input ref={inputRef} type="file" className="ufs-file" onChange={onFile} />
          <button className="ufs-btn primary" onClick={() => inputRef.current?.click()}>
            <Icon name="import" />
            {busy ? t('import.reading') : t('import.pick')}
          </button>
          <button className="ufs-btn" onClick={onClose}>
            {t('app.close')}
          </button>
        </div>
        {msg ? (
          <div
            className="ufs-note"
            style={
              msg.bad
                ? undefined
                : {
                    borderColor: 'rgba(52,211,153,.3)',
                    background: 'rgba(16,185,129,.08)',
                    color: '#a7f3d0',
                  }
            }
          >
            {msg.text}
          </div>
        ) : null}
        <div className="ufs-sep" />
        <p>{t('import.byHand')}</p>
        <button
          className="ufs-btn danger"
          onClick={() => {
            if (confirm(t('import.resetAsk'))) onReset()
          }}
        >
          {t('import.reset')}
        </button>
      </div>
    </div>
  )
}

export default ImportDialog
