import { NextRequest, NextResponse } from 'next/server'
import { AuthCookiePayload, createAuthCookieToken } from '@/lib/auth-cookie'

const AUTH_COOKIE_NAME = 'wathiq_user'

export async function POST(request: NextRequest) {
  const secret = process.env.AUTH_COOKIE_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'AUTH_COOKIE_SECRET is not configured' }, { status: 500 })
  }

  let payload: AuthCookiePayload | null = null
  try {
    payload = (await request.json()) as AuthCookiePayload
  } catch {
    payload = null
  }

  if (!payload || typeof payload.id !== 'number' || typeof payload.role !== 'string' || !Array.isArray(payload.permissions)) {
    return NextResponse.json({ error: 'Invalid auth payload' }, { status: 400 })
  }

  const token = await createAuthCookieToken(payload, secret)
  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  })
  return response
}
