import { compare, hash } from 'bcryptjs'

const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/

export function isPasswordHash(value?: string | null): boolean {
  return !!value && BCRYPT_HASH_RE.test(value)
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, 12)
}

export async function verifyPassword(plainPassword: string, storedPassword?: string | null): Promise<boolean> {
  if (!storedPassword) return false
  if (isPasswordHash(storedPassword)) {
    return compare(plainPassword, storedPassword)
  }
  return plainPassword === storedPassword
}
