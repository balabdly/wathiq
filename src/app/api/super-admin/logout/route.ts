import { NextResponse } from 'next/server'
import { clearSuperAdminCookie } from '@/lib/super-admin-auth'

export async function POST() {
  clearSuperAdminCookie()
  return NextResponse.json({ ok: true })
}
