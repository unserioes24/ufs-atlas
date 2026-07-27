import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { cn, fmtNum, fmtTime } from '../../lib/format'
import { Card, Note } from '../ui'
import { VISIBILITY } from './GroupsPage'
import type { GroupDetail, Visibility } from './types'

/** The boards a group is ranked by, in the order they are shown. */
const BOARDS: Array<[string, string, (v: number) => string]> = [
  ['biggestFish', 'Schwerster Fisch', (v) => `${v.toFixed(2)} kg`],
  ['longestFish', 'Längster Fisch', (v) => `${Math.round(v * 100)} cm`],
  ['totalWeight', 'Meiste Masse gesamt', (v) => `${fmtNum(v, 1)} kg`],
  ['topSpeciesWeight', 'Meiste Masse einer Art', (v) => `${fmtNum(v, 1)} kg`],
  ['species', 'Meiste Arten', (v) => fmtNum(v)],
  ['fisheriesComplete', 'Komplette Reviere', (v) => fmtNum(v)],
  ['fish', 'Meiste Fänge', (v) => fmtNum(v)],
  ['time', 'Meiste Angelzeit', fmtTime],
]

export function GroupView({
  id,
  onChanged,
  onOpenUser,
  onBack,
}: {
  id: number
  onChanged: () => void
  onOpenUser: (name: string) => void
  onBack: () => void
}) {
  const [data, setData] = useState<GroupDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState(false)

  const load = useCallback(() => {
    setErr(null)
    api<GroupDetail>(`/groups/${id}`)
      .then(setData)
      .catch((e: Error) => setErr(e.message))
  }, [id])

  useEffect(load, [load])

  function run(p: Promise<unknown>, after?: () => void) {
    setBusy(true)
    p.then(() => (after ? after() : load()))
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false))
  }

  if (err) return <Note>{err}</Note>
  if (!data) return <p className="ufs-muted">Wird geladen …</p>

  const g = data.group
  const names = data.meta.speciesNames

  return (
    <div className="space-y-4">
      <div className="ufs-profhead">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white" style={{ margin: 0 }}>
            {g.name}
          </h1>
          <p className="ufs-muted" style={{ fontSize: '12px', margin: '.25rem 0 0' }}>
            {VISIBILITY[g.visibility].title} · {g.members} Mitglieder · Admin{' '}
            <button
              type="button"
              className="ufs-linkish"
              onClick={() => onOpenUser(g.ownerName)}
            >
              {g.ownerName}
            </button>
            {g.code ? ` · Code ${g.code}` : ''}
          </p>
        </div>
        <div className="ufs-row no-print">
          {g.owner ? (
            <button type="button" className="ufs-btn" onClick={() => setEdit(!edit)}>
              {edit ? 'Fertig' : 'Bearbeiten'}
            </button>
          ) : null}
          <button
            type="button"
            className="ufs-btn"
            disabled={busy}
            onClick={() => {
              const q = g.owner
                ? `Du bist Admin von „${g.name}“. Verlässt du die Gruppe, wird sie aufgelöst. Fortfahren?`
                : `Die Gruppe „${g.name}“ wirklich verlassen?`
              if (!confirm(q)) return
              run(api(`/groups/${g.id}/leave`, { method: 'POST' }), onChanged)
            }}
          >
            Verlassen
          </button>
          {g.owner ? (
            <button
              type="button"
              className="ufs-btn danger"
              disabled={busy}
              onClick={() => {
                if (!confirm(`Die Gruppe „${g.name}“ endgültig auflösen?`)) return
                run(api(`/groups/${g.id}`, { method: 'DELETE' }), onChanged)
              }}
            >
              Gruppe löschen
            </button>
          ) : null}
          <button type="button" className="ufs-btn" onClick={onBack}>
            ← Alle Gruppen
          </button>
        </div>
      </div>

      {edit && g.owner ? <GroupEdit group={g} busy={busy} onSave={(patch) => run(api(`/groups/${g.id}`, { method: 'POST', json: patch }))} /> : null}

      <div className="ufs-two">
        {BOARDS.map(([key, title, fmt]) => {
          const rows = data.boards[key] ?? []
          return (
            <Card key={key} title={title}>
              {rows.length ? (
                <div className="ufs-splist">
                  {rows.map((r, i) => (
                    <div key={r.id} className={cn('ufs-spline', r.self && 'pin')}>
                      <span className="n">
                        {i + 1}. {r.name}
                      </span>
                      <span className="q">{fmt(r.value)}</span>
                      <span className="d">{r.label ? (names[r.label] ?? r.label) : ''}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ufs-muted" style={{ fontSize: '12px', margin: 0 }}>
                  Noch keine Daten
                </p>
              )}
            </Card>
          )
        })}
      </div>

      <Card title="Mitglieder">
        <div className="ufs-scroll">
          <table className="ufs-rec">
            <thead>
              <tr>
                <th>Angler</th>
                <th>Arten</th>
                <th>Reviere komplett</th>
                <th>Fänge</th>
                <th>Masse</th>
                <th>Schwerster</th>
                <th>Stand</th>
                {g.owner ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id}>
                  <td
                    className={cn('n', m.self && 'done')}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onOpenUser(m.name)}
                  >
                    {m.self ? '▸ ' : ''}
                    {m.name}
                    {m.admin ? <span className="hint">Admin</span> : null}
                  </td>
                  <td className="num">{fmtNum(m.species)}</td>
                  <td className="num">{fmtNum(m.fisheriesComplete)}</td>
                  <td className="num">{fmtNum(m.fish)}</td>
                  <td className="num">{fmtNum(m.weight, 1)} kg</td>
                  <td className="num">{m.bigW ? `${m.bigW.toFixed(2)} kg` : '–'}</td>
                  <td className="sub">{m.updatedAt ? m.updatedAt.slice(0, 10) : 'kein Profil'}</td>
                  {g.owner ? (
                    <td className="sub">
                      {m.admin ? null : (
                        <button
                          type="button"
                          className="ufs-btn"
                          disabled={busy}
                          onClick={() => {
                            if (!confirm(`${m.name} aus der Gruppe entfernen?`)) return
                            run(api(`/groups/${g.id}/kick/${m.id}`, { method: 'POST' }))
                          }}
                        >
                          Entfernen
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function GroupEdit({
  group,
  busy,
  onSave,
}: {
  group: { name: string; visibility: Visibility }
  busy: boolean
  onSave: (patch: Record<string, unknown>) => void
}) {
  const [name, setName] = useState(group.name)
  const [vis, setVis] = useState<Visibility>(group.visibility)

  return (
    <Card title="Gruppe bearbeiten">
      <div className="ufs-row">
        <input
          value={name}
          maxLength={60}
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
          disabled={busy}
          onClick={() => onSave({ name, visibility: vis })}
        >
          Speichern
        </button>
        <button
          type="button"
          className="ufs-btn"
          disabled={busy}
          title="Der alte Code gilt danach nicht mehr"
          onClick={() => onSave({ newCode: true })}
        >
          Neuer Code
        </button>
      </div>
      <p className="ufs-muted" style={{ fontSize: '11.5px', lineHeight: 1.6, margin: '.4rem 0 0' }}>
        {VISIBILITY[vis].title}: {VISIBILITY[vis].hint}.
      </p>
    </Card>
  )
}
