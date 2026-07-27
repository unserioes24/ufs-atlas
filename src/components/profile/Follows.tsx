import { useEffect, useState } from 'react'
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
  const [data, setData] = useState<{ followers: Line[]; following: Line[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    api<{ followers: Line[]; following: Line[] }>(`/users/${userId}/follows`)
      .then(setData)
      .catch((e: Error) => setErr(e.message))
  }, [userId])

  if (err) return <Note>{err}</Note>
  if (!data) return <p className="ufs-muted">Wird geladen …</p>

  return (
    <div className="ufs-two">
      <List
        title={self ? 'Folgen dir' : `Folgen ${name}`}
        rows={data.followers}
        empty={self ? 'Dir folgt noch niemand.' : 'Diesem Profil folgt noch niemand.'}
        onOpenUser={onOpenUser}
      />
      <List
        title={self ? 'Du folgst' : `${name} folgt`}
        rows={data.following}
        empty={self ? 'Du folgst noch niemandem.' : 'Dieses Profil folgt noch niemandem.'}
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
              <span className="q">{fmtNum(r.species)} Arten</span>
              <span className="d">{fmtNum(r.fish)} Fänge</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
