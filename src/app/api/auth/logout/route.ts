import { NextResponse } from 'next/server'

const AUTH_COOKIE_NAME = 'wathiq_user'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}
