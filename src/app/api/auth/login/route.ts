import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertTenantLoginAllowed } from '@/lib/super-admin-auth'
import {
  authEmailForEmployee,
  hashPasswordServer,
  supabaseAuthPassword,
  verifyPasswordServer,
} from '@/lib/auth-server'

function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE keys غير مضبوطة')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function ensureAuthUser(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  authPassword: string,
  appMeta: Record<string, unknown>,
  userMeta: Record<string, unknown>,
) {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: authPassword,
    email_confirm: true,
    app_metadata: appMeta,
    user_metadata: userMeta,
  })

  if (!createError) return

  const alreadyExists = createError.message?.toLowerCase().includes('already')
    || createError.message?.toLowerCase().includes('registered')
  if (!alreadyExists) throw createError

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) throw listError

  const existing = listed?.users?.find(u => u.email === email)
  if (!existing) throw new Error('تعذّر العثور على مستخدم المصادقة')

  const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
    password: authPassword,
    app_metadata: appMeta,
    user_metadata: userMeta,
  })
  if (updateError) throw updateError
}

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

    if (lookupError) {
      console.error('[auth/login] lookup', lookupError)
      return NextResponse.json({ error: 'خطأ في الاتصال بقاعدة البيانات' }, { status: 500 })
    }
    if (!candidates?.length) {
      return NextResponse.json({ error: 'رقم الموظف أو اسم المستخدم غير موجود' }, { status: 401 })
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

    const { data: tenantRow, error: tenantError } = await admin
      .from('tenants')
      .select('is_active, expires_at')
      .eq('id', emp.tenant_id)
      .single()

    if (tenantError || !tenantRow) {
      return NextResponse.json({ error: 'تعذّر التحقق من بيانات الشركة' }, { status: 500 })
    }

    const tenantCheck = assertTenantLoginAllowed(tenantRow)
    if (!tenantCheck.ok) {
      return NextResponse.json({ error: tenantCheck.error }, { status: tenantCheck.status })
    }

    if (needsUpgrade) {
      const hashed = await hashPasswordServer(password)
      await admin.from('employees').update({ password: hashed }).eq('id', emp.id)
      emp.password = hashed
    }

    const authEmail = authEmailForEmployee(emp.id)
    const authPassword = supabaseAuthPassword(emp.id, password)
    const appMeta = {
      tenant_id: String(emp.tenant_id),
      employee_id: emp.id,
      role: emp.role,
    }
    const userMeta = { name: emp.name, username: emp.username }

    try {
      await ensureAuthUser(admin, authEmail, authPassword, appMeta, userMeta)
    } catch (authErr: any) {
      console.error('[auth/login] ensureAuthUser', authErr)
      return NextResponse.json({ error: 'فشل إنشاء جلسة المصادقة' }, { status: 500 })
    }

    const anon = createAnonClient()
    const { data: sessionData, error: signInError } = await anon.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    })

    if (signInError || !sessionData.session) {
      console.error('[auth/login] signIn', signInError)
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'إعدادات الخادم غير مكتملة — أضف SUPABASE_SERVICE_ROLE_KEY في Vercel' }, { status: 500 })
    }
    if (msg.includes('NEXT_PUBLIC_SUPABASE')) {
      return NextResponse.json({ error: 'إعدادات Supabase غير مكتملة في Vercel' }, { status: 500 })
    }
    console.error('[auth/login]', err)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
