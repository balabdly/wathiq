import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSuperAdminAction } from '@/lib/super-admin-audit'
import { processSubscriptionAlerts } from '@/lib/subscription-alerts'

export async function POST(request: Request) {
  const denied = await requireSuperAdmin(request)
  if (denied) return denied

  try {
    const admin = createAdminClient()
    const result = await processSubscriptionAlerts(admin)

    if (result.sent > 0) {
      await logSuperAdminAction(admin, {
        action: 'subscription_alerts_sent',
        details: { sent: result.sent, processed: result.processed, errors: result.errors.length },
      })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
