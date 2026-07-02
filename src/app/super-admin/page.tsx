'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { hashPassword } from '@/lib/password'
import {
  Building2, Plus, Pencil, X, Save, Shield, CheckCircle2,
  AlertTriangle, Users, Calendar, Power, ChevronDown, Lock
} from 'lucide-react'
import toast from 'react-hot-toast'

// Supabase client مباشر (بدون useStore)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── كلمة مرور الأدمن ─────────────────────────────────────────────
const SUPER_ADMIN_PASSWORD = 'wathiq@super2024'

// ── الخطط السعرية ─────────────────────────────────────────────────
const PLANS = {
  basic: {
    label: 'أساسي',
    price: 299,
    color: 'bg-gray-100 text-gray-700',
    badge: 'badge-gray',
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
    color: 'bg-blue-100 text-blue-700',
    badge: 'badge-blue',
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
    color: 'bg-purple-100 text-purple-700',
    badge: 'badge-purple',
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
    // بيانات المستخدم الأدمن (للشركات الجديدة فقط)
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
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-500" />
            {company ? 'تعديل بيانات الشركة' : 'إضافة شركة جديدة'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            {/* بيانات الشركة */}
            <div className="font-semibold text-gray-700 text-sm mb-2">بيانات الشركة</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  اسم الشركة (عربي) <span className="text-red-500">*</span>
                </label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الشركة (إنجليزي)</label>
                <input value={form.name_en} onChange={e => set('name_en', e.target.value)} className="input" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الجوال</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" dir="ltr" />
              </div>
            </div>

            {/* الخطة */}
            <div>
              <div className="font-semibold text-gray-700 text-sm mb-2">الخطة السعرية</div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(PLANS).map(([key, plan]) => (
                  <button key={key} type="button" onClick={() => applyPlan(key)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      form.plan === key
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold mb-1 ${plan.color}`}>
                      {plan.label}
                    </div>
                    <div className="text-lg font-bold text-gray-800">{plan.price}</div>
                    <div className="text-xs text-gray-400">ر.س / شهر</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {plan.maxUsers === 999 ? 'غير محدود' : plan.maxUsers} مستخدم
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* الوحدات */}
            <div>
              <div className="font-semibold text-gray-700 text-sm mb-2">الوحدات المفعّلة</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(MODULE_LABELS).map(([key, label]) => (
                  <button key={key} type="button"
                    onClick={() => setModules(m => ({ ...m, [key]: !m[key] }))}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                      modules[key]
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 text-gray-400'
                    }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      modules[key] ? 'bg-emerald-500' : 'bg-gray-200'
                    }`}>
                      {modules[key] && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* الاشتراك */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ انتهاء الاشتراك</label>
                <input type="date" value={form.expires_at} onChange={e => set('expires_at', e.target.value)} className="input" />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <button type="button" onClick={() => set('is_active', !form.is_active)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    form.is_active ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    form.is_active ? 'right-1' : 'left-1'
                  }`} />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  {form.is_active ? '✅ نشط' : '⏸ موقوف'}
                </span>
              </div>
            </div>

            {/* بيانات المستخدم الأدمن — للشركات الجديدة فقط */}
            {!company && (
              <div>
                <div className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  بيانات مستخدم الأدمن للشركة
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      الاسم <span className="text-red-500">*</span>
                    </label>
                    <input value={form.admin_name} onChange={e => set('admin_name', e.target.value)}
                      className="input" placeholder="اسم المدير" required={!company} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      اسم المستخدم <span className="text-red-500">*</span>
                    </label>
                    <input value={form.admin_username} onChange={e => set('admin_username', e.target.value)}
                      className="input" dir="ltr" placeholder="admin" required={!company} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      كلمة المرور <span className="text-red-500">*</span>
                    </label>
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
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Save className="w-4 h-4" />}
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

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (password === SUPER_ADMIN_PASSWORD) {
      sessionStorage.setItem('super_admin_auth', 'true')
      setAuth(true)
      loadCompanies()
    } else {
      toast.error('كلمة المرور غير صحيحة')
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
      const tenantData = {
        name:       data.name,
        name_en:    data.name_en     || null,
        phone:      data.phone       || null,
        email:      data.email       || null,
        plan:       data.plan,
        modules:    data.modules,
        is_active:  data.is_active,
        expires_at: data.expires_at  || null,
        max_users:  PLANS[data.plan as keyof typeof PLANS]?.maxUsers || 3,
      }

      if (editCompany) {
        // تعديل شركة موجودة
        const { error } = await supabase.from('tenants').update(tenantData).eq('id', editCompany.id)
        if (error) throw error
        toast.success('تم تعديل بيانات الشركة ✅')
      } else {
        // إضافة شركة جديدة
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants').insert({ ...tenantData }).select().single()
        if (tenantError) throw tenantError

        // إنشاء فرع رئيسي
        const { data: branch, error: branchError } = await supabase
          .from('branches').insert({
            tenant_id: tenant.id,
            name: 'الفرع الرئيسي',
            color: '#1a56db',
          }).select().single()
        if (branchError) throw branchError

        // إنشاء مستخدم أدمن للشركة
        const adminPasswordHash = await hashPassword(data.admin_password)
        const { error: empError } = await supabase.from('employees').insert({
          tenant_id:   tenant.id,
          branch_id:   branch.id,
          name:        data.admin_name,
          username:    data.admin_username,
          role:        'مدير عام',
          permissions: [
            'dashboard', 'projects_view', 'projects_edit',
            'visits_quality', 'visits_safety', 'visits_electrical', 'visits_field',
            'inventory', 'purchases', 'employees',
            'finance', 'reports', 'qhse',
          ],
          is_active: true,
          password:  adminPasswordHash,
        })
        if (empError) throw empError

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">لوحة تحكم وثيق</h1>
            <p className="text-sm text-gray-400 mt-1">Super Admin — للمشغّل فقط</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input" placeholder="••••••••" autoFocus required />
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center">
              <Lock className="w-4 h-4" /> دخول
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary-500" />
              لوحة تحكم وثيق
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">إدارة الشركات المشتركة</p>
          </div>
          <button onClick={() => { setEdit(null); setShowModal(true) }} className="btn btn-primary">
            <Plus className="w-4 h-4" /> إضافة شركة
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي الشركات', value: companies.length,   color: 'text-blue-600',    bg: 'bg-blue-50'    },
            { label: 'شركات نشطة',     value: activeCount,         color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'تنتهي قريباً',   value: expiringSoon,        color: expiringSoon > 0 ? 'text-amber-600' : 'text-gray-600', bg: expiringSoon > 0 ? 'bg-amber-50' : 'bg-gray-50' },
            { label: 'الإيراد الشهري', value: `${revenue.toLocaleString('ar-EG')} ر.س`, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(k => (
            <div key={k.label} className="card p-5">
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-400 mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        {/* جدول الشركات */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">الشركات المشتركة</h3>
            {loading && <span className="w-4 h-4 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600">الشركة</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">الخطة</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">الوحدات</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">الانتهاء</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">الحالة</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">لا توجد شركات مضافة</td>
                  </tr>
                ) : companies.map(c => {
                  const plan = PLANS[c.plan as keyof typeof PLANS]
                  const days = daysLeft(c.expires_at)
                  const mods = c.modules || {}
                  const activeModules = Object.entries(mods).filter(([, v]) => v).length
                  return (
                    <tr key={c.id} className={`hover:bg-gray-50/50 ${!c.is_active ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-800">{c.name}</div>
                        {c.name_en && <div className="text-xs text-gray-400" dir="ltr">{c.name_en}</div>}
                        {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${plan?.color || 'bg-gray-100 text-gray-600'}`}>
                          {plan?.label || c.plan}
                        </span>
                        <div className="text-xs text-gray-400 mt-1">{plan?.price} ر.س/شهر</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="text-sm font-bold text-gray-700">
                          {activeModules} / {Object.keys(MODULE_LABELS).length}
                        </div>
                        <div className="flex gap-0.5 justify-center mt-1 flex-wrap">
                          {Object.entries(MODULE_LABELS).map(([key, label]) => (
                            <div key={key} title={label}
                              className={`w-2 h-2 rounded-full ${mods[key] ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {c.expires_at ? (
                          <div>
                            <div className="text-xs text-gray-600">
                              {new Date(c.expires_at).toLocaleDateString('ar-EG')}
                            </div>
                            {days !== null && (
                              <div className={`text-xs font-semibold mt-0.5 ${
                                days <= 0 ? 'text-red-600' : days <= 14 ? 'text-amber-600' : 'text-emerald-600'
                              }`}>
                                {days <= 0 ? '⛔ منتهي' : days <= 14 ? `⚠ ${days} يوم` : `✓ ${days} يوم`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button onClick={() => toggleActive(c)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            c.is_active
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}>
                          {c.is_active ? '✅ نشط' : '⏸ موقوف'}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <button onClick={() => { setEdit(c); setShowModal(true) }}
                          className="btn btn-ghost btn-xs">
                          <Pencil className="w-3.5 h-3.5" />
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
          <div className="card p-4 border-amber-200 bg-amber-50/50">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="font-semibold text-amber-700">اشتراكات تنتهي قريباً</span>
            </div>
            <div className="space-y-2">
              {companies
                .filter(c => { const d = daysLeft(c.expires_at); return d !== null && d <= 14 && d > 0 })
                .map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{c.name}</span>
                    <span className="text-amber-600 font-semibold">{daysLeft(c.expires_at)} يوم متبقي</span>
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
