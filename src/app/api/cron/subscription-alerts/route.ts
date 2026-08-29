import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processSubscriptionAlerts } from '@/lib/subscription-alerts'

/** للجدولة اليومية — يتطلب CRON_SECRET في env */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET غير مضبوط' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const provided = searchParams.get('secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const result = await processSubscriptionAlerts(admin)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
