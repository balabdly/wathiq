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

export async function POST(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  try {
    const { tenantId, newPassword } = await request.json()
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: 'معرّف الشركة مطلوب' }, { status: 400 })
    }
    if (!newPassword || String(newPassword).length < 6) {
      return NextResponse.json({ ok: false, error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: owner, error: ownerError } = await admin
      .from('employees')
      .select('id, name, username, tenant_id, role')
      .eq('tenant_id', tenantId)
      .eq('is_tenant_owner', true)
      .maybeSingle()

    if (ownerError) {
      return NextResponse.json({ ok: false, error: ownerError.message }, { status: 500 })
    }
    if (!owner) {
      return NextResponse.json({ ok: false, error: 'لم يُعثر على مدير الشركة' }, { status: 404 })
    }

    const { data: tenant } = await admin.from('tenants').select('name').eq('id', tenantId).single()

    const hashed = await hashPasswordServer(String(newPassword))
    const { error: updateError } = await admin
      .from('employees')
      .update({ password: hashed })
      .eq('id', owner.id)

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
    }

    const authEmail = authEmailForEmployee(owner.id)
    const authPassword = supabaseAuthPassword(owner.id, String(newPassword))
    await ensureAuthUser(admin, authEmail, authPassword, {
      tenant_id: String(tenantId),
      employee_id: owner.id,
      role: owner.role,
    }, {
      name: owner.name,
      username: owner.username,
    })

    await logSuperAdminAction(admin, {
      action: 'admin_password_reset',
      tenantId,
      tenantName: tenant?.name,
      details: { owner_id: owner.id, username: owner.username },
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
