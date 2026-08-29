import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  authEmailForEmployee,
  ensureAuthUser,
  hashPasswordServer,
  supabaseAuthPassword,
} from '@/lib/auth-server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { logSuperAdminAction } from '@/lib/super-admin-audit'
import { permissionsForTenantOwner } from '@/lib/tenant-admin-permissions'
import { defaultModulesForPlan, mergeTenantModules, normalizePlan, planMaxUsers } from '@/lib/tenant-plans'
import { seedChartOfAccounts } from '@/lib/seed-chart-of-accounts'

async function rollbackTenantCreate(
  admin: ReturnType<typeof createAdminClient>,
  ids: { tenantId?: string; branchId?: number; employeeId?: number; authEmail?: string },
) {
  if (ids.authEmail) {
    try {
      const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const user = listed?.users?.find(u => u.email === ids.authEmail)
      if (user) await admin.auth.admin.deleteUser(user.id)
    } catch (err) {
      console.error('[create-tenant] rollback auth user', err)
    }
  }
  if (ids.employeeId) await admin.from('employees').delete().eq('id', ids.employeeId)
  if (ids.branchId) await admin.from('branches').delete().eq('id', ids.branchId)
  if (ids.tenantId) await admin.from('tenants').delete().eq('id', ids.tenantId)
}

export async function POST(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  const rollbackIds: { tenantId?: string; branchId?: number; employeeId?: number; authEmail?: string } = {}

  try {
    const body = await request.json()
    const {
      name, name_en, phone, email, plan, modules, is_active, expires_at, max_users,
      admin_name, admin_username, admin_password,
    } = body

    if (!name?.trim()) {
      return NextResponse.json({ ok: false, error: 'اسم الشركة مطلوب' }, { status: 400 })
    }
    if (!admin_name?.trim() || !admin_username?.trim() || !admin_password) {
      return NextResponse.json({ ok: false, error: 'بيانات مستخدم الأدمن مطلوبة' }, { status: 400 })
    }

    const normalizedPlan = normalizePlan(plan)
    const mergedModules = modules
      ? mergeTenantModules(modules, normalizedPlan)
      : defaultModulesForPlan(normalizedPlan)
    const ownerPermissions = permissionsForTenantOwner(mergedModules)

    const admin = createAdminClient()

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({
        name: name.trim(),
        name_en: name_en?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        plan: normalizedPlan,
        modules: mergedModules,
        is_active: is_active ?? true,
        expires_at: expires_at || null,
        max_users: max_users ?? planMaxUsers(normalizedPlan),
      })
      .select()
      .single()
    if (tenantError) return NextResponse.json({ ok: false, error: tenantError.message }, { status: 500 })
    rollbackIds.tenantId = tenant.id

    const { data: branch, error: branchError } = await admin
      .from('branches')
      .insert({ tenant_id: tenant.id, name: 'الفرع الرئيسي', color: '#1a56db' })
      .select()
      .single()
    if (branchError) {
      await rollbackTenantCreate(admin, rollbackIds)
      return NextResponse.json({ ok: false, error: branchError.message }, { status: 500 })
    }
    rollbackIds.branchId = branch.id

    const hashedPassword = await hashPasswordServer(admin_password)

    const { data: employee, error: empError } = await admin
      .from('employees')
      .insert({
        tenant_id: tenant.id,
        branch_id: branch.id,
        name: admin_name.trim(),
        username: admin_username.trim(),
        role: 'مدير عام',
        is_tenant_owner: true,
        permissions: ownerPermissions,
        is_active: true,
        password: hashedPassword,
      })
      .select()
      .single()
    if (empError) {
      await rollbackTenantCreate(admin, rollbackIds)
      return NextResponse.json({ ok: false, error: empError.message }, { status: 500 })
    }
    rollbackIds.employeeId = employee.id

    const authEmail = authEmailForEmployee(employee.id)
    rollbackIds.authEmail = authEmail
    const authPassword = supabaseAuthPassword(employee.id, admin_password)
    const appMeta = {
      tenant_id: String(tenant.id),
      employee_id: employee.id,
      role: 'مدير عام',
    }
    const userMeta = { name: admin_name.trim(), username: admin_username.trim() }

    try {
      await ensureAuthUser(admin, authEmail, authPassword, appMeta, userMeta)
    } catch (authErr) {
      await rollbackTenantCreate(admin, rollbackIds)
      const message = authErr instanceof Error ? authErr.message : 'فشل إنشاء مستخدم المصادقة'
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }

    const seedResult = await seedChartOfAccounts(tenant.id, admin)

    await logSuperAdminAction(admin, {
      action: 'tenant_created',
      tenantId: tenant.id,
      tenantName: tenant.name,
      details: { plan: normalizedPlan, admin_username: admin_username.trim() },
    })

    return NextResponse.json({
      ok: true,
      tenantId: tenant.id,
      seedInserted: seedResult.inserted,
    })
  } catch (err: unknown) {
    if (rollbackIds.tenantId) {
      try {
        const admin = createAdminClient()
        await rollbackTenantCreate(admin, rollbackIds)
      } catch (rollbackErr) {
        console.error('[create-tenant] rollback', rollbackErr)
      }
    }
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
