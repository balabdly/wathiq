import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSuperAdminAction } from '@/lib/super-admin-audit'

function addDays(base: Date, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function POST(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  try {
    const { id, days } = await request.json()
    if (!id) {
      return NextResponse.json({ ok: false, error: 'معرّف الشركة مطلوب' }, { status: 400 })
    }

    const extendDays = Number(days)
    if (!Number.isFinite(extendDays) || extendDays <= 0 || extendDays > 3650) {
      return NextResponse.json({ ok: false, error: 'عدد الأيام غير صالح' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: current, error: fetchError } = await admin
      .from('tenants')
      .select('id, name, expires_at, is_active')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ ok: false, error: fetchError?.message || 'الشركة غير موجودة' }, { status: 404 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let base = today
    if (current.expires_at) {
      const exp = new Date(current.expires_at)
      exp.setHours(0, 0, 0, 0)
      if (exp.getTime() > base.getTime()) base = exp
    }

    const newExpires = addDays(base, extendDays)

    const { data: tenant, error } = await admin
      .from('tenants')
      .update({
        expires_at: newExpires,
        is_active: true,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    await logSuperAdminAction(admin, {
      action: 'subscription_extended',
      tenantId: id,
      tenantName: current.name,
      details: {
        days: extendDays,
        previous_expires_at: current.expires_at,
        new_expires_at: newExpires,
      },
    })

    return NextResponse.json({ ok: true, tenant, expires_at: newExpires })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
