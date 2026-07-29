/**
 * Account settings: the user name, the shareable address, pushing the local
 * state into the account, and the token for uploading a save file without
 * signing in.
 */
import { useState } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../i18n'
import { profileUrl } from '../../lib/profile'
import type { LocalState } from '../../types'
import { Icon } from '../primitives'
import { SaveUpload } from './SaveSync'

/** The signed-in account, as /auth/me returns it. */
export interface Account {
  id: number
  name: string
  email?: string | null
  apiToken: string
}

export interface AccountPanelProps {
  me: Account
  local: LocalState | null
  onMe: (user: Account) => void
  onLogout: () => void
  onOpenUser: (name: string) => void
}

const FIELD =
  'rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50'

export function AccountPanel({ me, local, onMe, onLogout, onOpenUser }: AccountPanelProps) {
  const { t } = useI18n()
  const state = local ?? { caught: {}, bests: {}, stats: null, updatedAt: null }
  const [token, setToken] = useState(me.apiToken)
  const [name, setName] = useState(me.name)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [slot, setSlot] = useState(0)
  const localCount = Object.keys(state.caught ?? {}).length

  const say = (text: string) => {
    setErr(null)
    setMsg(text)
  }
  const fail = (e: Error) => {
    setMsg(null)
    setErr(e.message)
  }

  function saveName() {
    const wish = name.trim()
    if (!wish || wish === me.name) return
    setBusy(true)
    api<{ user: Account }>('/profile/name', { method: 'POST', json: { name: wish } })
      .then((d) => {
        onMe(d.user)
        setName(d.user.name)
        say(t('account.nameSaved'))
      })
      .catch(fail)
      .then(() => setBusy(false))
  }

  function importLocal() {
    if (!localCount) return
    if (!confirm(t('account.pushAsk'))) return
    setBusy(true)
    api<{ user: Account; profile?: { speciesCount: number } }>('/profile/import', {
      method: 'POST',
      json: { caught: state.caught ?? {}, bests: state.bests ?? {}, stats: state.stats ?? null },
    })
      .then((d) => {
        onMe(d.user)
        say(t('account.pushed', { n: d.profile ? d.profile.speciesCount : 0 }))
      })
      .catch(fail)
      .then(() => setBusy(false))
  }

  // The game keeps three profile slots, so the command must not decide for
  // anybody which one they play in.
  const cmd =
    'curl -H "X-Api-Token: ' +
    token +
    '" --data-binary "@%UserProfile%\\AppData\\LocalLow\\PlayWay\\UltimateFishing\\PROFILE_' +
    slot +
    '" ' +
    location.origin +
    '/api/profile/upload'

  const hint = { fontSize: '12.5px', lineHeight: 1.6, margin: '.2rem 0 .6rem' } as const

  return (
    <div className="ufs-spotcard">
      <h3>{t('account.title')}</h3>
      <div className="ufs-stats" style={{ marginBottom: '.9rem' }}>
        <span>
          {t('account.signedInLabel')}{' '}
          <b>{me.name}</b>
        </span>
        {me.email ? <span>{me.email}</span> : null}
      </div>

      {err ? (
        <div className="ufs-note" style={{ marginBottom: '.8rem' }}>
          {err}
        </div>
      ) : null}
      {msg ? (
        <div className="ufs-note ok" style={{ marginBottom: '.8rem' }}>
          {msg}
        </div>
      ) : null}

      <h3>{t('account.userName')}</h3>
      <p className="ufs-muted" style={hint}>
        {t('account.nameHint')}
      </p>
      <div className="ufs-row" style={{ marginBottom: '1.1rem' }}>
        <input
          value={name}
          maxLength={32}
          placeholder={t('account.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveName()
          }}
          className={FIELD}
          style={{ minWidth: '220px' }}
        />
        <button
          className="ufs-btn primary"
          disabled={busy || !name.trim() || name.trim() === me.name}
          onClick={saveName}
        >
          {t('account.saveName')}
        </button>
      </div>

      <h3>{t('account.shareTitle')}</h3>
      <p className="ufs-muted" style={hint}>
        {t('account.linkHint')}
      </p>
      <div className="ufs-row" style={{ marginBottom: '1.1rem' }}>
        <input
          readOnly
          value={profileUrl(me.name)}
          onFocus={(e) => e.target.select()}
          className="rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none"
          style={{ flex: '1 1 260px', minWidth: '220px' }}
        />
        <button
          className="ufs-btn"
          onClick={() => {
            const url = profileUrl(me.name)
            if (navigator.clipboard) {
              navigator.clipboard.writeText(url).then(
                () => say(t('account.addressCopied')),
                () => {},
              )
            } else say(url)
          }}
        >
          {t('app.copy')}
        </button>
        <button className="ufs-btn primary" onClick={() => onOpenUser(me.name)}>
          {t('account.viewProfile')}
        </button>
      </div>

      <h3>{t('account.push')}</h3>
      <p className="ufs-muted" style={hint}>
        {localCount
          ? t('account.localHas', { n: localCount }) +
            (state.stats?.player ? ' ' + t('account.localWithSave') : '')
          : t('account.localEmpty')}
      </p>
      <div className="ufs-row" style={{ marginBottom: '1.1rem' }}>
        <button className="ufs-btn" disabled={busy || !localCount} onClick={importLocal}>
          <Icon name="import" />
          {t('account.push')}
        </button>
      </div>

      <h3>{t('sync.title')}</h3>
      <div style={{ marginBottom: '1.1rem' }}>
        <SaveUpload
          onDone={() => {
            say(t('account.uploadDone'))
            void api<{ user: Account }>('/auth/me').then((d) => onMe(d.user))
          }}
        />
      </div>

      <h3>{t('account.autoUpload')}</h3>
      <p className="ufs-muted" style={hint}>
        {t('account.tokenHint')}
      </p>
      <div className="ufs-row" style={{ gap: '.4rem', marginBottom: '.6rem' }}>
        <span className="ufs-muted" style={{ fontSize: '12px' }}>
          {t('account.slotLabel')}
        </span>
        {[0, 1, 2].map((n) => (
          <button
            key={n}
            className={'ufs-btn' + (slot === n ? ' primary' : '')}
            style={{ padding: '.15rem .7rem' }}
            onClick={() => setSlot(n)}
          >
            {'PROFILE_' + n}
          </button>
        ))}
      </div>
      <pre className="ufs-cmd">{cmd}</pre>
      <div className="ufs-row">
        <button
          className="ufs-btn"
          onClick={() => {
            void navigator.clipboard?.writeText(cmd)
          }}
        >
          {t('account.copyCommand')}
        </button>
        <button
          className="ufs-btn danger"
          onClick={() => {
            if (!confirm(t('account.newTokenAsk'))) return
            void api<{ token: string }>('/auth/token/new', { method: 'POST' }).then((d) =>
              setToken(d.token),
            )
          }}
        >
          {t('account.newToken')}
        </button>
        <button className="ufs-btn" onClick={onLogout}>
          {t('auth.logout')}
        </button>
      </div>
    </div>
  )
}

export default AccountPanel
