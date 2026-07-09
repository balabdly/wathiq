/**
 * نسخة خادم من auth.ts — للتحقق من كلمات المرور في API routes
 */
const ITERATIONS = 100_000
const HASH_BYTES = 32

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const crypto = await import('crypto')
  const hash = crypto.pbkdf2Sync(password, salt, iterations, HASH_BYTES, 'sha256')
  return new Uint8Array(hash)
}

function isHashedPassword(stored: string): boolean {
  return stored?.startsWith('pbkdf2:') ?? false
}

export async function hashPasswordServer(password: string): Promise<string> {
  const crypto = await import('crypto')
  const salt = crypto.randomBytes(16)
  const hash = await pbkdf2(password, new Uint8Array(salt), ITERATIONS)
  return `pbkdf2:${ITERATIONS}:${toBase64(new Uint8Array(salt))}:${toBase64(hash)}`
}

export async function verifyPasswordServer(
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

export function authEmailForEmployee(employeeId: number | string) {
  return `${employeeId}@wathiq.internal`
}
