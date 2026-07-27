import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { api } from '../../lib/api'
import { fmtNum } from '../../lib/format'
import { Card, Note } from '../ui'

interface Line {
  id: number
  name: string
  species: number
  fish: number
  updatedAt: string | null
}

/**
 * Who follows this angler, and whom they follow. Both lists are public — they
 * are the same numbers shown in the profile header.
 */
export function Follows({
  userId,
  name,
  self,
  onOpenUser,
}: {
  userId: number
  name: string
  self: boolean
  onOpenUser: (name: string) => void
}) {
  const { t } = useI18n()
  const [data, setData] = useState<{ followers: Line[]; following: Line[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    api<{ followers: Line[]; following: Line[] }>(`/users/${userId}/follows`)
      .then(setData)
      .catch((e: Error) => setErr(e.message))
  }, [userId])

  if (err) return <Note>{err}</Note>
  if (!data) return <p className="ufs-muted">{t('app.loading')}</p>

  return (
    <div className="ufs-two">
      <List
        title={self ? t('follows.followYou') : t('follows.followThem', { name })}
        rows={data.followers}
        empty={self ? t('follows.noneYou') : t('follows.noneOther')}
        onOpenUser={onOpenUser}
      />
      <List
        title={self ? t('follows.youFollow') : t('follows.theyFollow', { name })}
        rows={data.following}
        empty={self ? t('follows.youNone') : t('follows.otherNone')}
        onOpenUser={onOpenUser}
      />
    </div>
  )
}

function List({
  title,
  rows,
  empty,
  onOpenUser,
}: {
  title: string
  rows: Line[]
  empty: string
  onOpenUser: (name: string) => void
}) {
  const { t } = useI18n()

  return (
    <Card title={`${title} (${rows.length})`}>
      {!rows.length ? (
        <p className="ufs-muted" style={{ fontSize: '12.5px', margin: 0 }}>
          {empty}
        </p>
      ) : (
        <div className="ufs-splist">
          {rows.map((r) => (
            <div key={r.id} className="ufs-spline">
              <button
                type="button"
                className="n ufs-linkish"
                style={{ textAlign: 'left' }}
                onClick={() => onOpenUser(r.name)}
              >
                {r.name}
              </button>
              <span className="q">{t('follows.species', { n: fmtNum(r.species) })}</span>
              <span className="d">{t('follows.catches', { n: fmtNum(r.fish) })}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
