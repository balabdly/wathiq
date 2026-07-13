import { NextResponse } from 'next/server'
import { getSuperAdminCookieFromRequest, verifySuperAdminSessionToken } from '@/lib/super-admin-auth'

export async function GET(request: Request) {
  const token = getSuperAdminCookieFromRequest(request)
  const ok = verifySuperAdminSessionToken(token)
  return NextResponse.json({ ok })
}
