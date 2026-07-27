/**
 * The footer that every page carries: where the numbers come from, and the
 * links a site has to offer.
 *
 * The imprint is not part of this project - it belongs to whoever runs the
 * site, so its address comes in through the build. Where none is set the link
 * stays out rather than pointing nowhere.
 */
import { GAME, GUIDE } from '../../data'
import { API_AVAILABLE } from '../../lib/api'
import { useI18n } from '../../i18n'
import { DASH } from '../../lib/format'
import { IMPRINT_URL } from '../../lib/site'

const GITHUB = 'https://github.com/unserioes24/ufs-atlas'

export function SiteFooter({ onPrivacy }: { onPrivacy: () => void }) {
  const { t } = useI18n()

  return (
    <footer className="ufs-footer no-print">
      <p>{t('map.footer', { guide: GUIDE.generated, game: GAME.generated || DASH })}</p>
      <p className="links">
        {/* Privacy and imprint only mean something where there is a server. */}
        {API_AVAILABLE ? (
          <button type="button" className="ufs-link" onClick={onPrivacy}>
            {t('legal.privacy')}
          </button>
        ) : null}
        {API_AVAILABLE && IMPRINT_URL ? (
          <a href={IMPRINT_URL} className="ufs-link" target="_blank" rel="noreferrer">
            {t('legal.imprint')}
          </a>
        ) : null}
        <a href={GITHUB} className="ufs-link" target="_blank" rel="noreferrer">
          {t('legal.github')}
        </a>
      </p>
    </footer>
  )
}

export default SiteFooter
