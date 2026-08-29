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

/** كلمة مرور داخلية لـ Supabase Auth (يتطلب 6 أحرف على الأقل) */
export function supabaseAuthPassword(employeeId: number | string, employeePassword: string) {
  return `wathiq:${employeeId}:${employeePassword}`
}

type AdminAuthClient = {
  auth: {
    admin: {
      createUser: (args: {
        email: string
        password: string
        email_confirm?: boolean
        app_metadata?: Record<string, unknown>
        user_metadata?: Record<string, unknown>
      }) => Promise<{ data: unknown; error: { message?: string } | null }>
      listUsers: (args: { page: number; perPage: number }) => Promise<{
        data: { users?: Array<{ id: string; email?: string }> } | null
        error: { message?: string } | null
      }>
      updateUserById: (id: string, args: {
        password?: string
        app_metadata?: Record<string, unknown>
        user_metadata?: Record<string, unknown>
      }) => Promise<{ error: { message?: string } | null }>
    }
  }
}

/** إنشاء أو تحديث مستخدم Supabase Auth (مشترك بين login و Super Admin) */
export async function ensureAuthUser(
  admin: AdminAuthClient,
  email: string,
  authPassword: string,
  appMeta: Record<string, unknown>,
  userMeta: Record<string, unknown>,
): Promise<void> {
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password: authPassword,
    email_confirm: true,
    app_metadata: appMeta,
    user_metadata: userMeta,
  })

  if (!createError) return

  const alreadyExists = createError.message?.toLowerCase().includes('already')
    || createError.message?.toLowerCase().includes('registered')
  if (!alreadyExists) throw createError

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) throw listError

  const existing = listed?.users?.find(u => u.email === email)
  if (!existing) throw new Error('تعذّر العثور على مستخدم المصادقة')

  const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
    password: authPassword,
    app_metadata: appMeta,
    user_metadata: userMeta,
  })
  if (updateError) throw updateError
}
