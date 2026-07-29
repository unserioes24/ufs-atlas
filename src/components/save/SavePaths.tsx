/**
 * Where the game keeps its save files, per system, each with a copy button.
 *
 * Windows is the plain Unity path. On Linux the game runs under Proton, so the
 * files sit inside the prefix of app 468920 – that number is the Steam app id of
 * Ultimate Fishing Simulator, taken from its appmanifest. macOS follows Unity's
 * own convention for a native build.
 */
import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { Key } from '../../i18n'

export interface SavePath {
  label: Key
  path: string
}

export const SAVE_PATHS: SavePath[] = [
  { label: 'paths.windows', path: '%UserProfile%\\AppData\\LocalLow\\PlayWay\\UltimateFishing' },
  { label: 'paths.mac', path: '~/Library/Application Support/PlayWay/UltimateFishing' },
  {
    label: 'paths.linux',
    path: '~/.steam/steam/steamapps/compatdata/468920/pfx/drive_c/users/steamuser/AppData/LocalLow/PlayWay/UltimateFishing',
  },
]

export function PathRow({ label, path }: SavePath) {
  const { t } = useI18n()
  const [done, setDone] = useState(false)

  function copy() {
    void navigator.clipboard?.writeText(path).then(() => {
      setDone(true)
      window.setTimeout(() => setDone(false), 1600)
    })
  }

  return (
    <div className="ufs-pathrow">
      <span className="os">{t(label)}</span>
      <code>{path}</code>
      <button className="ufs-btn" onClick={copy} title={t('paths.copy')}>
        {done ? t('app.copied') : t('app.copy')}
      </button>
    </div>
  )
}

/** All three systems at once. */
export function SavePathList() {
  return (
    <div className="ufs-paths">
      {SAVE_PATHS.map((p) => (
        <PathRow key={p.path} {...p} />
      ))}
    </div>
  )
}

export default SavePathList
