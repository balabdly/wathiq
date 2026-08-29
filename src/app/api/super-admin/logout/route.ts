import { NextResponse } from 'next/server'
import { clearSuperAdminCookie } from '@/lib/super-admin-auth'

export async function POST() {
  await clearSuperAdminCookie()
  return NextResponse.json({ ok: true })
}
