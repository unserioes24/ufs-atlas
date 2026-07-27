/**
 * Solving an ALTCHA challenge: a proof of work instead of a picture puzzle.
 *
 * The server names SHA-256(salt + number); the browser tries every number until
 * the hash matches. For a person that is the blink of an eye, for sending mail
 * in bulk it is expensive enough.
 *
 * Worked in blocks so the page can still paint in between.
 */

export interface Challenge {
  algorithm: string
  challenge: string
  salt: string
  signature: string
  maxnumber?: number
}

function hex(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf)
  let s = ''
  for (const byte of b) s += (byte < 16 ? '0' : '') + byte.toString(16)
  return s
}

const BLOCK = 2000

export async function solveAltcha(
  c: Challenge,
  onProgress?: (p: number) => void,
  failedMessage = 'The bot check did not work out.',
): Promise<string> {
  const enc = new TextEncoder()
  const max = c.maxnumber ?? 100000
  const started = Date.now()

  const block = async (from: number): Promise<number | null> => {
    const to = Math.min(from + BLOCK - 1, max)
    const jobs: Array<Promise<ArrayBuffer>> = []
    for (let n = from; n <= to; n++) {
      jobs.push(crypto.subtle.digest('SHA-256', enc.encode(c.salt + n)))
    }
    const out = await Promise.all(jobs)
    for (let i = 0; i < out.length; i++) {
      if (hex(out[i]!) === c.challenge) return from + i
    }
    if (to >= max) return null
    onProgress?.(to / max)
    await new Promise((go) => setTimeout(go, 0))
    return block(to + 1)
  }

  const number = await block(0)
  if (number === null) throw new Error(failedMessage)
  return btoa(
    JSON.stringify({
      algorithm: c.algorithm,
      challenge: c.challenge,
      number,
      salt: c.salt,
      signature: c.signature,
      took: Date.now() - started,
    }),
  )
}
