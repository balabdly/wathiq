import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const SUPER_ADMIN_COOKIE = 'wathiq_super_admin'
const SESSION_HOURS = 8

function getSecret(): string {
  const secret = process.env.SUPER_ADMIN_SECRET || process.env.SUPER_ADMIN_PASSWORD
  if (!secret) throw new Error('SUPER_ADMIN_SECRET أو SUPER_ADMIN_PASSWORD غير مضبوطة')
  return secret
}

function signPayload(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function createSuperAdminSessionToken(): { token: string; maxAge: number } {
  const maxAge = SESSION_HOURS * 3600
  const exp = Math.floor(Date.now() / 1000) + maxAge
  const payload = String(exp)
  const sig = signPayload(payload)
  return { token: `${payload}.${sig}`, maxAge }
}

export function verifySuperAdminSessionToken(token: string | undefined | null): boolean {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const exp = Number(payload)
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false

  const expected = signPayload(payload)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function verifySuperAdminPassword(password: string): boolean {
  const expected = process.env.SUPER_ADMIN_PASSWORD
  if (!expected) return false
  return password === expected
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

export function getSuperAdminCookieFromRequest(request: Request): string | undefined {
  return request.cookies.get(SUPER_ADMIN_COOKIE)?.value
}

/** يُرجع NextResponse 401 إذا غير مصرح، وإلا null */
export function requireSuperAdmin(request: Request): NextResponse | null {
  const token = getSuperAdminCookieFromRequest(request)
  if (!verifySuperAdminSessionToken(token)) {
    return NextResponse.json({ ok: false, error: 'غير مصرح — سجّل الدخول كـ Super Admin' }, { status: 401 })
  }
  return null
}

export function requireSuperAdminFromCookies(): boolean {
  const token = cookies().get(SUPER_ADMIN_COOKIE)?.value
  return verifySuperAdminSessionToken(token)
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
