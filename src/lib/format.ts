/**
 * Numbers, durations and timestamps.
 *
 * No wording lives here: the locale decides how a number is grouped and how
 * "3 days ago" reads. The active locale is set once by the i18n provider, so
 * these stay plain functions that can be called from anywhere.
 */

let locale = 'de-DE'

const LOCALES: Record<string, string> = {
  de: 'de-DE',
  en: 'en-GB',
}

export function setFormatLocale(lang: string): void {
  locale = LOCALES[lang] ?? lang
}

/** Placeholder for "no value" — a dash reads the same in every language. */
export const DASH = '–'

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return DASH
  return n.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Seconds as time spent fishing, e.g. "12 h 30 min". */
export function fmtTime(sec: number | null | undefined): string {
  if (!sec) return DASH
  const hours = Math.floor(sec / 3600)
  const min = Math.round((sec % 3600) / 60)
  const parts: string[] = []
  if (hours) parts.push(`${fmtNum(hours)} h`)
  parts.push(`${min} min`)
  return parts.join(' ')
}

export function fmtWhen(iso: string | null | undefined): string {
  const t = Date.parse(iso ?? '')
  if (Number.isNaN(t)) return DASH
  return new Date(t).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Distance from now in words. Intl does the wording, so this needs no
 * translation of its own.
 */
export function fmtAgo(iso: string | null | undefined): string {
  const t = Date.parse(iso ?? '')
  if (Number.isNaN(t)) return DASH
  const rel = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const sec = Math.round((t - Date.now()) / 1000)
  const abs = Math.abs(sec)
  if (abs < 90) return rel.format(Math.round(sec), 'second')
  if (abs < 5400) return rel.format(Math.round(sec / 60), 'minute')
  if (abs < 172800) return rel.format(Math.round(sec / 3600), 'hour')
  if (abs < 2592000) return rel.format(Math.round(sec / 86400), 'day')
  if (abs < 31536000) return rel.format(Math.round(sec / 2592000), 'month')
  return rel.format(Math.round(sec / 31536000), 'year')
}

/**
 * Is a later than b? A missing timestamp counts as ancient.
 *
 * `skewMs` is the head start b gets. One of the two timestamps is written by
 * this browser and the other by the server, and their clocks are never exactly
 * in step - without a little slack a browser running a few seconds fast would
 * call its own state the newer one forever.
 */
export function newerThan(
  a: string | null | undefined,
  b: string | null | undefined,
  skewMs = 0,
): boolean {
  const ta = Date.parse(a ?? '')
  if (Number.isNaN(ta)) return false
  const tb = Date.parse(b ?? '')
  return Number.isNaN(tb) || ta > tb + skewMs
}

/** Join class names, dropping anything falsy. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
