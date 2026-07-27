/**
 * An angler's profile page. Signed out it shows the figures alone; signed in it
 * puts both profiles side by side, value for value.
 *
 * The section is part of the address (#angler/<name>/gruppen), so a single tab
 * can be linked to.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { speciesName } from '../../data'
import { API_AVAILABLE, api } from '../../lib/api'
import { useI18n } from '../../i18n'
import { cn, fmtAgo, fmtNum, fmtWhen } from '../../lib/format'
import { profileUrl } from '../../lib/profile'
import type { DuelFilter, ProfileGroup, ProfileResponse } from '../../lib/profile'
import type { LocalState } from '../../types'
import { Follows } from './Follows'
import { AccountPanel } from './AccountPanel'
import type { Account } from './AccountPanel'
import { ProfileDetails } from './ProfileDetails'
import { ProfileDuel } from './ProfileDuel'
import type { DuelSpeciesRow } from './ProfileDuel'

export interface ProfilePageProps {
  name: string
  tab?: string
  onTab: (tab: string) => void
  me: Account | null
  local: LocalState | null
  onMe: (user: Account) => void
  onLogout: () => void
  onBack: () => void
  onOpenGroups: () => void
  onOpenUser: (name: string) => void
}

export function ProfilePage({
  name,
  tab = 'uebersicht',
  onTab,
  me,
  local,
  onMe,
  onLogout,
  onBack,
  onOpenGroups,
  onOpenUser,
}: ProfilePageProps) {
  const { t, lang } = useI18n()
  const [data, setData] = useState<ProfileResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [filter, setFilter] = useState<DuelFilter>('diff')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    if (!name) return
    api<ProfileResponse>('/users/name/' + encodeURIComponent(name))
      .then(setData)
      .catch((e: Error) => setErr(e.message))
  }, [name])

  useEffect(() => {
    setData(null)
    setErr(null)
    load()
  }, [load, me?.name])

  const p = data?.profile ?? null
  const mine = data?.me?.profile ?? null
  const duel = !!(p && mine && !data?.self)

  /* The species comparison: both lists merged, so the gaps stand out too. */
  const rows: DuelSpeciesRow[] = useMemo(() => {
    if (!duel || !p || !mine) return []
    const keys = new Set([...Object.keys(p.species), ...Object.keys(mine.species)])
    return [...keys]
      .map((k) => ({
        k,
        name: speciesName(k, lang),
        a: p.species[k] ?? null,
        b: mine.species[k] ?? null,
      }))
      .sort((x, y) => x.name.localeCompare(y.name, lang))
  }, [duel, p, mine, lang])

  const shown = rows.filter((r) => {
    const aw = r.a ? r.a.best : 0
    const bw = r.b ? r.b.best : 0
    if (filter === 'his') return !!r.a && !r.b
    if (filter === 'mine') return !!r.b && !r.a
    if (filter === 'both') return !!(r.a && r.b)
    if (filter === 'lead') return !!(r.b && (!r.a || bw > aw + 0.0005))
    if (filter === 'behind') return !!(r.a && (!r.b || aw > bw + 0.0005))
    if (filter === 'diff') {
      return !r.a || !r.b || Math.abs(aw - bw) > 0.0005 || r.a.count !== r.b.count
    }
    return true
  })

  function copy() {
    const url = profileUrl(data ? data.user.name : name)
    const done = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(done, () => prompt(t('profile.copyPrompt'), url))
    } else prompt(t('profile.copyPrompt'), url)
  }

  function toggleFollow() {
    if (!data || !me) return
    setBusy(true)
    api('/follow/' + data.user.id, { method: data.following ? 'DELETE' : 'POST' })
      .then(() => setData({ ...data, following: !data.following }))
      .catch((e: Error) => setErr(e.message))
      .then(() => setBusy(false))
  }

  if (!API_AVAILABLE) {
    return <div className="ufs-note">{t('profile.needsServer', { url: 'https://ufs-atlas.de' })}</div>
  }

  // Menu items: what a stranger's profile has nothing to show for falls away.
  const self = !!data?.self
  const items = [
    {
      k: 'uebersicht',
      label: t('profile.overview'),
      sub: p ? t('profile.nSpecies', { n: fmtNum(p.speciesCount) }) : t('profile.noSaveYet'),
    },
    p && {
      k: 'reviere',
      label: t('nav.fisheries'),
      sub: t('profile.nComplete', { n: fmtNum(p.fisheriesComplete) }),
    },
    p && {
      k: 'arten',
      label: t('nav.species'),
      sub: t('profile.nRecords', { n: fmtNum(Object.keys(p.species).length) }),
    },
    p &&
      data && {
        k: 'offen',
        label: t('profile.missing'),
        sub: t('profile.nSpecies', { n: data.meta.totalSpecies - p.speciesCount }),
      },
    duel && { k: 'vergleich', label: t('profile.duel'), sub: t('profile.nSpecies', { n: rows.length }) },
    {
      k: 'follower',
      label: t('profile.followers'),
      sub: t('profile.menuFollow', {
        followers: data?.followers ?? 0,
        follows: data?.follows ?? 0,
      }),
    },
    {
      k: 'gruppen',
      label: t('profile.groups'),
      sub: t('profile.nPieces', { n: data?.groups?.length ?? 0 }),
    },
    self && { k: 'konto', label: t('profile.settings'), sub: t('profile.settingsSub') },
  ].filter(Boolean) as Array<{ k: string; label: string; sub: string }>

  const active = items.some((x) => x.k === tab) ? tab : 'uebersicht'

  if (!data) {
    return (
      <div>
        <div className="ufs-row no-print" style={{ marginBottom: '.9rem' }}>
          <button className="ufs-btn" onClick={onBack}>
            {t('app.back')}
          </button>
        </div>
        {err ? (
          <div className="ufs-note">{err}</div>
        ) : (
          <p className="ufs-muted">{t('profile.loading')}</p>
        )}
      </div>
    )
  }

  // The same column split as the fishery view; the class comes from the
  // pre-built Tailwind stylesheet and must not be changed.
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="no-print self-start lg:sticky lg:top-24">
        <div className="glass scrollbar max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl border border-white/10 p-3 shadow-2xl">
          <div className="px-3 pb-2 pt-2 text-xs font-bold uppercase tracking-[.18em] text-slate-500">
            {self ? t('profile.yours') : t('profile.other')}
          </div>
          <div className="space-y-1">
            {items.map((it) => (
              <button
                key={it.k}
                onClick={() => onTab(it.k)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition',
                  active === it.k
                    ? 'border border-cyan-300/20 bg-cyan-400/10'
                    : 'border border-transparent hover:bg-white/[.045]',
                )}
              >
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    active === it.k ? 'bg-cyan-300/70' : 'bg-slate-600',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-200">
                    {it.label}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">{it.sub}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="ufs-menuactions">
            <button className="ufs-btn" style={{ width: '100%' }} onClick={copy}>
              {copied ? t('app.copied') : t('profile.copyLink')}
            </button>
            {me && !self ? (
              <button
                className={cn('ufs-btn', data.following && 'primary')}
                style={{ width: '100%' }}
                disabled={busy}
                onClick={toggleFollow}
              >
                {data.following ? t('profile.following') : t('profile.follow')}
              </button>
            ) : null}
            <button className="ufs-btn" style={{ width: '100%' }} onClick={onBack}>
              {t('app.back')}
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {err ? (
          <div className="ufs-note" style={{ marginBottom: '.9rem' }}>
            {err}
          </div>
        ) : null}
        <div className="ufs-profhead">
          <div>
            <h1
              className="text-2xl font-black tracking-tight text-white"
              style={{ margin: 0 }}
            >
              {data.user.name}
            </h1>
            <p className="ufs-muted" style={{ fontSize: '12px', margin: '.25rem 0 0' }}>
              {p
                ? t('profile.anglerLine', { name: p.anglerName || data.user.name }) +
                  (p.version ? t('profile.saveVersion', { version: p.version }) : '')
                : t('profile.noSave')}
            </p>
          </div>
          <div className="ufs-row" style={{ gap: '.5rem' }}>
            <span className="ufs-chip" title={t('account.followersOf')}>
              {t('profile.followerCount')} <b>{fmtNum(data.followers || 0)}</b>
            </span>
            <span className="ufs-chip" title={t('account.followsOf')}>
              {t('profile.followsCount')} <b>{fmtNum(data.follows || 0)}</b>
            </span>
            {p ? (
              <span className="ufs-stand">
                <span className="lbl">{t('profile.saveState')}</span>
                <span className="val">{fmtWhen(p.updatedAt)}</span>
                <span className="sub">{fmtAgo(p.updatedAt)}</span>
              </span>
            ) : null}
          </div>
        </div>

        {active === 'gruppen' ? (
          <ProfileGroupList groups={data.groups ?? []} self={self} onOpenGroups={onOpenGroups} />
        ) : active === 'follower' ? (
          <Follows userId={data.user.id} name={data.user.name} self={self} onOpenUser={onOpenUser} />
        ) : active === 'konto' && me ? (
          <AccountPanel
            me={me}
            local={local}
            onMe={onMe}
            onLogout={onLogout}
            onOpenUser={onOpenUser}
          />
        ) : active === 'vergleich' && duel && p && mine ? (
          <ProfileDuel
            data={data}
            p={p}
            mine={mine}
            rows={shown}
            all={rows}
            filter={filter}
            onFilter={setFilter}
          />
        ) : !p ? (
          <div className="ufs-note">{t('profile.noSaveOther')}</div>
        ) : (
          <ProfileDetails p={p} data={data} tab={active} />
        )}

        {active === 'uebersicht' && !me ? (
          <div className="ufs-note no-print" style={{ marginTop: '.9rem' }}>
            {t('profile.duelSignIn', { name: data.user.name })}
          </div>
        ) : null}
        {active === 'uebersicht' && me && p && !mine && !self ? (
          <div className="ufs-note" style={{ marginTop: '.9rem' }}>
            {t('profile.duelNoSave')}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** The groups a profile is in; managing them happens on the groups page. */
function ProfileGroupList({
  groups,
  self,
  onOpenGroups,
}: {
  groups: ProfileGroup[]
  self: boolean
  onOpenGroups: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="ufs-spotcard">
      <div
        className="ufs-row"
        style={{ justifyContent: 'space-between', marginBottom: '.6rem' }}
      >
        <h3 style={{ margin: 0 }}>{self ? t('profile.yourGroups') : t('profile.groups')}</h3>
        {self ? (
          <button className="ufs-btn" onClick={onOpenGroups}>
            {t('account.manageGroups')}
          </button>
        ) : null}
      </div>
      {!groups.length ? (
        <p className="ufs-muted" style={{ fontSize: '12.5px', margin: 0 }}>
          {self ? t('account.notInGroup') : t('profile.noPublicGroup')}
        </p>
      ) : (
        <div className="ufs-splist">
          {groups.map((g) => (
            <div key={g.id} className="ufs-grouprow">
              <div className="main">
                <span className="nm">{g.name}</span>
                <span className="sub">
                  {t('profile.membersOf', { n: g.members }) +
                    (g.owner
                      ? t('profile.youAreAdmin')
                      : t('profile.byOwner', { name: g.ownerName }))}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProfilePage
