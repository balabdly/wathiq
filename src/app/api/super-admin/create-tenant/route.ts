import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPasswordServer } from '@/lib/auth-server'

// إنشاء شركة (tenant) جديدة كاملة بالخادم:
// tenant + فرع رئيسي + مستخدم أدمن بكلمة مرور مُشفّرة PBKDF2 (لا نص صريح إطلاقاً)
// + مستخدم Supabase Auth حقيقي بنفس جسر تسجيل الدخول العادي (app_metadata.tenant_id لأجل RLS)
export async function POST(request: Request) {
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

    const admin = createAdminClient()

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({ name, name_en: name_en || null, phone: phone || null, email: email || null, plan, modules, is_active, expires_at: expires_at || null, max_users })
      .select().single()
    if (tenantError) return NextResponse.json({ ok: false, error: tenantError.message }, { status: 500 })

    const { data: branch, error: branchError } = await admin
      .from('branches')
      .insert({ tenant_id: tenant.id, name: 'الفرع الرئيسي', color: '#1a56db' })
      .select().single()
    if (branchError) return NextResponse.json({ ok: false, error: branchError.message }, { status: 500 })

    // تشفير حقيقي — لا نص صريح بجدول employees إطلاقاً
    const hashedPassword = await hashPasswordServer(admin_password)

    const { data: employee, error: empError } = await admin
      .from('employees')
      .insert({
        tenant_id: tenant.id, branch_id: branch.id,
        name: admin_name, username: admin_username, role: 'مدير عام',
        is_tenant_owner: true,
        permissions: [
          'dashboard', 'projects_view', 'projects_edit',
          'visits_quality', 'visits_safety', 'visits_electrical', 'visits_field',
          'inventory', 'purchases', 'employees', 'finance', 'reports', 'qhse',
        ],
        is_active: true,
        password: hashedPassword,
      })
      .select().single()
    if (empError) return NextResponse.json({ ok: false, error: empError.message }, { status: 500 })

    // جسر Supabase Auth الحقيقي — نفس نمط تسجيل الدخول العادي (app_metadata.tenant_id لأجل RLS)
    const authEmail = `emp-${employee.id}@wathiq.internal`
    await admin.auth.admin.createUser({
      email: authEmail,
      password: admin_password,
      email_confirm: true,
      app_metadata: { tenant_id: String(tenant.id), employee_id: employee.id, role: 'مدير عام' },
    })

    return NextResponse.json({ ok: true, tenantId: tenant.id })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'خطأ غير متوقع' }, { status: 500 })
  }
}
