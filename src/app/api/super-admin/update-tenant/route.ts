import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { mergeTenantModules, normalizePlan, planMaxUsers } from '@/lib/tenant-plans'

export async function PATCH(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  try {
    const body = await request.json()
    const { id, name, name_en, phone, email, plan, modules, is_active, expires_at, max_users } = body

    if (!id) {
      return NextResponse.json({ ok: false, error: 'معرّف الشركة مطلوب' }, { status: 400 })
    }
    if (!name?.trim()) {
      return NextResponse.json({ ok: false, error: 'اسم الشركة مطلوب' }, { status: 400 })
    }

    const normalizedPlan = normalizePlan(plan)
    const mergedModules = mergeTenantModules(modules, normalizedPlan)

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('tenants')
      .update({
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
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, tenant: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
