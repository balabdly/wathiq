import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  PLAN_TEMPLATES_KEY,
  parsePlanTemplates,
  serializePlanTemplates,
  type PlanTemplate,
} from '@/lib/plan-templates'
import { mergeTenantModules, normalizePlan } from '@/lib/tenant-plans'

export async function GET(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', PLAN_TEMPLATES_KEY)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, templates: parsePlanTemplates(data?.value) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  try {
    const body = await request.json()
    const { name, plan, modules, id, action } = body

    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', PLAN_TEMPLATES_KEY)
      .maybeSingle()

    let templates = parsePlanTemplates(existing?.value)

    if (action === 'delete') {
      if (!id) {
        return NextResponse.json({ ok: false, error: 'معرّف القالب مطلوب' }, { status: 400 })
      }
      templates = templates.filter(t => t.id !== id)
    } else {
      if (!name?.trim()) {
        return NextResponse.json({ ok: false, error: 'اسم القالب مطلوب' }, { status: 400 })
      }
      const normalizedPlan = normalizePlan(plan)
      const mergedModules = mergeTenantModules(modules || {}, normalizedPlan)
      const template: PlanTemplate = {
        id: id || crypto.randomUUID(),
        name: name.trim(),
        plan: normalizedPlan,
        modules: mergedModules,
        created_at: new Date().toISOString(),
      }

      const idx = templates.findIndex(t => t.id === template.id)
      if (idx >= 0) templates[idx] = template
      else templates.push(template)
    }

    const { error: upsertError } = await admin
      .from('platform_settings')
      .upsert({ key: PLAN_TEMPLATES_KEY, value: serializePlanTemplates(templates) }, { onConflict: 'key' })

    if (upsertError) {
      return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, templates })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
