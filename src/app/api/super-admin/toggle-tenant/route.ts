import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const denied = requireSuperAdmin(request)
  if (denied) return denied

  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ ok: false, error: 'معرّف الشركة مطلوب' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: current, error: fetchError } = await admin
      .from('tenants')
      .select('is_active')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ ok: false, error: fetchError?.message || 'الشركة غير موجودة' }, { status: 404 })
    }

    const nextActive = !current.is_active
    const { data, error } = await admin
      .from('tenants')
      .update({ is_active: nextActive })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, tenant: data, is_active: nextActive })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
