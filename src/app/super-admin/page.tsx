'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Building2, Plus, Pencil, X, Save, Shield, CheckCircle2,
  AlertTriangle, Users, Calendar, Power, ChevronDown, Lock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { seedChartOfAccounts } from '@/lib/seed-chart-of-accounts'

// Supabase client مباشر (بدون useStore)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// كلمة مرور super-admin تُتحقق منها الآن بالخادم عبر /api/super-admin/verify — لا نص مكشوف بالمتصفح

// ── الخطط السعرية ─────────────────────────────────────────────────
const PLANS = {
  basic: {
    label: 'أساسي',
    price: 299,
    color: '#4b5563', bg: '#f3f4f6',
    maxUsers: 3,
    modules: {
      projects: true, inventory: true, purchases: false,
      employees: false, visits: false, qhse: false,
      finance: false, reports: false,
    },
  },
  advanced: {
    label: 'متقدم',
    price: 599,
    color: '#1a56db', bg: '#eff6ff',
    maxUsers: 10,
    modules: {
      projects: true, inventory: true, purchases: true,
      employees: true, visits: false, qhse: false,
      finance: true, reports: true,
    },
  },
  complete: {
    label: 'متكامل',
    price: 999,
    color: '#7c3aed', bg: '#f5f3ff',
    maxUsers: 999,
    modules: {
      projects: true, inventory: true, purchases: true,
      employees: true, visits: true, qhse: true,
      finance: true, reports: true,
    },
  },
}

