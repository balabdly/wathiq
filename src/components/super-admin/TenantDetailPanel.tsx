'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Building2, X, Users, FolderKanban, KeyRound, CalendarPlus, RefreshCw,
  Clock, Shield, Wrench, Download,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PLANS, normalizePlan } from '@/lib/tenant-plans'

const fetchOpts = { credentials: 'include' as RequestCredentials }

const ACTION_LABELS: Record<string, string> = {
  tenant_created: 'إنشاء شركة',
  tenant_updated: 'تعديل شركة',
  tenant_toggled: 'تفعيل/إيقاف',
  subscription_extended: 'تمديد اشتراك',
  admin_password_reset: 'إعادة تعيين كلمة مرور الأدمن',
  maintenance_toggled: 'وضع الصيانة',
  tenant_exported: 'تصدير بيانات',
}

type TenantDetailPanelProps = {
  tenantId: string
  onClose: () => void
  onUpdated: () => void
}

export function TenantDetailPanel({ tenantId, onClose, onUpdated }: TenantDetailPanelProps) {
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [extending, setExtending] = useState<number | null>(null)
  const [maintenanceMsg, setMaintenanceMsg] = useState('')
  const [maintenanceBusy, setMaintenanceBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/super-admin/tenant-detail?id=${tenantId}`, fetchOpts)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'تعذّر تحميل التفاصيل')
      setDetail(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
      toast.error(message)
      onClose()
    } finally {
      setLoading(false)
    }
  }, [tenantId, onClose])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (detail?.tenant?.maintenance_message) {
      setMaintenanceMsg(detail.tenant.maintenance_message)
    }
  }, [detail?.tenant?.maintenance_message])

  async function toggleMaintenance(enable?: boolean) {
    setMaintenanceBusy(true)
    try {
      const res = await fetch('/api/super-admin/set-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...fetchOpts,
        body: JSON.stringify({
          id: tenantId,
          maintenance_mode: enable,
          maintenance_message: maintenanceMsg,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      toast.success(data.maintenance_mode ? 'تم تفعيل وضع الصيانة' : 'تم إيقاف وضع الصيانة')
      await load()
      onUpdated()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'فشل تغيير وضع الصيانة')
    } finally {
      setMaintenanceBusy(false)
    }
  }

  async function exportTenant() {
    setExporting(true)
    try {
      const res = await fetch(`/api/super-admin/export-tenant?id=${tenantId}`, fetchOpts)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'فشل التصدير')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wathiq-export-${detail?.tenant?.name || tenantId}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('تم تصدير البيانات ✅')
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'فشل التصدير')
    } finally {
      setExporting(false)
    }
  }

  async function extendSubscription(days: number) {
    setExtending(days)
    try {
      const res = await fetch('/api/super-admin/extend-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...fetchOpts,
        body: JSON.stringify({ id: tenantId, days }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      toast.success(`تم تمديد الاشتراك ${days} يوماً ✅`)
      await load()
      onUpdated()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'فشل التمديد')
    } finally {
      setExtending(null)
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error('كلمة المرور 6 أحرف على الأقل')
      return
    }
    setResetting(true)
    try {
      const res = await fetch('/api/super-admin/reset-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...fetchOpts,
        body: JSON.stringify({ tenantId, newPassword }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      toast.success('تم تحديث كلمة مرور الأدmin ✅')
      setNewPassword('')
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'فشل إعادة التعيين')
    } finally {
      setResetting(false)
    }
  }

  const tenant = detail?.tenant
  const stats = detail?.stats
  const plan = tenant ? PLANS[normalizePlan(tenant.plan)] : null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '760px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 style={{ width: '20px', height: '20px', color: '#1a56db' }} />
            {loading ? 'جاري التحميل...' : tenant?.name}
          </h3>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="button" onClick={load} className="btn btn-ghost" style={{ padding: '6px' }} title="تحديث">
              <RefreshCw style={{ width: '16px', height: '16px' }} />
            </button>
            <button type="button" onClick={onClose} style={{ padding: '4px', borderRadius: '8px', border: 'none', background: 'none', cursor: 'pointer' }}>
              <X style={{ width: '20px', height: '20px', color: 'var(--text3)' }} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <span style={{ width: '24px', height: '24px', border: '2px solid rgba(26,86,219,0.3)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                {[
                  { icon: Users, label: 'مستخدمون نشطون', value: `${stats?.activeUsers ?? 0} / ${stats?.maxUsers === 999 ? '∞' : stats?.maxUsers ?? '—'}` },
                  { icon: FolderKanban, label: 'مشاريع نشطة', value: stats?.activeProjects ?? 0 },
                  { icon: Shield, label: 'الخطة', value: plan?.label || tenant?.plan },
                  { icon: Clock, label: 'الانتهاء', value: tenant?.expires_at ? new Date(tenant.expires_at).toLocaleDateString('ar-EG') : '—' },
                ].map(item => (
                  <div key={item.label} className="card" style={{ padding: '14px' }}>
                    <item.icon style={{ width: '18px', height: '18px', color: '#1a56db', marginBottom: '6px' }} />
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{item.value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{item.label}</div>
                  </div>
                ))}
              </div>

              {detail?.owner && (
                <div style={{ marginBottom: '20px', padding: '14px', borderRadius: '12px', background: 'var(--bg2, #f8fafc)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px' }}>مدير الشركة</div>
                  <div style={{ fontSize: '0.875rem' }}>
                    <strong>{detail.owner.name}</strong>
                    <span style={{ color: 'var(--text3)', marginRight: '8px' }}> — @{detail.owner.username}</span>
                  </div>
                  {detail.owner.last_login_at && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>
                      آخر دخول: {new Date(detail.owner.last_login_at).toLocaleString('ar-EG')}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '20px', padding: '14px', borderRadius: '12px', border: `1px solid ${tenant?.maintenance_mode ? '#fcd34d' : 'var(--border)'}`, background: tenant?.maintenance_mode ? '#fffbeb' : 'var(--bg2, #f8fafc)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wrench style={{ width: '16px', height: '16px' }} /> وضع الصيانة
                  {tenant?.maintenance_mode && <span style={{ fontSize: '0.72rem', color: '#b45309' }}>(مفعّل)</span>}
                </div>
                <input
                  value={maintenanceMsg}
                  onChange={e => setMaintenanceMsg(e.target.value)}
                  className="input"
                  placeholder="رسالة تظهر للمستخدمين عند محاولة الدخول"
                  style={{ marginBottom: '8px' }}
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" disabled={maintenanceBusy} onClick={() => toggleMaintenance(true)} className="btn btn-ghost">
                    تفعيل الصيانة
                  </button>
                  <button type="button" disabled={maintenanceBusy || !tenant?.maintenance_mode} onClick={() => toggleMaintenance(false)} className="btn btn-ghost">
                    إيقاف الصيانة
                  </button>
                  <button type="button" disabled={exporting} onClick={exportTenant} className="btn btn-ghost" style={{ marginRight: 'auto' }}>
                    <Download style={{ width: '14px', height: '14px' }} />
                    {exporting ? 'جاري التصدير...' : 'تصدير JSON'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CalendarPlus style={{ width: '16px', height: '16px' }} /> تمديد الاشتراك
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[30, 90, 365].map(days => (
                    <button
                      key={days}
                      type="button"
                      disabled={extending !== null}
                      onClick={() => extendSubscription(days)}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.875rem' }}
                    >
                      {extending === days
                        ? '...'
                        : days === 365 ? '+ سنة' : days === 90 ? '+ 90 يوم' : '+ 30 يوم'}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={resetPassword} style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <KeyRound style={{ width: '16px', height: '16px' }} /> إعادة تعيين كلمة مرور الأدmin
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="input"
                    placeholder="كلمة مرور جديدة (6+ أحرف)"
                    dir="ltr"
                    minLength={6}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" disabled={resetting} className="btn btn-primary">
                    {resetting ? '...' : 'حفظ'}
                  </button>
                </div>
              </form>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px' }}>المستخدمون</div>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg2, #f8fafc)' }}>
                      <tr>
                        <th style={{ textAlign: 'right', padding: '8px 12px' }}>الاسم</th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>المستخدم</th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>آخر دخول</th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail?.users || []).map((u: any) => (
                        <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px' }}>
                            {u.name}
                            {u.is_tenant_owner && <span style={{ marginRight: '6px', fontSize: '0.65rem', color: '#1a56db' }}>مدير</span>}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', direction: 'ltr' }}>{u.username}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text3)' }}>
                            {u.last_login_at ? new Date(u.last_login_at).toLocaleString('ar-EG') : '—'}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {u.is_active ? '✅' : '⏸'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {(detail?.auditLog?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px' }}>سجل العمليات</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                    {detail.auditLog.map((entry: any) => (
                      <div key={entry.id} style={{ fontSize: '0.72rem', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg2, #f8fafc)' }}>
                        <strong>{ACTION_LABELS[entry.action] || entry.action}</strong>
                        <span style={{ color: 'var(--text3)', marginRight: '8px' }}>
                          — {new Date(entry.created_at).toLocaleString('ar-EG')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
