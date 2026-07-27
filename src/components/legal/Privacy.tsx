/**
 * The privacy policy. Every claim on this page is checked against what the code
 * actually does; if the app changes, this has to change with it.
 *
 * The wording is a starting point, not legal advice. Whoever runs the site is
 * responsible for it and should have it looked over.
 */
import { useI18n } from '../../i18n'
import type { Key } from '../../i18n'
import { IMPRINT_URL, OPERATOR_MAIL } from '../../lib/site'

/** Heading plus paragraphs. A key with no text falls back to nothing shown. */
const SECTIONS: Array<{ title: Key; body: Key[] }> = [
  { title: 'privacy.responsibleTitle', body: ['privacy.responsibleText'] },
  { title: 'privacy.shortTitle', body: ['privacy.shortText'] },
  {
    title: 'privacy.localTitle',
    body: ['privacy.localText', 'privacy.localSave'],
  },
  {
    title: 'privacy.accountTitle',
    body: ['privacy.accountWhat', 'privacy.accountWhy', 'privacy.accountKeep'],
  },
  { title: 'privacy.publicTitle', body: ['privacy.publicText'] },
  { title: 'privacy.cookiesTitle', body: ['privacy.cookiesText'] },
  { title: 'privacy.logsTitle', body: ['privacy.logsText'] },
  { title: 'privacy.mailTitle', body: ['privacy.mailText'] },
  { title: 'privacy.thirdTitle', body: ['privacy.thirdText'] },
  { title: 'privacy.rightsTitle', body: ['privacy.rightsText'] },
]

export function Privacy() {
  const { t } = useI18n()

  return (
    <div style={{ maxWidth: '760px' }}>
      <p className="ufs-muted" style={{ fontSize: '12.5px', margin: '0 0 1.2rem' }}>
        {t('privacy.lead')}
      </p>

      {SECTIONS.map((s) => (
        <section key={s.title} className="ufs-spotcard" style={{ marginBottom: '.8rem' }}>
          <h3>{t(s.title)}</h3>
          {s.body.map((b) => (
            <p
              key={b}
              style={{ fontSize: '13px', lineHeight: 1.7, color: '#cbd5e1', margin: '.5rem 0 0' }}
            >
              {t(b)}
            </p>
          ))}
        </section>
      ))}

      <section className="ufs-spotcard">
        <h3>{t('privacy.contactTitle')}</h3>
        <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#cbd5e1', margin: '.5rem 0 0' }}>
          {OPERATOR_MAIL ? (
            <a href={'mailto:' + OPERATOR_MAIL} className="ufs-link">
              {OPERATOR_MAIL}
            </a>
          ) : (
            t('privacy.contactMissing')
          )}
        </p>
        {IMPRINT_URL ? (
          <p style={{ fontSize: '13px', margin: '.6rem 0 0' }}>
            <a href={IMPRINT_URL} className="ufs-link" target="_blank" rel="noreferrer">
              {t('legal.imprint')}
            </a>
          </p>
        ) : null}
      </section>
    </div>
  )
}

export default Privacy
