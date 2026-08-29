import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSuperAdminAction } from '@/lib/super-admin-audit'

export async function POST(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  try {
    const { id, maintenance_mode, maintenance_message } = await request.json()
    if (!id) {
      return NextResponse.json({ ok: false, error: 'معرّف الشركة مطلوب' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: current, error: fetchError } = await admin
      .from('tenants')
      .select('id, name, maintenance_mode')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ ok: false, error: fetchError?.message || 'الشركة غير موجودة' }, { status: 404 })
    }

    const nextMode = maintenance_mode ?? !current.maintenance_mode

    const { data: tenant, error } = await admin
      .from('tenants')
      .update({
        maintenance_mode: nextMode,
        maintenance_message: nextMode ? (maintenance_message?.trim() || 'النظام تحت الصيانة — حاول لاحقاً') : null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    await logSuperAdminAction(admin, {
      action: 'maintenance_toggled',
      tenantId: id,
      tenantName: current.name,
      details: { maintenance_mode: nextMode },
    })

    return NextResponse.json({ ok: true, tenant, maintenance_mode: nextMode })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
