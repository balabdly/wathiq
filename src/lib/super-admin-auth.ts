import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const SUPER_ADMIN_COOKIE = 'wathiq_super_admin'
const SESSION_HOURS = 8

type SuperAdminConfig = { password: string; secret: string }

let cachedConfig: SuperAdminConfig | null = null
let configPromise: Promise<SuperAdminConfig | null> | null = null

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function getSecretSync(): string | null {
  if (cachedConfig?.secret) return cachedConfig.secret
  const secret = process.env.SUPER_ADMIN_SECRET?.trim() || process.env.SUPER_ADMIN_PASSWORD?.trim()
  return secret || null
}

/** يحمّل كلمة المرور من env أو من platform_settings في Supabase */
export async function loadSuperAdminConfig(): Promise<SuperAdminConfig | null> {
  if (cachedConfig) return cachedConfig
  if (configPromise) return configPromise

  configPromise = (async () => {
    const envPassword = process.env.SUPER_ADMIN_PASSWORD?.trim()
    const envSecret = process.env.SUPER_ADMIN_SECRET?.trim()
    if (envPassword) {
      cachedConfig = { password: envPassword, secret: envSecret || envPassword }
      return cachedConfig
    }

    try {
      const admin = createAdminClient()
      const { data, error } = await admin
        .from('platform_settings')
        .select('key, value')
        .in('key', ['super_admin_password', 'super_admin_secret'])

      if (error) {
        console.error('[super-admin] platform_settings', error.message)
        return null
      }

      const map = Object.fromEntries((data || []).map(r => [r.key, r.value]))
      const password = map.super_admin_password?.trim()
      if (!password) return null

      cachedConfig = {
        password,
        secret: map.super_admin_secret?.trim() || password,
      }
      return cachedConfig
    } catch (err) {
      console.error('[super-admin] loadConfig', err)
      return null
    }
  })()

  return configPromise
}

export function createSuperAdminSessionToken(secret?: string): { token: string; maxAge: number } {
  const signingSecret = secret || getSecretSync()
  if (!signingSecret) throw new Error('Super Admin secret غير مضبوط')

  const maxAge = SESSION_HOURS * 3600
  const exp = Math.floor(Date.now() / 1000) + maxAge
  const payload = String(exp)
  const sig = signPayload(payload, signingSecret)
  return { token: `${payload}.${sig}`, maxAge }
}

export function verifySuperAdminSessionToken(token: string | undefined | null): boolean {
  if (!token) return false
  const signingSecret = getSecretSync()
  if (!signingSecret) return false

  const dot = token.lastIndexOf('.')
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const exp = Number(payload)
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false

  const expected = signPayload(payload, signingSecret)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function verifySuperAdminPassword(password: string): Promise<boolean> {
  const config = await loadSuperAdminConfig()
  if (!config?.password) return false
  return password === config.password
}

export function setSuperAdminCookie(token: string, maxAge: number): void {
  cookies().set(SUPER_ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  })
}

export function clearSuperAdminCookie(): void {
  cookies().set(SUPER_ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

/** يُرجع NextResponse 401 إذا غير مصرح، وإلا null */
export async function requireSuperAdmin(_request?: Request): Promise<NextResponse | null> {
  await loadSuperAdminConfig()
  const token = cookies().get(SUPER_ADMIN_COOKIE)?.value
  if (!verifySuperAdminSessionToken(token)) {
    return NextResponse.json({ ok: false, error: 'غير مصرح — سجّل الدخول كـ Super Admin' }, { status: 401 })
  }
  return null
}

export function assertTenantLoginAllowed(tenant: {
  is_active?: boolean | null
  expires_at?: string | null
}): { ok: true } | { ok: false; error: string; status: number } {
  if (tenant.is_active === false) {
    return { ok: false, error: 'حساب الشركة موقوف — تواصل مع الدعم', status: 403 }
  }
  if (tenant.expires_at) {
    const exp = new Date(tenant.expires_at)
    exp.setHours(23, 59, 59, 999)
    if (exp.getTime() < Date.now()) {
      return { ok: false, error: 'انتهى اشتراك الشركة — يرجى التجديد', status: 403 }
    }
  }
  return { ok: true }
}
