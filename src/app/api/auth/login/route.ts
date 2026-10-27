import { NextResponse } from 'next/server'
import { createHmac, createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertTenantLoginAllowed } from '@/lib/super-admin-auth'
import {
  authEmailForEmployee,
  ensureAuthUser,
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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const username = typeof body?.username === 'string' ? body.username : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (username.length > 128 || password.length > 1024) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 400 })
    }
    if (!username?.trim() || !password) {
      return NextResponse.json({ error: 'يرجى إدخال بيانات الدخول' }, { status: 400 })
    }

    const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    // Centralized, atomic limit shared by all Vercel instances.
    // Count attempts before credential verification, so failures cannot race past the limit.
    const admin = createAdminClient()
    const key = (value: string) => createHash('sha256').update(value).digest('hex')
    const [accountLimit, ipLimit] = await Promise.all([
      admin.rpc('wathiq_login_limit_hit', { p_key: key('account:' + ip + ':' + username.trim().toLowerCase()), p_max: 5 }),
      admin.rpc('wathiq_login_limit_hit', { p_key: key('ip:' + ip), p_max: 30 }),
    ])
    if (accountLimit.error || ipLimit.error) {
      console.error('[auth/login] centralized rate limiter unavailable')
      return NextResponse.json({ error: 'تعذّر التحقق من حماية تسجيل الدخول، حاول لاحقًا' }, { status: 503 })
    }
    if (!accountLimit.data || !ipLimit.data) {
      return NextResponse.json({ error: 'محاولات كثيرة. حاول مجددًا بعد 15 دقيقة' }, { status: 429, headers: { 'Retry-After': '900' } })
    }

    const { data: candidates, error: lookupError } = await admin
      .from('employees')
      .select('*')
      .ilike('username', username.trim())

    if (lookupError) {
      console.error('[auth/login] lookup', lookupError)
      return NextResponse.json({ error: 'خطأ في الاتصال بقاعدة البيانات' }, { status: 500 })
    }
    if (!candidates?.length) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 })
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
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 })
    }
    if (!emp.is_active) {
      return NextResponse.json({ error: 'هذا الحساب معطّل' }, { status: 403 })
    }

    const tenantSelectWithMaintenance =
      'is_active, expires_at, maintenance_mode, maintenance_message'
    let tenantResult = await admin
      .from('tenants')
      .select(tenantSelectWithMaintenance)
      .eq('id', emp.tenant_id)
      .single()

    // fallback إذا لم تُطبَّق migration وضع الصيانة بعد
    if (
      tenantResult.error &&
      /maintenance_mode|maintenance_message|column/.test(tenantResult.error.message || '')
    ) {
      tenantResult = await admin
        .from('tenants')
        .select('is_active, expires_at')
        .eq('id', emp.tenant_id)
        .single()
      if (tenantResult.data) {
        tenantResult.data = {
          ...tenantResult.data,
          maintenance_mode: false,
          maintenance_message: null,
        }
      }
    }

    const { data: tenantRow, error: tenantError } = tenantResult

    if (tenantError || !tenantRow) {
      console.error('[auth/login] tenant', tenantError)
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

    await admin.from('employees').update({ last_login_at: new Date().toISOString() }).eq('id', emp.id)

    const [{ data: tenant }, { data: branches }] = await Promise.all([
      admin.from('tenants').select('*').eq('id', emp.tenant_id).single(),
      admin.from('branches').select('*').eq('tenant_id', emp.tenant_id).order('id'),
    ])

    const { password: _pw, ...safeEmp } = emp
    const secret = process.env.WATHIQ_SESSION_SECRET
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
      console.error('[auth/login] WATHIQ_SESSION_SECRET is not configured')
      return NextResponse.json({ error: 'إعدادات جلسة الدخول غير مكتملة' }, { status: 503 })
    }
    const maxAge = 8 * 60 * 60
    const payload = Buffer.from(JSON.stringify({
      employeeId: emp.id,
      tenantId: String(emp.tenant_id),
      role: emp.role,
      permissions: Array.isArray(emp.permissions) ? emp.permissions : [],
      exp: Date.now() + maxAge * 1000,
    })).toString('base64url')
    const signature = createHmac('sha256', secret).update(payload).digest('base64url')
    const response = NextResponse.json({
      employee: { ...safeEmp, permissions: emp.permissions || [] },
      tenant,
      branches: branches || [],
      session: sessionData.session,
    })
    response.cookies.set('wathiq_access', payload + '.' + signature, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', path: '/', maxAge,
    })
    return response
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
