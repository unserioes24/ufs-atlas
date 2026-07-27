import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { api, API_AVAILABLE } from '../../lib/api'
import { fmtNum } from '../../lib/format'
import { Card, Note, SideMenu, Toggle, WithSideMenu } from '../ui'
import type { MenuItem } from '../ui'
import { Select } from '../primitives'
import { GroupView } from './GroupView'
import type { Group, Visibility } from './types'
import { VISIBILITIES, VIS_HINT, VIS_TITLE } from './visibility'

/**
 * Groups, with the same side menu as the fishery list: your groups on the
 * left, everything about the selected one on the right. Below the list sit
 * the two ways in — the public directory and a join code.
 */

interface Props {
  me: { id: number; name: string } | null
  /** Group taken from the address bar, if any. */
  openId: number | null
  onOpen: (id: number | null) => void
  onOpenUser: (name: string) => void
  onLogin: () => void
}

export function GroupsPage({ me, openId, onOpen, onOpenUser, onLogin }: Props) {
  const { t } = useI18n()
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
    return <Note>{t('group.needsServer', { url: 'https://ufs-atlas.de' })}</Note>
  }
  if (!me) {
    return (
      <Note>
        {t('group.needsAccount')}{' '}
        <button type="button" className="ufs-btn" onClick={onLogin}>
          {t('auth.title')}
        </button>
      </Note>
    )
  }

  const items: MenuItem[] = [
    { key: 'uebersicht', title: t('group.yours'), sub: t('group.count', { n: groups?.length ?? 0 }) },
    ...(groups ?? []).map((g) => ({
      key: String(g.id),
      title: g.name,
      sub:
        t('group.memberCount', { n: g.members }) +
        (g.owner ? ` · ${t('group.youAreAdmin')}` : ''),
    })),
    { key: 'suchen', title: t('group.join'), sub: t('group.directory') },
  ]
  const active = openId ? String(openId) : 'uebersicht'

  return (
    <WithSideMenu
      menu={
        <SideMenu
          heading={t('group.title')}
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
  const { t } = useI18n()
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

  const visLabels = Object.fromEntries(VISIBILITIES.map((v) => [v, t(VIS_TITLE[v])])) as Record<
    Visibility,
    string
  >

  return (
    <div className="space-y-4">
      {err ? <Note>{err}</Note> : null}

      <Card title={t('group.yours')}>
        {!groups ? (
          <p className="ufs-muted" style={{ fontSize: '12.5px', margin: 0 }}>
            {t('app.loading')}
          </p>
        ) : !groups.length ? (
          <p className="ufs-muted" style={{ fontSize: '12.5px', margin: 0 }}>
            {t('group.noneYet')}
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
                    {t(VIS_TITLE[g.visibility])} · {t('group.memberCount', { n: g.members })} ·{' '}
                    {g.owner ? t('group.youAreAdmin') : t('group.byOwner', { name: g.ownerName })}
                  </span>
                </button>
                <button type="button" className="ufs-btn" onClick={() => onOpen(g.id)}>
                  {t('group.open')}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t('group.create')}>
        <div className="ufs-row">
          <input
            value={name}
            maxLength={60}
            placeholder={t('group.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/[.045] py-2 px-4 text-sm outline-none focus:border-cyan-400/50"
            style={{ minWidth: '220px' }}
          />
          <Select value={vis} onChange={setVis} options={VISIBILITIES} labels={visLabels} />
          <button
            type="button"
            className="ufs-btn primary"
            disabled={busy || !name.trim()}
            onClick={() => {
              run(api('/groups', { method: 'POST', json: { name: name.trim(), visibility: vis } }))
              setName('')
            }}
          >
            {t('group.create')}
          </button>
        </div>
        <p className="ufs-muted" style={{ fontSize: '11.5px', lineHeight: 1.6, marginTop: '.5rem' }}>
          {t(VIS_TITLE[vis])}: {t(VIS_HINT[vis])}. {t('group.createHint')}
        </p>
      </Card>

      <Card title={t('group.joinWithCode')}>
        <div className="ufs-row">
          <input
            value={code}
            maxLength={6}
            placeholder={t('group.codePlaceholder')}
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
            {t('group.join')}
          </button>
        </div>
      </Card>

      <Card
        title={t('group.directory')}
        extra={
          <div className="ufs-row">
            <input
              value={q}
              placeholder={t('group.search')}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadDir()}
              className="rounded-2xl border border-white/10 bg-white/[.045] py-1.5 px-3 text-sm outline-none focus:border-cyan-400/50"
              style={{ width: '170px' }}
            />
            <Toggle active={false} onClick={loadDir}>
              {t('group.searchGo')}
            </Toggle>
          </div>
        }
      >
        {!dir ? (
          <p className="ufs-muted" style={{ fontSize: '12px' }}>
            {t('app.loading')}
          </p>
        ) : !dir.length ? (
          <p className="ufs-muted" style={{ fontSize: '12px' }}>
            {t('group.noneFound')}
          </p>
        ) : (
          <div className="ufs-splist">
            {dir.map((g) => (
              <div key={g.id} className="ufs-grouprow">
                <div className="main">
                  <span className="nm">{g.name}</span>
                  <span className="sub">
                    {t('group.memberCount', { n: fmtNum(g.members) })} ·{' '}
                    {t('group.byOwner', { name: g.ownerName })}
                  </span>
                </div>
                {g.member ? (
                  <span className="ufs-chip">{t('group.alreadyIn')}</span>
                ) : (
                  <button
                    type="button"
                    className="ufs-btn"
                    disabled={busy}
                    onClick={() => run(api('/groups/join', { method: 'POST', json: { id: g.id } }))}
                  >
                    {t('group.join')}
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
