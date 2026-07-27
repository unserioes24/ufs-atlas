import { useCallback, useEffect, useState } from 'react'
import { api, API_AVAILABLE } from '../../lib/api'
import { fmtNum } from '../../lib/format'
import { Card, Note, SideMenu, Toggle, WithSideMenu } from '../ui'
import type { MenuItem } from '../ui'
import { GroupView } from './GroupView'
import type { Group, Visibility } from './types'

/**
 * Groups, with the same side menu as the fishery list: your groups on the
 * left, everything about the selected one on the right. Below the list sit
 * the two ways in — the public directory and a join code.
 */

export const VISIBILITY: Record<Visibility, { title: string; hint: string }> = {
  public: { title: 'Öffentlich', hint: 'steht im Verzeichnis, jeder darf beitreten' },
  unlisted: { title: 'Nicht gelistet', hint: 'nur über Link oder Code zu finden, Beitritt frei' },
  private: { title: 'Privat', hint: 'nur Mitglieder sehen sie, Beitritt nur mit Code' },
}

interface Props {
  me: { id: number; name: string } | null
  /** Group taken from the address bar, if any. */
  openId: number | null
  onOpen: (id: number | null) => void
  onOpenUser: (name: string) => void
  onLogin: () => void
}

export function GroupsPage({ me, openId, onOpen, onOpenUser, onLogin }: Props) {
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!me) return
    api<{ groups: Group[] }>('/groups')
      .then((d) => setGroups(d.groups))
      .catch((e: Error) => setErr(e.message))
  }, [me])

  useEffect(load, [load])

  if (!API_AVAILABLE) {
    return (
      <Note>
        Gruppen brauchen den Server. Öffne den Guide über <code>https://ufs-atlas.de</code>.
      </Note>
    )
  }
  if (!me) {
    return (
      <Note>
        Gruppen gibt es mit einem Konto.{' '}
        <button type="button" className="ufs-btn" onClick={onLogin}>
          Anmelden
        </button>
      </Note>
    )
  }

  const items: MenuItem[] = [
    { key: 'uebersicht', title: 'Deine Gruppen', sub: `${groups?.length ?? 0} Stück` },
    ...(groups ?? []).map((g) => ({
      key: String(g.id),
      title: g.name,
      sub: `${g.members} Mitglieder${g.owner ? ' · du bist Admin' : ''}`,
    })),
    { key: 'suchen', title: 'Beitreten', sub: 'Verzeichnis oder Code' },
  ]
  const active = openId ? String(openId) : 'uebersicht'

  return (
    <WithSideMenu
      menu={
        <SideMenu
          heading="Gruppen"
          items={items}
          active={active}
          onSelect={(key) => onOpen(key === 'uebersicht' || key === 'suchen' ? null : Number(key))}
        />
      }
    >
      {err ? <Note>{err}</Note> : null}
      {openId ? (
        <GroupView
          id={openId}
          onChanged={() => {
            load()
            onOpen(null)
          }}
          onOpenUser={onOpenUser}
          onBack={() => onOpen(null)}
        />
      ) : (
        <GroupList groups={groups} onOpen={onOpen} onChanged={load} />
      )}
    </WithSideMenu>
  )
}

