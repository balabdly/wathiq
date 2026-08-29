export type PlatformEmailConfig = {
  enabled: boolean
  provider: 'resend' | 'env'
  from_email: string
  operator_email: string
  notify_tenant: boolean
  thresholds: number[]
}

export const EMAIL_CONFIG_KEY = 'platform_email_config'

const DEFAULT_CONFIG: PlatformEmailConfig = {
  enabled: false,
  provider: 'env',
  from_email: '',
  operator_email: '',
  notify_tenant: true,
  thresholds: [30, 14, 7, 0],
}

export function parseEmailConfig(raw: string | null | undefined): PlatformEmailConfig {
  if (!raw?.trim()) return { ...DEFAULT_CONFIG }
  try {
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      thresholds: Array.isArray(parsed.thresholds) ? parsed.thresholds.map(Number) : DEFAULT_CONFIG.thresholds,
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function serializeEmailConfig(config: PlatformEmailConfig): string {
  return JSON.stringify(config)
}

export async function loadEmailConfig(admin: { from: (table: string) => any }): Promise<PlatformEmailConfig> {
  const envFrom = process.env.PLATFORM_ALERT_FROM?.trim() || process.env.RESEND_FROM?.trim() || ''
  const envTo = process.env.PLATFORM_ALERT_TO?.trim() || ''
  const hasResend = !!process.env.RESEND_API_KEY?.trim()

  const { data } = await admin
    .from('platform_settings')
    .select('value')
    .eq('key', EMAIL_CONFIG_KEY)
    .maybeSingle()

  const dbConfig = parseEmailConfig(data?.value)

  return {
    ...dbConfig,
    from_email: dbConfig.from_email || envFrom,
    operator_email: dbConfig.operator_email || envTo,
    enabled: dbConfig.enabled || (hasResend && !!envFrom && !!envTo),
    provider: dbConfig.provider || (hasResend ? 'env' : 'resend'),
  }
}

export type SendEmailResult = { ok: true; id?: string } | { ok: false; error: string }

export async function sendPlatformEmail(opts: {
  to: string
  subject: string
  html: string
  from?: string
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = opts.from || process.env.PLATFORM_ALERT_FROM?.trim() || process.env.RESEND_FROM?.trim()

  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY غير مضبوط في متغيرات البيئة' }
  }
  if (!from) {
    return { ok: false, error: 'عنوان المرسل (PLATFORM_ALERT_FROM) غير مضبوط' }
  }
  if (!opts.to?.trim()) {
    return { ok: false, error: 'لا يوجد مستلم للبريد' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [opts.to.trim()],
        subject: opts.subject,
        html: opts.html,
      }),
    })

    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = body?.message || body?.error || `Resend HTTP ${res.status}`
      return { ok: false, error: msg }
    }
    return { ok: true, id: body?.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'فشل إرسال البريد' }
  }
}
