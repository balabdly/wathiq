import type { SupabaseClient } from '@supabase/supabase-js'
import { daysUntilExpiry } from '@/lib/super-admin-platform-stats'
import { loadEmailConfig, sendPlatformEmail, type PlatformEmailConfig } from '@/lib/platform-email'

export type SubscriptionAlertType = 'd30' | 'd14' | 'd7' | 'expired'

const ALERT_LABELS: Record<SubscriptionAlertType, string> = {
  d30: '30 يوم',
  d14: '14 يوم',
  d7: '7 أيام',
  expired: 'منتهي',
}

/** أرسل أول تنبيه مطلوب ولم يُرسل بعد لهذه الفترة */
function pickAlertType(days: number, thresholds: number[], alreadySent: Set<string>): SubscriptionAlertType | null {
  if (days <= 0 && thresholds.includes(0) && !alreadySent.has('expired')) return 'expired'
  if (days > 0 && days <= 7 && thresholds.includes(7) && !alreadySent.has('d7')) return 'd7'
  if (days > 0 && days <= 14 && thresholds.includes(14) && !alreadySent.has('d14')) return 'd14'
  if (days > 0 && days <= 30 && thresholds.includes(30) && !alreadySent.has('d30')) return 'd30'
  return null
}

function buildEmailHtml(tenantName: string, days: number, alertType: SubscriptionAlertType, expiresAt: string) {
  const label = ALERT_LABELS[alertType]
  const expDate = new Date(expiresAt).toLocaleDateString('ar-EG')
  const urgency = alertType === 'expired' ? '#dc2626' : alertType === 'd7' ? '#d97706' : '#1a56db'

  return `
    <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: ${urgency}; margin-bottom: 8px;">تنبيه اشتراك وثيق</h2>
      <p style="font-size: 16px; color: #374151;">
        شركة <strong>${tenantName}</strong>
      </p>
      <p style="font-size: 15px; color: #4b5563;">
        ${alertType === 'expired'
          ? 'انتهى اشتراك الشركة ولا يمكن للمستخدمين الدخول حتى التجديد.'
          : `يتبقى على انتهاء الاشتراك <strong>${days}</strong> يوم (تنبيه ${label}).`}
      </p>
      <p style="font-size: 14px; color: #6b7280;">تاريخ الانتهاء: ${expDate}</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 12px; color: #9ca3af;">رسالة تلقائية من منصة وثيق — Super Admin</p>
    </div>
  `
}

export type ProcessAlertsResult = {
  processed: number
  sent: number
  skipped: number
  errors: string[]
  details: Array<{ tenant: string; alert: string; recipient: string; ok: boolean }>
}

export async function processSubscriptionAlerts(
  admin: SupabaseClient,
  config?: PlatformEmailConfig,
): Promise<ProcessAlertsResult> {
  const emailConfig = config ?? await loadEmailConfig(admin)
  const result: ProcessAlertsResult = {
    processed: 0,
    sent: 0,
    skipped: 0,
    errors: [],
    details: [],
  }

  if (!emailConfig.enabled) {
    result.errors.push('التنبيهات البريدية غير مفعّلة')
    return result
  }
  if (!emailConfig.operator_email && !emailConfig.notify_tenant) {
    result.errors.push('لا يوجد مستلم — اضبط بريد المشغّل أو تفعيل إشعار الشركة')
    return result
  }

  const { data: tenants, error } = await admin
    .from('tenants')
    .select('id, name, email, expires_at, is_active')
    .not('expires_at', 'is', null)

  if (error) throw error

  for (const tenant of tenants || []) {
    if (tenant.is_active === false) continue
    const days = daysUntilExpiry(tenant.expires_at)
    if (days === null) continue

    result.processed++

    const expiresKey = tenant.expires_at?.slice(0, 10) || null
    const { data: existingLogs } = await admin
      .from('subscription_alert_log')
      .select('alert_type')
      .eq('tenant_id', tenant.id)
      .eq('expires_at', expiresKey)

    const sentTypes = new Set((existingLogs || []).map(r => r.alert_type))
    const alertType = pickAlertType(days, emailConfig.thresholds, sentTypes)
    if (!alertType) {
      result.skipped++
      continue
    }

    const recipients: string[] = []
    if (emailConfig.operator_email) recipients.push(emailConfig.operator_email)
    if (emailConfig.notify_tenant && tenant.email?.trim()) recipients.push(tenant.email.trim())

    const uniqueRecipients = [...new Set(recipients)]
    if (!uniqueRecipients.length) {
      result.skipped++
      continue
    }

    const subject = alertType === 'expired'
      ? `[وثيق] انتهى اشتراك ${tenant.name}`
      : `[وثيق] اشتراك ${tenant.name} ينتهي خلال ${days} يوم`

    const html = buildEmailHtml(tenant.name, days, alertType, tenant.expires_at)

    let anySent = false
    for (const recipient of uniqueRecipients) {
      const sendResult = await sendPlatformEmail({
        to: recipient,
        subject,
        html,
        from: emailConfig.from_email || undefined,
      })

      result.details.push({
        tenant: tenant.name,
        alert: alertType,
        recipient,
        ok: sendResult.ok,
      })

      if (sendResult.ok) {
        anySent = true
        result.sent++
      } else {
        result.errors.push(`${tenant.name} → ${recipient}: ${sendResult.error}`)
      }
    }

    if (anySent) {
      const { error: logError } = await admin.from('subscription_alert_log').insert({
        tenant_id: tenant.id,
        alert_type: alertType,
        expires_at: expiresKey,
        recipient: uniqueRecipients.join(', '),
      })
      if (logError && !logError.message?.includes('duplicate') && !logError.code?.includes('23505')) {
        result.errors.push(`سجل ${tenant.name}: ${logError.message}`)
      }
    }
  }

  return result
}

export { ALERT_LABELS }
