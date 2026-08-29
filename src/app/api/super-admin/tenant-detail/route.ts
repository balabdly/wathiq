import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ ok: false, error: 'معرّف الشركة مطلوب' }, { status: 400 })
    }

    const admin = createAdminClient()

    const [
      { data: tenant, error: tenantError },
      { data: employees, error: empError },
      { count: activeProjects, error: projError },
    ] = await Promise.all([
      admin.from('tenants').select('*').eq('id', id).single(),
      admin
        .from('employees')
        .select('id, name, username, role, is_active, is_tenant_owner, last_login_at, created_at')
        .eq('tenant_id', id)
        .order('is_tenant_owner', { ascending: false })
        .order('last_login_at', { ascending: false, nullsFirst: false }),
      admin
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id)
        .neq('status', 'مغلق'),
    ])

    if (tenantError || !tenant) {
      return NextResponse.json({ ok: false, error: tenantError?.message || 'الشركة غير موجودة' }, { status: 404 })
    }
    if (empError) {
      return NextResponse.json({ ok: false, error: empError.message }, { status: 500 })
    }
    if (projError) {
      return NextResponse.json({ ok: false, error: projError.message }, { status: 500 })
    }

    const list = employees || []
    const owner = list.find(e => e.is_tenant_owner) || list[0] || null
    const activeUsers = list.filter(e => e.is_active).length

    const { data: auditLog } = await admin
      .from('platform_audit_log')
      .select('id, action, details, created_at')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      ok: true,
      tenant,
      owner,
      stats: {
        totalUsers: list.length,
        activeUsers,
        maxUsers: tenant.max_users ?? null,
        activeProjects: activeProjects ?? 0,
      },
      users: list,
      auditLog: auditLog || [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
