import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  EMAIL_CONFIG_KEY,
  loadEmailConfig,
  serializeEmailConfig,
  type PlatformEmailConfig,
} from '@/lib/platform-email'

export async function GET(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  try {
    const admin = createAdminClient()
    const config = await loadEmailConfig(admin)
    const hasResend = !!process.env.RESEND_API_KEY?.trim()

    return NextResponse.json({
      ok: true,
      config,
      env: {
        hasResend,
        hasFrom: !!(config.from_email || process.env.PLATFORM_ALERT_FROM),
        hasOperator: !!(config.operator_email || process.env.PLATFORM_ALERT_TO),
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  try {
    const body = await request.json() as Partial<PlatformEmailConfig>
    const admin = createAdminClient()
    const current = await loadEmailConfig(admin)

    const next: PlatformEmailConfig = {
      enabled: body.enabled ?? current.enabled,
      provider: 'env',
      from_email: body.from_email?.trim() ?? current.from_email,
      operator_email: body.operator_email?.trim() ?? current.operator_email,
      notify_tenant: body.notify_tenant ?? current.notify_tenant,
      thresholds: Array.isArray(body.thresholds)
        ? body.thresholds.map(Number).filter(n => [0, 7, 14, 30].includes(n))
        : current.thresholds,
    }

    if (!next.thresholds.length) next.thresholds = [30, 14, 7, 0]

    const { error } = await admin
      .from('platform_settings')
      .upsert({ key: EMAIL_CONFIG_KEY, value: serializeEmailConfig(next) }, { onConflict: 'key' })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, config: next })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
