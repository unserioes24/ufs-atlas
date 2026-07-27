/**
 * Talking to the Symfony backend.
 *
 * Opened as a local file there is no backend at all, and everything that needs
 * an account stays hidden. `API_AVAILABLE` is the switch for that.
 */

export const API_AVAILABLE = location.protocol === 'http:' || location.protocol === 'https:'

export interface ApiOptions {
  method?: string
  json?: unknown
  body?: BodyInit
}

/** Thrown with the server's own message, so callers can show it as it is. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    credentials: 'same-origin',
    headers: {},
  }
  if (opts.json !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(opts.json)
  } else if (opts.body !== undefined) {
    init.body = opts.body
  }

  const res = await fetch('/api' + path, init)
  let data: unknown = {}
  try {
    data = await res.json()
  } catch {
    // An empty or broken body is not worth its own error message.
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Server error ${res.status}`
    throw new ApiError(msg, res.status)
  }

  return data as T
}
