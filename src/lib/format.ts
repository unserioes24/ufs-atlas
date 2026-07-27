/** Numbers, durations and timestamps, formatted the same way everywhere. */

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '–'
  return n.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Seconds as time spent fishing: "12 h 30 min". */
export function fmtTime(sec: number | null | undefined): string {
  if (!sec) return '–'
  const hours = Math.floor(sec / 3600)
  const min = Math.round((sec % 3600) / 60)
  return hours ? `${hours} h ${min} min` : `${min} min`
}

/** A point in time, short and readable: "27.07.2026, 14:05". */
export function fmtWhen(iso: string | null | undefined): string {
  const t = Date.parse(iso ?? '')
  if (Number.isNaN(t)) return 'unbekannt'
  return new Date(t).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Distance from now in words: "vor 3 Tagen". */
export function fmtAgo(iso: string | null | undefined): string {
  const t = Date.parse(iso ?? '')
  if (Number.isNaN(t)) return 'unbekannt'
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 90) return 'gerade eben'
  if (s < 5400) return `vor ${Math.round(s / 60)} Min.`
  if (s < 172800) return `vor ${Math.round(s / 3600)} Std.`
  if (s < 2592000) return `vor ${Math.round(s / 86400)} Tagen`
  if (s < 31536000) return `vor ${Math.round(s / 2592000)} Monaten`
  return 'vor über einem Jahr'
}

/** Is a later than b? A missing timestamp counts as ancient. */
export function newerThan(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = Date.parse(a ?? '')
  if (Number.isNaN(ta)) return false
  const tb = Date.parse(b ?? '')
  return Number.isNaN(tb) || ta > tb
}

/** Join class names, dropping anything falsy. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
