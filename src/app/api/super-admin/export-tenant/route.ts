import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSuperAdminAction } from '@/lib/super-admin-audit'

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
      { data: branches },
      { data: employees },
      { count: projectCount },
      { count: activeProjectCount },
      { data: recentAudit },
    ] = await Promise.all([
      admin.from('tenants').select('*').eq('id', id).single(),
      admin.from('branches').select('id, name, location, color, created_at').eq('tenant_id', id),
      admin.from('employees').select('id, name, username, role, is_active, is_tenant_owner, last_login_at, created_at, permissions').eq('tenant_id', id),
      admin.from('projects').select('id', { count: 'exact', head: true }).eq('tenant_id', id),
      admin.from('projects').select('id', { count: 'exact', head: true }).eq('tenant_id', id).neq('status', 'مغلق'),
      admin.from('platform_audit_log').select('action, created_at, details').eq('tenant_id', id).order('created_at', { ascending: false }).limit(50),
    ])

    if (tenantError || !tenant) {
      return NextResponse.json({ ok: false, error: tenantError?.message || 'الشركة غير موجودة' }, { status: 404 })
    }

    const exportPayload = {
      exported_at: new Date().toISOString(),
      tenant: {
        ...tenant,
      },
      branches: branches || [],
      employees: (employees || []).map(e => ({
        id: e.id,
        name: e.name,
        username: e.username,
        role: e.role,
        is_active: e.is_active,
        is_tenant_owner: e.is_tenant_owner,
        last_login_at: e.last_login_at,
        created_at: e.created_at,
        permissions_count: e.permissions?.length || 0,
      })),
      stats: {
        total_projects: projectCount ?? 0,
        active_projects: activeProjectCount ?? 0,
        total_users: employees?.length ?? 0,
        active_users: employees?.filter(e => e.is_active).length ?? 0,
      },
      recent_audit: recentAudit || [],
    }

    await logSuperAdminAction(admin, {
      action: 'tenant_exported',
      tenantId: id,
      tenantName: tenant.name,
      details: { employees: exportPayload.stats.total_users },
    })

    const filename = `wathiq-export-${tenant.name?.replace(/\s+/g, '-') || id}-${new Date().toISOString().slice(0, 10)}.json`

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
