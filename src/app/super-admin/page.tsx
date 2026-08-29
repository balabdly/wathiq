'use client'
import { useEffect, useState } from 'react'
import {
  Building2, Plus, Pencil, X, Save, Shield, CheckCircle2,
  AlertTriangle, Users, Lock, LogOut, Eye, Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { TenantDetailPanel } from '@/components/super-admin/TenantDetailPanel'
import { EmailSettingsPanel } from '@/components/super-admin/EmailSettingsPanel'
import type { PlanTemplate } from '@/lib/plan-templates'
import {
  PLANS,
  MODULE_LABELS,
  ALL_MODULE_KEYS,
  defaultModulesForPlan,
  mergeTenantModules,
  normalizePlan,
  type TenantPlanKey,
} from '@/lib/tenant-plans'

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600,
  color: 'var(--text2, #374151)', marginBottom: '6px',
}

const fetchOpts = { credentials: 'include' as RequestCredentials }

function CompanyModal({ company, onClose, onSave, templates, onSaveTemplate }: {
  company: any | null
  onClose: () => void
  onSave: (data: any) => Promise<void>
  templates: PlanTemplate[]
  onSaveTemplate: (name: string, plan: TenantPlanKey, modules: Record<string, boolean>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const initialPlan = normalizePlan(company?.plan)
  const [form, setForm] = useState({
    name:        company?.name        || '',
    name_en:     company?.name_en     || '',
    plan:        initialPlan,
    expires_at:  company?.expires_at  || '',
    is_active:   company?.is_active   ?? true,
    phone:       company?.phone       || '',
    email:       company?.email       || '',
    admin_username: '',
    admin_password: '',
    admin_name:     '',
  })
  const [modules, setModules] = useState<Record<string, boolean>>(
    company?.modules
      ? mergeTenantModules(company.modules, initialPlan)
      : defaultModulesForPlan('basic'),
  )
  const [templateName, setTemplateName] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function applyTemplate(t: PlanTemplate) {
    set('plan', t.plan)
    setModules({ ...t.modules })
  }

  function applyPlan(planKey: TenantPlanKey) {
    set('plan', planKey)
    if (!company) {
      setModules({ ...defaultModulesForPlan(planKey) })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (!company && (!form.admin_username || !form.admin_password || !form.admin_name)) {
      toast.error('بيانات المستخدم الأدمن مطلوبة للشركة الجديدة')
      return
    }
    setSaving(true)
    await onSave({ ...form, modules })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 style={{ width: '20px', height: '20px', color: '#1a56db' }} />
            {company ? 'تعديل بيانات الشركة' : 'إضافة شركة جديدة'}
          </h3>
          <button onClick={onClose} style={{ padding: '4px', borderRadius: '8px', border: 'none', background: 'none', cursor: 'pointer' }}>
            <X style={{ width: '20px', height: '20px', color: 'var(--text3)' }} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {!company && templates.length > 0 && (
              <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '12px', background: 'var(--bg2, #f8fafc)', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px' }}>قوالب الخطط المحفوظة</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {templates.map(t => (
                    <button key={t.id} type="button" onClick={() => applyTemplate(t)} className="btn btn-ghost" style={{ fontSize: '0.8rem' }}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!company && (
              <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                <input value={templateName} onChange={e => setTemplateName(e.target.value)} className="input" placeholder="اسم قالب جديد (اختياري)" style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost" onClick={async () => {
                  if (!templateName.trim()) { toast.error('أدخل اسم القالب'); return }
                  await onSaveTemplate(templateName.trim(), form.plan, modules)
                  setTemplateName('')
                }}>حفظ كقالب</button>
              </div>
            )}

            <div style={{ fontWeight: 600, color: 'var(--text2, #374151)', fontSize: '0.875rem', marginBottom: '8px' }}>بيانات الشركة</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>اسم الشركة (عربي) <span style={{ color: '#ef4444' }}>*</span></label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="input" required />
              </div>
              <div>
                <label style={lbl}>اسم الشركة (إنجليزي)</label>
                <input value={form.name_en} onChange={e => set('name_en', e.target.value)} className="input" dir="ltr" />
              </div>
              <div>
                <label style={lbl}>الجوال</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" dir="ltr" />
              </div>
              <div>
                <label style={lbl}>البريد الإلكتروني</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" dir="ltr" />
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <div style={{ fontWeight: 600, color: 'var(--text2, #374151)', fontSize: '0.875rem', marginBottom: '8px' }}>الخطة السعرية</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {(Object.entries(PLANS) as [TenantPlanKey, typeof PLANS.basic][]).map(([key, plan]) => {
                  const active = form.plan === key
                  return (
                    <button key={key} type="button" onClick={() => applyPlan(key)}
                      style={{
                        padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
                        border: `2px solid ${active ? '#1a56db' : 'var(--border)'}`,
                        background: active ? '#eff6ff' : 'transparent',
                      }}>
                      <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700, marginBottom: '4px', background: plan.bg, color: plan.color }}>
                        {plan.label}
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{plan.price}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>ر.س / شهر</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>
                        {plan.maxUsers === 999 ? 'غير محدود' : plan.maxUsers} مستخدم
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <div style={{ fontWeight: 600, color: 'var(--text2, #374151)', fontSize: '0.875rem', marginBottom: '8px' }}>الوحدات المفعّلة</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {ALL_MODULE_KEYS.map(key => {
                  const label = MODULE_LABELS[key]
                  const on = modules[key]
                  return (
                    <button key={key} type="button"
                      onClick={() => setModules(m => ({ ...m, [key]: !m[key] }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '12px',
                        fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                        border: `2px solid ${on ? '#6ee7b7' : 'var(--border)'}`,
                        background: on ? '#ecfdf5' : 'transparent',
                        color: on ? '#047857' : 'var(--text3)',
                      }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: on ? '#10b981' : 'var(--bg2, #e5e7eb)' }}>
                        {on && <CheckCircle2 style={{ width: '13px', height: '13px', color: 'white' }} />}
                      </div>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
              <div>
                <label style={lbl}>تاريخ انتهاء الاشتراك</label>
                <input type="date" value={form.expires_at} onChange={e => set('expires_at', e.target.value)} className="input" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '24px' }}>
                <button type="button" onClick={() => set('is_active', !form.is_active)}
                  style={{ position: 'relative', width: '48px', height: '24px', borderRadius: '999px', border: 'none', cursor: 'pointer', transition: 'background 0.15s', background: form.is_active ? '#10b981' : '#d1d5db' }}>
                  <div style={{ position: 'absolute', top: '4px', width: '16px', height: '16px', background: 'white', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,0.15)', transition: 'right 0.15s, left 0.15s', right: form.is_active ? '4px' : 'auto', left: form.is_active ? 'auto' : '4px' }} />
                </button>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text2, #374151)' }}>
                  {form.is_active ? '✅ نشط' : '⏸ موقوف'}
                </span>
              </div>
            </div>

            {!company && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontWeight: 600, color: 'var(--text2, #374151)', fontSize: '0.875rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users style={{ width: '15px', height: '15px' }} />
                  بيانات مستخدم الأدمن للشركة
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={lbl}>الاسم <span style={{ color: '#ef4444' }}>*</span></label>
                    <input value={form.admin_name} onChange={e => set('admin_name', e.target.value)}
                      className="input" placeholder="اسم المدير" required={!company} />
                  </div>
                  <div>
                    <label style={lbl}>اسم المستخدم <span style={{ color: '#ef4444' }}>*</span></label>
                    <input value={form.admin_username} onChange={e => set('admin_username', e.target.value)}
                      className="input" dir="ltr" placeholder="admin" required={!company} />
                  </div>
                  <div>
                    <label style={lbl}>كلمة المرور <span style={{ color: '#ef4444' }}>*</span></label>
                    <input value={form.admin_password} onChange={e => set('admin_password', e.target.value)}
                      className="input" dir="ltr" placeholder="••••••" required={!company} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving
                ? <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                : <Save style={{ width: '16px', height: '16px' }} />}
              {company ? 'حفظ التعديلات' : 'إضافة الشركة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SuperAdminPage() {
  const [authenticated, setAuth] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [password, setPassword]  = useState('')
  const [loading, setLoading]    = useState(false)
  const [companies, setCompanies] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editCompany, setEdit]    = useState<any | null>(null)
  const [detailId, setDetailId]   = useState<string | null>(null)
  const [globalAudit, setGlobalAudit] = useState<any[]>([])
  const [platformStats, setPlatformStats] = useState<any>(null)
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'expired' | 'maintenance'>('all')
  const [planFilter, setPlanFilter] = useState<'all' | TenantPlanKey>('all')

  useEffect(() => {
    fetch('/api/super-admin/session', fetchOpts)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setAuth(true)
          loadCompanies()
          loadGlobalAudit()
          loadPlatformStats()
          loadPlanTemplates()
        }
      })
      .finally(() => setCheckingSession(false))
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.ok) {
        setAuth(true)
        setPassword('')
        loadCompanies()
        loadGlobalAudit()
        loadPlatformStats()
        loadPlanTemplates()
      } else {
        toast.error(data.error || 'كلمة المرور غير صحيحة')
      }
    } catch {
      toast.error('تعذر الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/super-admin/logout', { method: 'POST', ...fetchOpts })
    setAuth(false)
    setCompanies([])
  }

  async function loadPlatformStats() {
    try {
      const res = await fetch('/api/super-admin/platform-stats', fetchOpts)
      const data = await res.json()
      if (data.ok) setPlatformStats(data.stats)
    } catch { /* optional */ }
  }

  async function loadPlanTemplates() {
    try {
      const res = await fetch('/api/super-admin/plan-templates', fetchOpts)
      const data = await res.json()
      if (data.ok) setPlanTemplates(data.templates || [])
    } catch { /* optional */ }
  }

  async function savePlanTemplate(name: string, plan: TenantPlanKey, modules: Record<string, boolean>) {
    const res = await fetch('/api/super-admin/plan-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, plan, modules }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error)
    setPlanTemplates(data.templates || [])
    toast.success('تم حفظ القالب ✅')
  }

  async function loadGlobalAudit() {
    try {
      const res = await fetch('/api/super-admin/audit-log?limit=30', fetchOpts)
      const data = await res.json()
      if (data.ok) setGlobalAudit(data.entries || [])
    } catch {
      /* optional */
    }
  }

  async function loadCompanies() {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/tenants', fetchOpts)
      const data = await res.json()
      if (!data.ok) {
        if (res.status === 401) setAuth(false)
        toast.error(data.error || 'تعذّر تحميل الشركات')
        return
      }
      setCompanies(data.tenants || [])
    } catch {
      toast.error('تعذّر تحميل الشركات')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(data: any) {
    try {
      const planKey = normalizePlan(data.plan)
      const payload = {
        ...data,
        plan: planKey,
        max_users: PLANS[planKey].maxUsers,
      }

      if (editCompany) {
        const res = await fetch('/api/super-admin/update-tenant', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: editCompany.id, ...payload }),
        })
        const result = await res.json()
        if (!result.ok) throw new Error(result.error)
        toast.success('تم تعديل بيانات الشركة ✅')
      } else {
        const res = await fetch('/api/super-admin/create-tenant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (!result.ok) throw new Error(result.error)
        if (result.seedInserted > 0) {
          toast.success(`تم زرع ${result.seedInserted} حساب في شجرة الحسابات المعيارية`)
        }
        toast.success(`تم إضافة شركة "${data.name}" بنجاح ✅`)
      }

      await loadCompanies()
      await loadGlobalAudit()
      await loadPlatformStats()
      setShowModal(false)
      setEdit(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
      toast.error(`خطأ: ${message}`)
    }
  }

  async function toggleActive(company: any) {
    if (company.is_active && !confirm(`تعطيل شركة "${company.name}"؟\n\nلن يتمكن مستخدموها من الدخول.`)) return
    try {
      const res = await fetch('/api/super-admin/toggle-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: company.id }),
      })
      const result = await res.json()
      if (!result.ok) throw new Error(result.error)
      await loadCompanies()
      await loadGlobalAudit()
      await loadPlatformStats()
      toast.success(result.is_active ? 'تم تفعيل الشركة ✅' : 'تم تعطيل الشركة')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'خطأ غير متوقع'
      toast.error(message)
    }
  }

  function daysLeft(expiresAt: string | null) {
    if (!expiresAt) return null
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
  }

  if (checkingSession) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2, #f8fafc)' }}>
        <span style={{ width: '24px', height: '24px', border: '2px solid rgba(26,86,219,0.3)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2, #f8fafc)' }}>
        <div className="card" style={{ padding: '32px', width: '100%', maxWidth: '380px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ width: '56px', height: '56px', background: '#1a56db', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Shield style={{ width: '28px', height: '28px', color: 'white' }} />
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>لوحة تحكم وثيق</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text3)', marginTop: '4px' }}>Super Admin — للمشغّل فقط</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={lbl}>كلمة المرور</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input" placeholder="••••••••" autoFocus required />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              {loading
                ? <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                : <Lock style={{ width: '15px', height: '15px' }} />} دخول
            </button>
          </form>
        </div>
      </div>
    )
  }

  const activeCount  = companies.filter(c => c.is_active).length
  const expiringSoon = companies.filter(c => { const d = daysLeft(c.expires_at); return d !== null && d <= 14 && d > 0 }).length
  const expiredCount = companies.filter(c => { const d = daysLeft(c.expires_at); return d !== null && d <= 0 }).length
  const revenue = platformStats?.mrr ?? companies.filter(c => c.is_active).reduce((s, c) => {
    const plan = PLANS[normalizePlan(c.plan)]
    return s + (plan?.price || 0)
  }, 0)

  const userCounts: Record<string, number> = platformStats?.userCountsByTenant || {}

  const filteredCompanies = companies.filter(c => {
    const q = search.trim().toLowerCase()
    if (q) {
      const hay = `${c.name} ${c.name_en || ''} ${c.email || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (planFilter !== 'all' && normalizePlan(c.plan) !== planFilter) return false
    const days = daysLeft(c.expires_at)
    if (statusFilter === 'active' && !c.is_active) return false
    if (statusFilter === 'suspended' && c.is_active !== false) return false
    if (statusFilter === 'expired' && (days === null || days > 0)) return false
    if (statusFilter === 'maintenance' && !c.maintenance_mode) return false
    return true
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg2, #f8fafc)', padding: '24px' }}>
      <div style={{ maxWidth: '1152px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield style={{ width: '24px', height: '24px', color: '#1a56db' }} />
              لوحة تحكم وثيق
            </h1>
            <p style={{ color: 'var(--text3)', fontSize: '0.875rem', marginTop: '2px' }}>إدارة الشركات المشتركة</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleLogout} className="btn btn-ghost">
              <LogOut style={{ width: '15px', height: '15px' }} /> خروج
            </button>
            <button onClick={() => { setEdit(null); setShowModal(true) }} className="btn btn-primary">
              <Plus style={{ width: '15px', height: '15px' }} /> إضافة شركة
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {[
            { label: 'إجمالي الشركات', value: platformStats?.totalTenants ?? companies.length, color: '#2563eb' },
            { label: 'شركات نشطة', value: platformStats?.activeTenants ?? activeCount, color: '#059669' },
            { label: 'اشتراكات منتهية', value: platformStats?.expiringAlerts?.expired?.length ?? expiredCount, color: expiredCount > 0 ? '#dc2626' : '#4b5563' },
            { label: 'تنتهي خلال 14 يوم', value: expiringSoon, color: expiringSoon > 0 ? '#d97706' : '#4b5563' },
            { label: 'مستخدمون نشطون', value: platformStats?.totalActiveUsers ?? '—', color: '#0ea5e9' },
            { label: 'MRR (تقديري)', value: `${revenue.toLocaleString('ar-EG')} ر.س`, color: '#7c3aed' },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {platformStats?.topModules?.length > 0 && (
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontWeight: 600, marginBottom: '10px', fontSize: '0.875rem' }}>أكثر الوحدات تفعيلاً</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {platformStats.topModules.slice(0, 5).map((m: { key: string; count: number }) => (
                <span key={m.key} style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '8px', background: 'var(--bg2, #f8fafc)' }}>
                  {MODULE_LABELS[m.key as keyof typeof MODULE_LABELS] || m.key}: {m.count}
                </span>
              ))}
            </div>
          </div>
        )}

        <EmailSettingsPanel />

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontWeight: 600, color: 'var(--text2, #374151)' }}>الشركات المشتركة</h3>
              {loading && <span style={{ width: '16px', height: '16px', border: '2px solid rgba(26,86,219,0.3)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 220px' }}>
                <Search style={{ width: '16px', height: '16px', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} className="input" placeholder="بحث بالاسم أو البريد..." style={{ paddingRight: '34px' }} />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="input" style={{ width: 'auto', minWidth: '140px' }}>
                <option value="all">كل الحالات</option>
                <option value="active">نشطة</option>
                <option value="suspended">موقوفة</option>
                <option value="expired">منتهية</option>
                <option value="maintenance">صيانة</option>
              </select>
              <select value={planFilter} onChange={e => setPlanFilter(e.target.value as typeof planFilter)} className="input" style={{ width: 'auto', minWidth: '120px' }}>
                <option value="all">كل الخطط</option>
                {(Object.keys(PLANS) as TenantPlanKey[]).map(k => (
                  <option key={k} value={k}>{PLANS[k].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg2, #f8fafc)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ textAlign: 'right', padding: '10px 20px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)' }}>الشركة</th>
                  <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)' }}>الخطة</th>
                  <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)' }}>الوحدات</th>
                  <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)' }}>المستخدمون</th>
                  <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)' }}>الانتهاء</th>
                  <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)' }}>الحالة</th>
                  <th style={{ padding: '10px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)' }}>لا توجد شركات مطابقة</td>
                  </tr>
                ) : filteredCompanies.map(c => {
                  const plan = PLANS[normalizePlan(c.plan)]
                  const days = daysLeft(c.expires_at)
                  const mods = mergeTenantModules(c.modules, c.plan)
                  const activeModules = ALL_MODULE_KEYS.filter(k => mods[k]).length
                  return (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--bg2, #f8fafc)', opacity: c.is_active ? 1 : 0.6 }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                        {c.maintenance_mode && <span style={{ fontSize: '0.65rem', color: '#b45309', fontWeight: 600 }}>🔧 صيانة</span>}
                        {c.name_en && <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }} dir="ltr">{c.name_en}</div>}
                        {c.email && <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{c.email}</div>}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700, background: plan?.bg || '#f3f4f6', color: plan?.color || '#4b5563' }}>
                          {plan?.label || c.plan}
                        </span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>{plan?.price} ر.س/شهر</div>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text2, #374151)' }}>
                          {activeModules} / {ALL_MODULE_KEYS.length}
                        </div>
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                          {ALL_MODULE_KEYS.map(key => (
                            <div key={key} title={MODULE_LABELS[key]}
                              style={{ width: '8px', height: '8px', borderRadius: '50%', background: mods[key] ? '#34d399' : 'var(--bg2, #e5e7eb)' }} />
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600 }}>
                        {userCounts[c.id] ?? '—'}
                        {c.max_users && c.max_users < 999 && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>/ {c.max_users}</div>
                        )}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        {c.expires_at ? (
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text2, #4b5563)' }}>
                              {new Date(c.expires_at).toLocaleDateString('ar-EG')}
                            </div>
                            {days !== null && (
                              <div style={{ fontSize: '0.72rem', fontWeight: 600, marginTop: '2px', color: days <= 0 ? '#dc2626' : days <= 14 ? '#d97706' : '#059669' }}>
                                {days <= 0 ? '⛔ منتهي' : days <= 14 ? `⚠ ${days} يوم` : `✓ ${days} يوم`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text3)', fontSize: '0.72rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <button onClick={() => toggleActive(c)}
                          style={{
                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                            background: c.is_active ? '#d1fae5' : '#fee2e2',
                            color: c.is_active ? '#047857' : '#dc2626',
                          }}>
                          {c.is_active ? '✅ نشط' : '⏸ موقوف'}
                        </button>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => setDetailId(c.id)}
                            className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: '0.72rem' }} title="التفاصيل">
                            <Eye style={{ width: '14px', height: '14px' }} />
                          </button>
                          <button onClick={() => { setEdit(c); setShowModal(true) }}
                            className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: '0.72rem' }}>
                            <Pencil style={{ width: '14px', height: '14px' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {expiredCount > 0 && (
          <div className="card" style={{ padding: '16px', border: '1px solid #fecaca', background: 'rgba(254,242,242,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle style={{ width: '20px', height: '20px', color: '#dc2626' }} />
              <span style={{ fontWeight: 600, color: '#b91c1c' }}>اشتراكات منتهية ({expiredCount})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {companies
                .filter(c => { const d = daysLeft(c.expires_at); return d !== null && d <= 0 })
                .map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text2, #374151)' }}>{c.name}</span>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: '0.72rem' }} onClick={() => setDetailId(c.id)}>تمديد</button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {expiringSoon > 0 && (
          <div className="card" style={{ padding: '16px', border: '1px solid #fde68a', background: 'rgba(255,251,235,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
              <span style={{ fontWeight: 600, color: '#b45309' }}>اشتراكات تنتهي قريباً</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {companies
                .filter(c => { const d = daysLeft(c.expires_at); return d !== null && d <= 14 && d > 0 })
                .map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text2, #374151)' }}>{c.name}</span>
                    <span style={{ color: '#d97706', fontWeight: 600 }}>{daysLeft(c.expires_at)} يوم متبقي</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {globalAudit.length > 0 && (
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontWeight: 600, color: 'var(--text2, #374151)', marginBottom: '12px' }}>آخر العمليات</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
              {globalAudit.map(entry => (
                <div key={entry.id} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span>
                    <strong>{entry.tenant_name || '—'}</strong>
                    <span style={{ color: 'var(--text3)', marginRight: '6px' }}>{entry.action}</span>
                  </span>
                  <span style={{ color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                    {new Date(entry.created_at).toLocaleString('ar-EG')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {detailId && (
        <TenantDetailPanel
          tenantId={detailId}
          onClose={() => setDetailId(null)}
          onUpdated={() => { loadCompanies(); loadGlobalAudit(); loadPlatformStats() }}
        />
      )}

      {showModal && (
        <CompanyModal
          company={editCompany}
          onClose={() => { setShowModal(false); setEdit(null) }}
          onSave={handleSave}
          templates={planTemplates}
          onSaveTemplate={savePlanTemplate}
        />
      )}
    </div>
  )
}
