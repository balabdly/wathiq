/**
 * Best-effort protection per server instance.
 * Production must additionally enforce a distributed limit at the edge or a shared store.
 */
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const MAX_KEYS = 10000
const attempts = new Map<string, { count: number; expires: number }>()

export function loginAttemptAllowed(key: string): boolean {
  const now = Date.now()
  const previous = attempts.get(key)
  if (previous && previous.expires > now) return previous.count < MAX_ATTEMPTS
  attempts.delete(key)
  return true
}

export function recordFailedLogin(key: string): void {
  const now = Date.now()
  const previous = attempts.get(key)
  if (attempts.size >= MAX_KEYS) {
    for (const [k, v] of attempts) {
      if (v.expires <= now) attempts.delete(k)
    }
    if (attempts.size >= MAX_KEYS) attempts.delete(attempts.keys().next().value!)
  }
  attempts.set(key, previous && previous.expires > now
    ? { count: previous.count + 1, expires: previous.expires }
    : { count: 1, expires: now + WINDOW_MS })
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key)
}
