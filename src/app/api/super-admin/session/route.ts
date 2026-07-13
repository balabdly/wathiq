import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  SUPER_ADMIN_COOKIE,
  loadSuperAdminConfig,
  verifySuperAdminSessionToken,
} from '@/lib/super-admin-auth'

export async function GET() {
  await loadSuperAdminConfig()
  const token = cookies().get(SUPER_ADMIN_COOKIE)?.value
  const ok = verifySuperAdminSessionToken(token)
  return NextResponse.json({ ok })
}