const MODULE_LABELS: Record<string, string> = {
  projects:  '📁 المشاريع',
  inventory: '📦 المخزون',
  purchases: '🛒 المشتريات',
  employees: '👥 الموظفون',
  visits:    '✅ الزيارات',
  qhse:      '🛡️ السلامة والجودة',
  finance:   '💰 المالية والمحاسبة',
  reports:   '📊 التقارير',
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text2, #374151)', marginBottom: '6px' }

// ── نافذة إضافة / تعديل شركة ─────────────────────────────────────
function CompanyModal({ company, onClose, onSave }: {
  company: any | null
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:        company?.name        || '',
    name_en:     company?.name_en     || '',
    plan:        company?.plan        || 'basic',
    expires_at:  company?.expires_at  || '',
    is_active:   company?.is_active   ?? true,
    phone:       company?.phone       || '',
    email:       company?.email       || '',
    admin_username: '',
    admin_password: '',
    admin_name:     '',
  })
  const [modules, setModules] = useState<Record<string, boolean>>(
    company?.modules || { ...PLANS.basic.modules }
  )
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function applyPlan(planKey: string) {
    set('plan', planKey)
    setModules({ ...PLANS[planKey as keyof typeof PLANS].modules })
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

            {/* بيانات الشركة */}
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

            {/* الخطة */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontWeight: 600, color: 'var(--text2, #374151)', fontSize: '0.875rem', marginBottom: '8px' }}>الخطة السعرية</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {Object.entries(PLANS).map(([key, plan]) => {
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

            {/* الوحدات */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontWeight: 600, color: 'var(--text2, #374151)', fontSize: '0.875rem', marginBottom: '8px' }}>الوحدات المفعّلة</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {Object.entries(MODULE_LABELS).map(([key, label]) => {
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

            {/* الاشتراك */}
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

            {/* بيانات المستخدم الأدمن — للشركات الجديدة فقط */}
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

// ── الصفحة الرئيسية ───────────────────────────────────────────────
export default function SuperAdminPage() {
  const [authenticated, setAuth] = useState(false)
  const [password, setPassword]  = useState('')
  const [loading, setLoading]    = useState(false)
  const [companies, setCompanies] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editCompany, setEdit]    = useState<any | null>(null)

  useEffect(() => {
    const saved = sessionStorage.getItem('super_admin_auth')
    if (saved === 'true') { setAuth(true); loadCompanies() }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.ok) {
        sessionStorage.setItem('super_admin_auth', 'true')
        setAuth(true)
        loadCompanies()
      } else {
        toast.error(data.error || 'كلمة المرور غير صحيحة')
      }
    } catch {
      toast.error('تعذر الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  async function loadCompanies() {
    setLoading(true)
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
    setCompanies(data || [])
    setLoading(false)
  }

  async function handleSave(data: any) {
    try {
      if (editCompany) {
        const { error } = await supabase.from('tenants').update({
          name: data.name, name_en: data.name_en || null,
          phone: data.phone || null, email: data.email || null,
          plan: data.plan, modules: data.modules, is_active: data.is_active,
          expires_at: data.expires_at || null,
          max_users: PLANS[data.plan as keyof typeof PLANS]?.maxUsers || 3,
        }).eq('id', editCompany.id)
        if (error) throw error
        toast.success('تم تعديل بيانات الشركة ✅')
      } else {
        // إنشاء كامل بالخادم — تشفير حقيقي للباسورد + جسر Supabase Auth، لا شيء بالمتصفح
        const res = await fetch('/api/super-admin/create-tenant', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            max_users: PLANS[data.plan as keyof typeof PLANS]?.maxUsers || 3,
          }),
        })
        const result = await res.json()
        if (!result.ok) throw new Error(result.error)

        const seedResult = await seedChartOfAccounts(result.tenantId)
        if (seedResult.inserted > 0) {
          toast.success(`تم زرع ${seedResult.inserted} حساب في شجرة الحسابات المعيارية`)
        }
        toast.success(`تم إضافة شركة "${data.name}" بنجاح ✅`)
      }

      await loadCompanies()
      setShowModal(false)
      setEdit(null)
    } catch (err: any) {
      toast.error(`خطأ: ${err.message}`)
    }
  }

  async function toggleActive(company: any) {
    await supabase.from('tenants').update({ is_active: !company.is_active }).eq('id', company.id)
    await loadCompanies()
    toast.success(company.is_active ? 'تم تعطيل الشركة' : 'تم تفعيل الشركة ✅')
  }

  function daysLeft(expiresAt: string | null) {
    if (!expiresAt) return null
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
  }

  // ── شاشة تسجيل الدخول ──
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
  const revenue      = companies.filter(c => c.is_active).reduce((s, c) => s + (PLANS[c.plan as keyof typeof PLANS]?.price || 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg2, #f8fafc)', padding: '24px' }}>
      <div style={{ maxWidth: '1152px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield style={{ width: '24px', height: '24px', color: '#1a56db' }} />
              لوحة تحكم وثيق
            </h1>
            <p style={{ color: 'var(--text3)', fontSize: '0.875rem', marginTop: '2px' }}>إدارة الشركات المشتركة</p>
          </div>
          <button onClick={() => { setEdit(null); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '15px', height: '15px' }} /> إضافة شركة
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { label: 'إجمالي الشركات', value: companies.length,   color: '#2563eb', bg: '#eff6ff' },
            { label: 'شركات نشطة',     value: activeCount,         color: '#059669', bg: '#ecfdf5' },
            { label: 'تنتهي قريباً',   value: expiringSoon,        color: expiringSoon > 0 ? '#d97706' : '#4b5563', bg: expiringSoon > 0 ? '#fffbeb' : '#f3f4f6' },
            { label: 'الإيراد الشهري', value: `${revenue.toLocaleString('ar-EG')} ر.س`, color: '#7c3aed', bg: '#f5f3ff' },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* جدول الشركات */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontWeight: 600, color: 'var(--text2, #374151)' }}>الشركات المشتركة</h3>
            {loading && <span style={{ width: '16px', height: '16px', border: '2px solid rgba(26,86,219,0.3)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg2, #f8fafc)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ textAlign: 'right', padding: '10px 20px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)' }}>الشركة</th>
                  <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)' }}>الخطة</th>
                  <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)' }}>الوحدات</th>
                  <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)' }}>الانتهاء</th>
                  <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)' }}>الحالة</th>
                  <th style={{ padding: '10px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)' }}>لا توجد شركات مضافة</td>
                  </tr>
                ) : companies.map(c => {
                  const plan = PLANS[c.plan as keyof typeof PLANS]
                  const days = daysLeft(c.expires_at)
                  const mods = c.modules || {}
                  const activeModules = Object.entries(mods).filter(([, v]) => v).length
                  return (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--bg2, #f8fafc)', opacity: c.is_active ? 1 : 0.6 }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
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
                          {activeModules} / {Object.keys(MODULE_LABELS).length}
                        </div>
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                          {Object.entries(MODULE_LABELS).map(([key, label]) => (
                            <div key={key} title={label}
                              style={{ width: '8px', height: '8px', borderRadius: '50%', background: mods[key] ? '#34d399' : 'var(--bg2, #e5e7eb)' }} />
                          ))}
                        </div>
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
                        <button onClick={() => { setEdit(c); setShowModal(true) }}
                          className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: '0.72rem' }}>
                          <Pencil style={{ width: '14px', height: '14px' }} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* تحذيرات الانتهاء */}
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

      </div>

      {showModal && (
        <CompanyModal
          company={editCompany}
          onClose={() => { setShowModal(false); setEdit(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