function GroupList({
  groups,
  onOpen,
  onChanged,
}: {
  groups: Group[] | null
  onOpen: (id: number) => void
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [vis, setVis] = useState<Visibility>('private')
  const [code, setCode] = useState('')
  const [dir, setDir] = useState<Group[] | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const loadDir = useCallback(() => {
    api<{ groups: Group[] }>('/groups/public' + (q ? `?q=${encodeURIComponent(q)}` : ''))
      .then((d) => setDir(d.groups))
      .catch((e: Error) => setErr(e.message))
  }, [q])

  useEffect(() => {
    loadDir()
    // Only on mount: afterwards the search button decides when to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function run(p: Promise<unknown>) {
    setBusy(true)
    setErr(null)
    p.then(() => {
      onChanged()
      loadDir()
    })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false))
  }

  return (
    <div className="space-y-4">
      {err ? <Note>{err}</Note> : null}

      <Card title="Deine Gruppen">
        {!groups ? (
          <p className="ufs-muted" style={{ fontSize: '12.5px', margin: 0 }}>
            Wird geladen …
          </p>
        ) : !groups.length ? (
          <p className="ufs-muted" style={{ fontSize: '12.5px', margin: 0 }}>
            Du bist noch in keiner Gruppe. Leg eine an oder tritt einer öffentlichen bei.
          </p>
        ) : (
          <div className="ufs-splist">
            {groups.map((g) => (
              <div key={g.id} className="ufs-grouprow">
                <button
                  type="button"
                  className="main"
                  style={{ textAlign: 'left', cursor: 'pointer', background: 'none', border: 0 }}
                  onClick={() => onOpen(g.id)}
                >
                  <span className="nm">{g.name}</span>
                  <span className="sub">
                    {VISIBILITY[g.visibility].title} · {g.members} Mitglieder
                    {g.owner ? ' · du bist Admin' : ` · von ${g.ownerName}`}
                  </span>
                </button>
                <button type="button" className="ufs-btn" onClick={() => onOpen(g.id)}>
                  Öffnen
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Neue Gruppe">
        <div className="ufs-row">
          <input
            value={name}
            maxLength={60}
            placeholder="Name der Gruppe"
            onChange={(e) => setName(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50"
            style={{ minWidth: '220px' }}
          />
          <select
            value={vis}
            onChange={(e) => setVis(e.target.value as Visibility)}
            className="rounded-xl border border-white/10 bg-[#0b1821] px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
          >
            {(Object.keys(VISIBILITY) as Visibility[]).map((v) => (
              <option key={v} value={v}>
                {VISIBILITY[v].title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ufs-btn primary"
            disabled={busy || !name.trim()}
            onClick={() => {
              run(api('/groups', { method: 'POST', json: { name: name.trim(), visibility: vis } }))
              setName('')
            }}
          >
            Anlegen
          </button>
        </div>
        <p className="ufs-muted" style={{ fontSize: '11.5px', lineHeight: 1.6, marginTop: '.5rem' }}>
          {VISIBILITY[vis].title}: {VISIBILITY[vis].hint}. Wer eine Gruppe anlegt, ist ihr Admin –
          verlässt er sie, wird sie aufgelöst.
        </p>
      </Card>

      <Card title="Mit Code beitreten">
        <div className="ufs-row">
          <input
            value={code}
            maxLength={6}
            placeholder="ABC123"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50"
            style={{ width: '150px', letterSpacing: '.2em' }}
          />
          <button
            type="button"
            className="ufs-btn"
            disabled={busy || !code.trim()}
            onClick={() => {
              run(api('/groups/join', { method: 'POST', json: { code: code.trim() } }))
              setCode('')
            }}
          >
            Beitreten
          </button>
        </div>
      </Card>

      <Card
        title="Öffentliche Gruppen"
        extra={
          <div className="ufs-row">
            <input
              value={q}
              placeholder="suchen …"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadDir()}
              className="rounded-2xl border border-white/10 bg-white/[.045] py-1.5 px-3 text-sm outline-none focus:border-cyan-400/50"
              style={{ width: '170px' }}
            />
            <Toggle active={false} onClick={loadDir}>
              Suchen
            </Toggle>
          </div>
        }
      >
        {!dir ? (
          <p className="ufs-muted" style={{ fontSize: '12px' }}>
            Wird geladen …
          </p>
        ) : !dir.length ? (
          <p className="ufs-muted" style={{ fontSize: '12px' }}>
            Keine öffentliche Gruppe gefunden.
          </p>
        ) : (
          <div className="ufs-splist">
            {dir.map((g) => (
              <div key={g.id} className="ufs-grouprow">
                <div className="main">
                  <span className="nm">{g.name}</span>
                  <span className="sub">
                    {fmtNum(g.members)} Mitglieder · von {g.ownerName}
                  </span>
                </div>
                {g.member ? (
                  <span className="ufs-chip">✓ dabei</span>
                ) : (
                  <button
                    type="button"
                    className="ufs-btn"
                    disabled={busy}
                    onClick={() => run(api('/groups/join', { method: 'POST', json: { id: g.id } }))}
                  >
                    Beitreten
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default GroupsPage
