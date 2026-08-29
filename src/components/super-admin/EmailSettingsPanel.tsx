'use client'

import { useCallback, useEffect, useState } from 'react'
import { Mail, Send, Save, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import type { PlatformEmailConfig } from '@/lib/platform-email'

const fetchOpts = { credentials: 'include' as RequestCredentials }

const THRESHOLD_OPTIONS = [
  { value: 30, label: '30 يوم' },
  { value: 14, label: '14 يوم' },
  { value: 7, label: '7 أيام' },
  { value: 0, label: 'عند الانتهاء' },
]

export function EmailSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [envInfo, setEnvInfo] = useState<{ hasResend: boolean; hasFrom: boolean; hasOperator: boolean } | null>(null)
  const [config, setConfig] = useState<PlatformEmailConfig>({
    enabled: false,
    provider: 'env',
    from_email: '',
    operator_email: '',
    notify_tenant: true,
    thresholds: [30, 14, 7, 0],
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/email-settings', fetchOpts)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setConfig(data.config)
      setEnvInfo(data.env)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'تعذّر تحميل إعدادات البريد')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/super-admin/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...fetchOpts,
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setConfig(data.config)
      toast.success('تم حفظ إعدادات البريد ✅')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  async function sendNow() {
    setSending(true)
    try {
      const res = await fetch('/api/super-admin/send-subscription-alerts', {
        method: 'POST',
        ...fetchOpts,
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      if (data.sent > 0) {
        toast.success(`تم إرسال ${data.sent} تنبيه`)
      } else if (data.errors?.length) {
        toast.error(data.errors[0])
      } else {
        toast.success('لا توجد تنبيهات جديدة للإرسال')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'فشل الإرسال')
    } finally {
      setSending(false)
    }
  }

  function toggleThreshold(v: number) {
    setConfig(c => {
      const has = c.thresholds.includes(v)
      const thresholds = has ? c.thresholds.filter(t => t !== v) : [...c.thresholds, v]
      return { ...c, thresholds: thresholds.sort((a, b) => b - a) }
    })
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
        <span style={{ width: '20px', height: '20px', border: '2px solid rgba(26,86,219,0.3)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
          <Mail style={{ width: '18px', height: '18px', color: '#1a56db' }} />
          تنبيهات البريد — انتهاء الاشتراك
        </h3>
        <button type="button" onClick={load} className="btn btn-ghost" style={{ padding: '6px' }}>
          <RefreshCw style={{ width: '14px', height: '14px' }} />
        </button>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <span>Resend API: {envInfo?.hasResend ? '✅' : '❌ أضف RESEND_API_KEY'}</span>
        <span>مرسل: {envInfo?.hasFrom ? '✅' : '❌ PLATFORM_ALERT_FROM'}</span>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem' }}>
          <input type="checkbox" checked={config.enabled} onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} />
          تفعيل التنبيهات البريدية
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>بريد المرسل</label>
            <input value={config.from_email} onChange={e => setConfig(c => ({ ...c, from_email: e.target.value }))}
              className="input" dir="ltr" placeholder="Wathiq <noreply@yourdomain.com>" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>بريد المشغّل (Super Admin)</label>
            <input value={config.operator_email} onChange={e => setConfig(c => ({ ...c, operator_email: e.target.value }))}
              className="input" dir="ltr" placeholder="admin@yourdomain.com" />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem' }}>
          <input type="checkbox" checked={config.notify_tenant} onChange={e => setConfig(c => ({ ...c, notify_tenant: e.target.checked }))} />
          إرسال نسخة لبريد الشركة (إن وُجد)
        </label>

        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>مواعيد التنبيه</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {THRESHOLD_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => toggleThreshold(opt.value)}
                style={{
                  padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer',
                  border: `2px solid ${config.thresholds.includes(opt.value) ? '#1a56db' : 'var(--border)'}`,
                  background: config.thresholds.includes(opt.value) ? '#eff6ff' : 'transparent',
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
          <button type="submit" disabled={saving} className="btn btn-primary">
            <Save style={{ width: '14px', height: '14px' }} />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
          <button type="button" disabled={sending || !config.enabled} onClick={sendNow} className="btn btn-ghost">
            <Send style={{ width: '14px', height: '14px' }} />
            {sending ? 'جاري الإرسال...' : 'إرسال التنبيهات الآن'}
          </button>
        </div>
      </form>

      <p style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '12px', lineHeight: 1.5 }}>
        للجدولة اليومية: اضبط <code style={{ direction: 'ltr' }}>CRON_SECRET</code> واستدعِ{' '}
        <code style={{ direction: 'ltr', fontSize: '0.68rem' }}>/api/cron/subscription-alerts?secret=...</code>
      </p>
    </div>
  )
}
