/**
 * auth.ts — تشفير كلمات المرور (PBKDF2-SHA256)
 * يدعم كلمات المرور القديمة (نص صريح) مع ترقية تلقائية عند تسجيل الدخول
 */

const ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BYTES = 32

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const saltBuffer = new Uint8Array(salt)
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuffer, iterations, hash: 'SHA-256' },
    keyMaterial,
    HASH_BYTES * 8
  )
  return new Uint8Array(bits)
}

export function isHashedPassword(stored: string): boolean {
  return stored?.startsWith('pbkdf2:') ?? false
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await pbkdf2(password, salt, ITERATIONS)
  return `pbkdf2:${ITERATIONS}:${toBase64(salt)}:${toBase64(hash)}`
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (!stored) return { valid: false, needsUpgrade: false }

  if (!isHashedPassword(stored)) {
    const valid = password === stored
    return { valid, needsUpgrade: valid }
  }

  const parts = stored.split(':')
  if (parts.length !== 4) return { valid: false, needsUpgrade: false }

  const iterations = parseInt(parts[1], 10)
  const salt = fromBase64(parts[2])
  const expected = fromBase64(parts[3])
  const actual = await pbkdf2(password, salt, iterations)

  const valid = actual.length === expected.length &&
    actual.every((b, i) => b === expected[i])

  return { valid, needsUpgrade: false }
}
