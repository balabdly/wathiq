import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { authEmailForEmployee, hashPasswordServer, verifyPasswordServer } from '@/lib/auth-server'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()
    if (!username?.trim() || !password) {
      return NextResponse.json({ error: 'يرجى إدخال بيانات الدخول' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: candidates, error: lookupError } = await admin
      .from('employees')
      .select('*')
      .ilike('username', username.trim())

    if (lookupError || !candidates?.length) {
      return NextResponse.json({ error: 'اسم المستخدم غير موجود' }, { status: 401 })
    }

    let emp: any = null
    let needsUpgrade = false
    for (const e of candidates) {
      const result = await verifyPasswordServer(password, e.password)
      if (result.valid) {
        emp = e
        needsUpgrade = result.needsUpgrade
        break
      }
    }

    if (!emp) {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 })
    }
    if (!emp.is_active) {
      return NextResponse.json({ error: 'هذا الحساب معطّل' }, { status: 403 })
    }

    if (needsUpgrade) {
      const hashed = await hashPasswordServer(password)
      await admin.from('employees').update({ password: hashed }).eq('id', emp.id)
      emp.password = hashed
    }

    const authEmail = authEmailForEmployee(emp.id)
    const appMeta = {
      tenant_id: String(emp.tenant_id),
      employee_id: emp.id,
      role: emp.role,
    }

    const { data: existing } = await admin.auth.admin.listUsers()
    const authUser = existing?.users?.find(u => u.email === authEmail)

    if (!authUser) {
      const { error: createError } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        app_metadata: appMeta,
        user_metadata: { name: emp.name, username: emp.username },
      })
      if (createError) {
        return NextResponse.json({ error: 'فشل إنشاء جلسة المصادقة' }, { status: 500 })
      }
    } else {
      await admin.auth.admin.updateUserById(authUser.id, {
        password,
        app_metadata: appMeta,
        user_metadata: { name: emp.name, username: emp.username },
      })
    }

    const supabase = createServerSupabase()
    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    })

    if (signInError || !sessionData.session) {
      return NextResponse.json({ error: 'فشل تسجيل الدخول' }, { status: 500 })
    }

    const [{ data: tenant }, { data: branches }] = await Promise.all([
      admin.from('tenants').select('*').eq('id', emp.tenant_id).single(),
      admin.from('branches').select('*').eq('tenant_id', emp.tenant_id).order('id'),
    ])

    const { password: _pw, ...safeEmp } = emp
    return NextResponse.json({
      employee: { ...safeEmp, permissions: emp.permissions || [] },
      tenant,
      branches: branches || [],
      session: sessionData.session,
    })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
