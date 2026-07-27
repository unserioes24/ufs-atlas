import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import type { Key } from '../../i18n'
import { api } from '../../lib/api'
import { cn, fmtNum, fmtTime } from '../../lib/format'
import { Select } from '../primitives'
import { Card, Note } from '../ui'
import type { GroupDetail, Visibility } from './types'
import { VISIBILITIES, VIS_HINT, VIS_TITLE } from './visibility'

/** The boards a group is ranked by, in the order they are shown. */
const BOARDS: Array<[string, Key, (v: number) => string]> = [
  ['biggestFish', 'board.biggestFish', (v) => `${v.toFixed(2)} kg`],
  ['longestFish', 'board.longestFish', (v) => `${Math.round(v * 100)} cm`],
  ['totalWeight', 'board.totalWeight', (v) => `${fmtNum(v, 1)} kg`],
  ['topSpeciesWeight', 'board.topSpeciesWeight', (v) => `${fmtNum(v, 1)} kg`],
  ['species', 'board.species', (v) => fmtNum(v)],
  ['fisheriesComplete', 'board.fisheriesComplete', (v) => fmtNum(v)],
  ['fish', 'board.fish', (v) => fmtNum(v)],
  ['time', 'board.time', fmtTime],
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
  const { t } = useI18n()
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
  if (!data) return <p className="ufs-muted">{t('app.loading')}</p>

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
            {t(VIS_TITLE[g.visibility])} · {t('group.memberCount', { n: g.members })} ·{' '}
            {t('group.admin')}{' '}
            <button type="button" className="ufs-linkish" onClick={() => onOpenUser(g.ownerName)}>
              {g.ownerName}
            </button>
            {g.code ? ` · ${t('group.code', { code: g.code })}` : ''}
          </p>
        </div>
        <div className="ufs-row no-print">
          {g.owner ? (
            <button type="button" className="ufs-btn" onClick={() => setEdit(!edit)}>
              {edit ? t('group.done') : t('group.edit')}
            </button>
          ) : null}
          <button
            type="button"
            className="ufs-btn"
            disabled={busy}
            onClick={() => {
              const q = g.owner
                ? t('group.confirmLeaveAdmin', { name: g.name })
                : t('group.confirmLeave', { name: g.name })
              if (!confirm(q)) return
              run(api(`/groups/${g.id}/leave`, { method: 'POST' }), onChanged)
            }}
          >
            {t('group.leave')}
          </button>
          {g.owner ? (
            <button
              type="button"
              className="ufs-btn danger"
              disabled={busy}
              onClick={() => {
                if (!confirm(t('group.confirmDelete', { name: g.name }))) return
                run(api(`/groups/${g.id}`, { method: 'DELETE' }), onChanged)
              }}
            >
              {t('group.delete')}
            </button>
          ) : null}
          <button type="button" className="ufs-btn" onClick={onBack}>
            {t('group.allGroups')}
          </button>
        </div>
      </div>

      {edit && g.owner ? (
        <GroupEdit
          group={g}
          busy={busy}
          onSave={(patch) => run(api(`/groups/${g.id}`, { method: 'POST', json: patch }))}
        />
      ) : null}

      <div className="ufs-two">
        {BOARDS.map(([key, title, fmt]) => {
          const rows = data.boards[key] ?? []
          return (
            <Card key={key} title={t(title)}>
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
                  {t('group.noData')}
                </p>
              )}
            </Card>
          )
        })}
      </div>

      <Card title={t('group.members')}>
        <div className="ufs-scroll">
          <table className="ufs-rec">
            <thead>
              <tr>
                <th>{t('col.angler')}</th>
                <th>{t('col.species')}</th>
                <th>{t('col.fisheriesComplete')}</th>
                <th>{t('col.catches')}</th>
                <th>{t('col.weight')}</th>
                <th>{t('col.heaviest')}</th>
                <th>{t('col.state')}</th>
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
                    {m.admin ? <span className="hint">{t('group.admin')}</span> : null}
                  </td>
                  <td className="num">{fmtNum(m.species)}</td>
                  <td className="num">{fmtNum(m.fisheriesComplete)}</td>
                  <td className="num">{fmtNum(m.fish)}</td>
                  <td className="num">{fmtNum(m.weight, 1)} kg</td>
                  <td className="num">{m.bigW ? `${m.bigW.toFixed(2)} kg` : '–'}</td>
                  <td className="sub">
                    {m.updatedAt ? m.updatedAt.slice(0, 10) : t('col.noProfile')}
                  </td>
                  {g.owner ? (
                    <td className="sub">
                      {m.admin ? null : (
                        <button
                          type="button"
                          className="ufs-btn"
                          disabled={busy}
                          onClick={() => {
                            if (!confirm(t('group.confirmKick', { name: m.name }))) return
                            run(api(`/groups/${g.id}/kick/${m.id}`, { method: 'POST' }))
                          }}
                        >
                          {t('group.kick')}
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
  const { t } = useI18n()
  const [name, setName] = useState(group.name)
  const [vis, setVis] = useState<Visibility>(group.visibility)
  const labels = Object.fromEntries(VISIBILITIES.map((v) => [v, t(VIS_TITLE[v])])) as Record<
    Visibility,
    string
  >

  return (
    <Card title={t('group.editTitle')}>
      <div className="ufs-row">
        <input
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          className="rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50"
          style={{ minWidth: '220px' }}
        />
        <Select value={vis} onChange={setVis} options={VISIBILITIES} labels={labels} />
        <button
          type="button"
          className="ufs-btn primary"
          disabled={busy}
          onClick={() => onSave({ name, visibility: vis })}
        >
          {t('app.save')}
        </button>
        <button
          type="button"
          className="ufs-btn"
          disabled={busy}
          title={t('group.newCodeHint')}
          onClick={() => onSave({ newCode: true })}
        >
          {t('group.newCode')}
        </button>
      </div>
      <p className="ufs-muted" style={{ fontSize: '11.5px', lineHeight: 1.6, margin: '.4rem 0 0' }}>
        {t(VIS_TITLE[vis])}: {t(VIS_HINT[vis])}.
      </p>
    </Card>
  )
}
