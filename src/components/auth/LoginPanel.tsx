/**
 * Signing in without a password: an e-mail address, a six-digit code, done.
 *
 * Before the mail goes out the browser solves an ALTCHA challenge, so the form
 * costs something to abuse. Each challenge counts once — after every attempt a
 * fresh round is started.
 */
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Challenge } from '../../lib/altcha'
import { solveAltcha } from '../../lib/altcha'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/format'

type BoxState = { s: 'load' | 'work' | 'ok' | 'err'; p: number; err: string | null }

/** Fetches a challenge, solves it and hands the answer up. */
function AltchaBox({
  round,
  onSolved,
}: {
  round: number
  onSolved: (payload: string | null) => void
}) {
  const { t } = useI18n()
  const [state, setState] = useState<BoxState>({ s: 'load', p: 0, err: null })

  useEffect(() => {
    let alive = true
    if (!window.crypto?.subtle) {
      setState({ s: 'err', p: 0, err: t('auth.altchaNoCrypto') })
      return
    }
    setState({ s: 'load', p: 0, err: null })
    onSolved(null)
    api<Challenge>('/auth/challenge')
      .then((c) => {
        if (!alive) return null
        setState({ s: 'work', p: 0, err: null })
        return solveAltcha(
          c,
          (p) => {
            if (alive) setState({ s: 'work', p, err: null })
          },
          t('auth.altchaFailed'),
        )
      })
      .then((payload) => {
        if (!alive || !payload) return
        setState({ s: 'ok', p: 1, err: null })
        onSolved(payload)
      })
      .catch((e: Error) => {
        if (alive) setState({ s: 'err', p: 0, err: e.message })
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  const text =
    state.s === 'ok'
      ? t('auth.altchaOk')
      : state.s === 'err'
        ? state.err
        : state.s === 'work'
          ? t('auth.altchaWork', { pct: Math.round(state.p * 100) })
          : t('auth.altchaPrepare')

  return (
    <div className={cn('ufs-altcha', state.s === 'ok' && 'ok', state.s === 'err' && 'bad')}>
      <span className="mark" aria-hidden>
        {state.s === 'ok' ? '✓' : state.s === 'err' ? '!' : '◔'}
      </span>
      <span className="txt">{text}</span>
      <span className="by">{t('auth.altchaBy')}</span>
    </div>
  )
}

export interface LoginPanelProps {
  onLogin: (user: unknown) => void
}

export function LoginPanel({ onLogin }: LoginPanelProps) {
  const { t } = useI18n()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [altcha, setAltcha] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const [remember, setRemember] = useState(true)

  function send() {
    if (!altcha) return
    setBusy(true)
    setMsg(null)
    api('/auth/request', { method: 'POST', json: { email, altcha } })
      .then(() => {
        setStep('code')
        setMsg({ ok: true, t: t('auth.codeSent') })
      })
      .catch((e: Error) => setMsg({ ok: false, t: e.message }))
      // A challenge counts once – fetch a new one for the next attempt
      .then(() => {
        setBusy(false)
        setRound((r) => r + 1)
      })
  }

  function verify() {
    setBusy(true)
    setMsg(null)
    api<{ user: unknown }>('/auth/verify', {
      method: 'POST',
      json: { email, code, remember },
    })
      .then((d) => onLogin(d.user))
      .catch((e: Error) => setMsg({ ok: false, t: e.message }))
      .then(() => setBusy(false))
  }

  const field =
    'rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50'

  return (
    <div className="ufs-spotcard" style={{ maxWidth: '460px' }}>
      <h3>{t('auth.title')}</h3>
      <p className="ufs-muted" style={{ fontSize: '12.5px', lineHeight: 1.6, margin: '0 0 .8rem' }}>
        {t('auth.intro')}
      </p>
      {step === 'email' ? (
        <div>
          <AltchaBox round={round} onSolved={setAltcha} />
          <div className="ufs-row" style={{ marginTop: '.7rem' }}>
            <input
              type="email"
              value={email}
              placeholder={t('auth.email')}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && email && altcha) send()
              }}
              className={field}
              style={{ minWidth: '220px' }}
            />
            <button
              className="ufs-btn primary"
              disabled={busy || !email || !altcha}
              onClick={send}
            >
              {busy ? t('auth.sending') : altcha ? t('auth.requestCode') : t('auth.checking')}
            </button>
          </div>
        </div>
      ) : (
        <div className="ufs-row">
          <input
            inputMode="numeric"
            value={code}
            placeholder={t('auth.codePlaceholder')}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.length === 6) verify()
            }}
            className={field}
            style={{ width: '140px', letterSpacing: '.3em', fontVariantNumeric: 'tabular-nums' }}
          />
          <button className="ufs-btn primary" disabled={busy || code.length !== 6} onClick={verify}>
            {busy ? t('auth.verifying') : t('auth.verify')}
          </button>
          <button
            className="ufs-btn"
            onClick={() => {
              setStep('email')
              setCode('')
            }}
          >
            {t('app.back')}
          </button>
        </div>
      )}
      <label className="ufs-check" style={{ marginTop: '.8rem' }}>
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        <span>{t('auth.stayLoggedIn')}</span>
        <span className="ufs-muted" style={{ fontSize: '11.5px' }}>
          {t('auth.stayHint')}
        </span>
      </label>
      {msg ? (
        <div
          className="ufs-note"
          style={
            msg.ok
              ? {
                  borderColor: 'rgba(52,211,153,.3)',
                  background: 'rgba(16,185,129,.08)',
                  color: '#a7f3d0',
                  marginTop: '.8rem',
                }
              : { marginTop: '.8rem' }
          }
        >
          {msg.t}
        </div>
      ) : null}
    </div>
  )
}

export default LoginPanel
