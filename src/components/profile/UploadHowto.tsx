/**
 * How to make the upload happen by itself, per system.
 *
 * The command is always the same one curl call; what differs is who runs it on
 * a schedule. Windows has the task scheduler, macOS and Linux have cron. Under
 * Proton the save file sits inside the prefix, which is why the Linux path looks
 * the way it does.
 *
 * Every block is a copyable command, because a tutorial you have to retype is
 * a tutorial nobody follows.
 */
import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { Key } from '../../i18n'

export interface UploadHowtoProps {
  token: string
  /** Profile slot the person picked: 0, 1 or 2. */
  slot: number
}

type Os = 'win' | 'mac' | 'linux'

const TABS: Array<{ os: Os; label: Key }> = [
  { os: 'win', label: 'paths.windows' },
  { os: 'mac', label: 'paths.mac' },
  { os: 'linux', label: 'paths.linux' },
]

function CopyBlock({ text }: { text: string }) {
  const { t } = useI18n()
  const [done, setDone] = useState(false)
  return (
    <div>
      <pre className="ufs-cmd">{text}</pre>
      <button
        className="ufs-btn"
        style={{ padding: '.12rem .6rem', fontSize: '11px' }}
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setDone(true)
            window.setTimeout(() => setDone(false), 1600)
          })
        }}
      >
        {done ? t('app.copied') : t('app.copy')}
      </button>
    </div>
  )
}

export function UploadHowto({ token, slot }: UploadHowtoProps) {
  const { t } = useI18n()
  const [os, setOs] = useState<Os>('win')
  const url = location.origin + '/api/profile/upload'

  // Windows: one scheduled task, running every two hours. The save file is
  // written when the game saves, so a fixed interval is enough.
  const win = [
    'schtasks /create /tn "UFS Atlas Upload" /sc hourly /mo 2 /f /tr ^',
    '  "curl.exe -s -H \\"X-Api-Token: ' + token + '\\" ^',
    '   --data-binary @\\"%UserProfile%\\AppData\\LocalLow\\PlayWay\\UltimateFishing\\PROFILE_' +
      slot +
      '\\" ^',
    '   ' + url + '"',
  ].join('\n')

  const mac =
    '# crontab -e, then add this line (every two hours):\n' +
    '0 */2 * * * /usr/bin/curl -s -H "X-Api-Token: ' +
    token +
    '" \\\n' +
    '  --data-binary "@$HOME/Library/Application Support/PlayWay/UltimateFishing/PROFILE_' +
    slot +
    '" \\\n  ' +
    url

  const linux =
    '# crontab -e, then add this line (every two hours):\n' +
    '0 */2 * * * /usr/bin/curl -s -H "X-Api-Token: ' +
    token +
    '" \\\n' +
    '  --data-binary "@$HOME/.steam/steam/steamapps/compatdata/468920/pfx/drive_c/users/steamuser/AppData/LocalLow/PlayWay/UltimateFishing/PROFILE_' +
    slot +
    '" \\\n  ' +
    url

  const note: Key = os === 'win' ? 'howto.winNote' : os === 'mac' ? 'howto.macNote' : 'howto.linuxNote'

  return (
    <div>
      <div className="ufs-row" style={{ gap: '.4rem', marginBottom: '.6rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab.os}
            className={'ufs-btn' + (os === tab.os ? ' primary' : '')}
            style={{ padding: '.15rem .7rem' }}
            onClick={() => setOs(tab.os)}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>
      <p className="ufs-muted" style={{ fontSize: '12px', lineHeight: 1.6, margin: '0 0 .5rem' }}>
        {t(note)}
      </p>
      <CopyBlock text={os === 'win' ? win : os === 'mac' ? mac : linux} />
      <p className="ufs-muted" style={{ fontSize: '11.5px', lineHeight: 1.6, margin: '.7rem 0 0' }}>
        {t('howto.tail')}
      </p>
    </div>
  )
}

export default UploadHowto
