import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { computePlatformStats } from '@/lib/super-admin-platform-stats'

export async function GET(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  try {
    const admin = createAdminClient()
    const stats = await computePlatformStats(admin)
    return NextResponse.json({ ok: true, stats })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
