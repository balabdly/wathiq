import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, tenants: data || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
