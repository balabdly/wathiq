import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200)
    const tenantId = searchParams.get('tenantId')

    const admin = createAdminClient()
    let query = admin
      .from('platform_audit_log')
      .select('id, action, tenant_id, tenant_name, details, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (tenantId) query = query.eq('tenant_id', tenantId)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, entries: data || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
