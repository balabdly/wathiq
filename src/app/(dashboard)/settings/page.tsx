'use client'
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/hooks/useStore'
import { branchesApi } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import {
  Settings, Building2, Plus, Pencil, Trash2, X, Save, GitBranch,
  Shield, Bell, Lock, Upload, ImageIcon, CreditCard,
  Printer, Monitor, LayoutGrid, List, Eye, EyeOff,
  CheckCircle2, AlertTriangle, Calendar, Users
} from 'lucide-react'
import type { Branch, Tenant } from '@/types'
import toast from 'react-hot-toast'

// ── نافذة إضافة / تعديل فرع ──────────────────────────────────────
function BranchModal({ branch, onClose, onSave }: {
  branch: Branch | null; onClose: () => void; onSave: (d: Partial<Branch>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: branch?.name || '', location: branch?.location || '',
    description: branch?.description || '', color: branch?.color || '#1a56db',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const COLORS = ['#1a56db','#0ea77b','#c81e1e','#e6820a','#8b5cf6','#ec4899','#14b8a6','#f59e0b']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await onSave({ ...(branch ? { id: branch.id } : {}), ...form, location: form.location || undefined, description: form.description || undefined })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{branch ? 'تعديل فرع' : 'إضافة فرع'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الفرع <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="المدينة، الحي" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الوصف</label>
              <input value={form.description} onChange={e => set('description', e.target.value)} className="input" placeholder="وصف مختصر" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">لون الفرع</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => set('color', c)}
                    className={`w-8 h-8 rounded-lg transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }} />
                ))}
                <input type="color" value={form.color} onChange={e => set('color', e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Toggle Switch ─────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-primary-500' : 'bg-gray-300'}`}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'right-1' : 'left-1'}`} />
    </button>
  )
}

// ── الصفحة الرئيسية ───────────────────────────────────────────────
export default function SettingsPage() {
  const { tenant, setTenant, branches, setBranches, currentUser } = useStore()
  const [activeSection, setSection] = useState<'company'|'branches'|'subscription'|'display'|'print'|'security'>('company')
  const [savingTenant, setSaving]   = useState(false)
  const [showBranchModal, setBranchModal] = useState(false)
  const [editBranch, setEditBranch] = useState<Branch | null>(null)
  const [tenantForm, setTenantForm] = useState({
    name: '', name_en: '', phone: '', email: '',
    address: '', cr_number: '', sec_contractor_id: '', footer_text: '',
  })
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  // إعدادات العرض
  const [displaySettings, setDisplay] = useState({
    projectsView:       'grid',   // grid | list
    employeesView:      'grid',   // grid | list
    dashboardShowStats: true,
    dashboardShowAlerts: true,
    dashboardShowDeadlines: true,
    dashboardShowCharts: true,
    dashboardShowNcrList: true,
    dashboardShowLowMats: true,
  })

  // إعدادات الطباعة
  const [printSettings, setPrint] = useState({
    showLogo:       true,
    showDate:       true,
    showFooter:     true,
    showSignature:  true,
    paperSize:      'A4',
    orientation:    'portrait',
    fontSize:       'medium',
  })

  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => {
    if (tenant) {
      setTenantForm({
        name:               tenant.name || '',
        name_en:            (tenant as any).name_en || '',
        phone:              (tenant as any).phone || '',
        email:              (tenant as any).email || '',
        address:            (tenant as any).address || '',
        cr_number:          (tenant as any).cr_number || '',
        sec_contractor_id:  (tenant as any).sec_contractor_id || '',
        footer_text:        (tenant as any).footer_text || '',
      })
      setLogoPreview((tenant as any).logo_url || '')

      // تحميل إعدادات العرض والطباعة من قاعدة البيانات
      const ds = (tenant as any).display_settings
      const ps = (tenant as any).print_settings
      if (ds) setDisplay(prev => ({ ...prev, ...ds }))
      if (ps) setPrint(prev => ({ ...prev, ...ps }))
    }
  }, [tenant?.id])

  const setT = (k: string, v: string) => setTenantForm(f => ({ ...f, [k]: v }))
  const setD = (k: string, v: any) => setDisplay(f => ({ ...f, [k]: v }))
  const setP = (k: string, v: any) => setPrint(f => ({ ...f, [k]: v }))

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('حجم الشعار يجب أن يكون أقل من 2MB'); return }
    setUploadingLogo(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string
      setLogoPreview(base64)
      if (tenant) {
        const { data, error } = await supabase.from('tenants').update({ logo_url: base64 }).eq('id', tenant.id).select().single()
        if (!error && data) { setTenant(data as Tenant); toast.success('تم رفع الشعار ✅') }
        else toast.error('حدث خطأ في رفع الشعار')
      }
      setUploadingLogo(false)
    }
    reader.readAsDataURL(file)
  }

  async function saveTenant(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant) return
    setSaving(true)
    const { data, error } = await supabase.from('tenants').update({ ...tenantForm }).eq('id', tenant.id).select().single()
    if (error) { toast.error(`خطأ: ${error.message}`); setSaving(false); return }
    setTenant(data as Tenant)
    toast.success('تم حفظ بيانات الشركة ✅')
    setSaving(false)
  }

  async function saveDisplaySettings() {
    if (!tenant) return
    const { data, error } = await supabase.from('tenants').update({ display_settings: displaySettings } as any).eq('id', tenant.id).select().single()
    if (error) { toast.error('حدث خطأ في الحفظ'); return }
    setTenant(data as Tenant)
    toast.success('تم حفظ إعدادات العرض ✅')
  }

  async function savePrintSettings() {
    if (!tenant) return
    const { data, error } = await supabase.from('tenants').update({ print_settings: printSettings } as any).eq('id', tenant.id).select().single()
    if (error) { toast.error('حدث خطأ في الحفظ'); return }
    setTenant(data as Tenant)
    toast.success('تم حفظ إعدادات الطباعة ✅')
  }

  async function loadBranches() {
    if (!tenant) return
    const { data } = await branchesApi.getAll(tenant.id)
    setBranches(data || [])
  }

  async function handleSaveBranch(data: Partial<Branch>) {
    if (!tenant) return
    const { error } = await branchesApi.upsert({ ...data, tenant_id: tenant.id })
    if (error) { toast.error('حدث خطأ'); return }
    await loadBranches()
    setBranchModal(false); setEditBranch(null)
    toast.success(editBranch ? 'تم التعديل ✅' : 'تمت إضافة الفرع ✅')
  }

  async function handleDeleteBranch(branch: Branch) {
    if (!confirm('حذف فرع "' + branch.name + '"؟ سيتم حذف جميع البيانات المرتبطة به.')) return
    const { error } = await supabase.from('branches').delete().eq('id', branch.id)
    if (error) { toast.error('خطأ: ' + error.message); return }
    await loadBranches()
    toast.success('تم حذف الفرع ✅')
  }

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Lock className="w-12 h-12 text-gray-200 mb-3" />
      <p className="text-gray-500 font-medium">هذه الصفحة للمدير العام فقط</p>
    </div>
  )

  // حالة الاشتراك
  const plan        = (tenant as any)?.plan || 'basic'
  const expiresAt   = (tenant as any)?.expires_at
  const isActive    = (tenant as any)?.is_active !== false
  const daysLeft    = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000) : null
  const planLabels: Record<string, { label: string; color: string; price: string }> = {
    basic:    { label: 'أساسي',   color: 'bg-gray-100 text-gray-700',    price: '299 ر.س/شهر' },
    advanced: { label: 'متقدم',   color: 'bg-blue-100 text-blue-700',    price: '599 ر.س/شهر' },
    complete: { label: 'متكامل',  color: 'bg-purple-100 text-purple-700', price: '999 ر.س/شهر' },
  }
  const planInfo = planLabels[plan] || planLabels.basic
  const modules  = (tenant as any)?.modules || {}

  const MODULE_LABELS: Record<string, string> = {
    projects:  '📁 المشاريع',
    inventory: '📦 المخزون',
    purchases: '🛒 المشتريات',
    employees: '👥 الموظفون',
    visits:    '✅ الزيارات',
    qhse:      '🛡️ السلامة والجودة',
    reports:   '📊 التقارير',
  }

  const MENU = [
    { id: 'company',      label: 'بيانات الشركة',  icon: <Building2 className="w-4 h-4" /> },
    { id: 'branches',     label: 'الفروع',          icon: <GitBranch className="w-4 h-4" /> },
    { id: 'subscription', label: 'حالة الاشتراك',  icon: <CreditCard className="w-4 h-4" /> },
    { id: 'display',      label: 'إعدادات العرض',  icon: <Monitor className="w-4 h-4" /> },
    { id: 'print',        label: 'إعدادات الطباعة', icon: <Printer className="w-4 h-4" /> },
    { id: 'security',     label: 'الأمان والنظام',  icon: <Shield className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary-500" />
          الإعدادات
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">إدارة بيانات الشركة والنظام</p>
      </div>

      <div className="flex gap-5">
        {/* Sidebar */}
        <div className="w-52 flex-shrink-0">
          <div className="card overflow-hidden">
            {MENU.map(item => (
              <button key={item.id} onClick={() => setSection(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all text-right ${
                  activeSection === item.id
                    ? 'bg-primary-50 text-primary-600 border-r-2 border-primary-500'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <span className={activeSection === item.id ? 'text-primary-500' : 'text-gray-400'}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* ── بيانات الشركة ── */}
          {activeSection === 'company' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary-500" />
                <h3 className="font-semibold text-gray-700 text-sm">بيانات الشركة</h3>
              </div>
              <form onSubmit={saveTenant} className="p-5 space-y-4">
                {/* شعار الشركة */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 flex-shrink-0 overflow-hidden">
                    {logoPreview ? (
                      <img src={logoPreview} alt="شعار الشركة" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-700 text-sm mb-1">شعار الشركة</div>
                    <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                    <button type="button" onClick={() => logoRef.current?.click()}
                      className="btn btn-ghost btn-sm border border-gray-200 gap-1.5" disabled={uploadingLogo}>
                      {uploadingLogo ? <span className="w-3.5 h-3.5 border-2 border-gray-400/30 border-t-gray-500 rounded-full animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      رفع شعار
                    </button>
                    {logoPreview && (
                      <button type="button" onClick={() => { setLogoPreview(''); if (tenant) supabase.from('tenants').update({ logo_url: '' }).eq('id', tenant.id).then(() => toast.success('تم حذف الشعار')) }}
                        className="text-xs text-red-400 hover:text-red-600 mt-1 block">حذف الشعار</button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الشركة (عربي) <span className="text-red-500">*</span></label>
                    <input value={tenantForm.name} onChange={e => setT('name', e.target.value)} className="input" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الشركة (إنجليزي)</label>
                    <input value={tenantForm.name_en} onChange={e => setT('name_en', e.target.value)} className="input" dir="ltr" placeholder="Company Name" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم السجل التجاري</label>
                    <input value={tenantForm.cr_number} onChange={e => setT('cr_number', e.target.value)} className="input" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم المقاول (SEC)</label>
                    <input value={tenantForm.sec_contractor_id} onChange={e => setT('sec_contractor_id', e.target.value)} className="input" dir="ltr" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">الجوال</label>
                    <input value={tenantForm.phone} onChange={e => setT('phone', e.target.value)} className="input" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني</label>
                    <input type="email" value={tenantForm.email} onChange={e => setT('email', e.target.value)} className="input" dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">العنوان</label>
                  <input value={tenantForm.address} onChange={e => setT('address', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">نص ذيل التقارير</label>
                  <input value={tenantForm.footer_text} onChange={e => setT('footer_text', e.target.value)} className="input" />
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={savingTenant} className="btn btn-primary">
                    {savingTenant ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                    حفظ البيانات
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── الفروع ── */}
          {activeSection === 'branches' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary-500" />
                  <h3 className="font-semibold text-gray-700 text-sm">الفروع</h3>
                  <span className="badge badge-gray text-xs">{branches.length}</span>
                </div>
                <button onClick={() => { setEditBranch(null); setBranchModal(true) }} className="btn btn-primary btn-sm">
                  <Plus className="w-3.5 h-3.5" /> إضافة فرع
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {branches.length === 0 ? (
                  <div className="p-12 text-center">
                    <GitBranch className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">لا توجد فروع مضافة</p>
                  </div>
                ) : branches.map(b => (
                  <div key={b.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
                    <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 text-sm">{b.name}</div>
                      {b.location && <div className="text-xs text-gray-400 mt-0.5">📍 {b.location}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => { setEditBranch(b); setBranchModal(true) }} className="btn btn-ghost btn-xs">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteBranch(b)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── حالة الاشتراك ── */}
          {activeSection === 'subscription' && (
            <div className="space-y-4">
              {/* بطاقة الاشتراك الرئيسية */}
              <div className={`card p-5 ${!isActive ? 'border-red-200 bg-red-50/30' : daysLeft !== null && daysLeft <= 14 ? 'border-amber-200 bg-amber-50/30' : 'border-emerald-200 bg-emerald-50/10'}`}>
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${!isActive ? 'bg-red-100' : 'bg-emerald-100'}`}>
                      <CreditCard className={`w-7 h-7 ${!isActive ? 'text-red-500' : 'text-emerald-500'}`} />
                    </div>
                    <div>
                      <div className="font-bold text-gray-800 text-lg">{tenantForm.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${planInfo.color}`}>{planInfo.label}</span>
                        <span className="text-sm text-gray-500">{planInfo.price}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className={`flex items-center gap-1.5 font-semibold text-sm ${!isActive ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isActive ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      {isActive ? 'الاشتراك نشط' : 'الاشتراك موقوف'}
                    </div>
                    {expiresAt && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <Calendar className="w-3 h-3" />
                        ينتهي: {new Date(expiresAt).toLocaleDateString('ar-EG')}
                      </div>
                    )}
                    {daysLeft !== null && isActive && (
                      <div className={`text-xs font-semibold mt-1 ${daysLeft <= 0 ? 'text-red-600' : daysLeft <= 14 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {daysLeft <= 0 ? '⛔ انتهى الاشتراك' : daysLeft <= 14 ? `⚠ ${daysLeft} يوم متبقي` : `✓ ${daysLeft} يوم متبقي`}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* الوحدات المفعّلة */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-700 text-sm">الوحدات المفعّلة</h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-2">
                  {Object.entries(MODULE_LABELS).map(([key, label]) => (
                    <div key={key}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border ${modules[key] ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-100 bg-gray-50/50 opacity-60'}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${modules[key] ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                        {modules[key] && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-sm font-medium ${modules[key] ? 'text-emerald-700' : 'text-gray-400'}`}>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="px-5 pb-4">
                  <p className="text-xs text-gray-400">لتغيير الوحدات أو ترقية الاشتراك، تواصل مع مزود الخدمة</p>
                </div>
              </div>

              {/* معلومات إضافية */}
              <div className="card p-5">
                <h3 className="font-semibold text-gray-700 text-sm mb-3">معلومات الاشتراك</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'إصدار النظام',    value: 'وثيق v1.0' },
                    { label: 'الخطة الحالية',   value: planInfo.label },
                    { label: 'عدد المستخدمين', value: `${(tenant as any)?.max_users === 999 ? 'غير محدود' : (tenant as any)?.max_users || 3}` },
                    { label: 'رقم المقاول SEC', value: (tenant as any)?.sec_contractor_id || '—' },
                  ].map(item => (
                    <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                      <div className="font-semibold text-gray-800 text-sm">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── إعدادات العرض ── */}
          {activeSection === 'display' && (
            <div className="space-y-4">
              {/* عرض المشاريع */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-primary-500" />
                  <h3 className="font-semibold text-gray-700 text-sm">طريقة عرض المشاريع</h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-3">
                    {/* Kanban */}
                    <button type="button" onClick={() => setD('projectsView', 'kanban')}
                      className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${displaySettings.projectsView === 'kanban' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex gap-1">
                        {[1,2,3].map(i => (
                          <div key={i} className="flex flex-col gap-1">
                            <div className={`w-5 h-3 rounded ${displaySettings.projectsView === 'kanban' ? 'bg-primary-400' : 'bg-gray-300'}`} />
                            <div className={`w-5 h-3 rounded ${displaySettings.projectsView === 'kanban' ? 'bg-primary-200' : 'bg-gray-200'}`} />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: '0.9rem' }}>📋</span>
                        <span className="text-sm font-semibold">Kanban</span>
                      </div>
                      {displaySettings.projectsView === 'kanban' && <span className="badge badge-blue text-xs">الوضع الحالي</span>}
                    </button>
                    {/* بطاقات */}
                    <button type="button" onClick={() => setD('projectsView', 'grid')}
                      className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${displaySettings.projectsView === 'grid' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[1,2,3,4].map(i => <div key={i} className={`w-8 h-6 rounded ${displaySettings.projectsView === 'grid' ? 'bg-primary-300' : 'bg-gray-200'}`} />)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <LayoutGrid className="w-4 h-4" />
                        <span className="text-sm font-semibold">بطاقات</span>
                      </div>
                      {displaySettings.projectsView === 'grid' && <span className="badge badge-blue text-xs">الوضع الحالي</span>}
                    </button>
                    {/* جدول */}
                    <button type="button" onClick={() => setD('projectsView', 'list')}
                      className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${displaySettings.projectsView === 'list' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="space-y-1.5 w-full">
                        {[1,2,3].map(i => <div key={i} className={`h-2.5 rounded ${displaySettings.projectsView === 'list' ? 'bg-primary-300' : 'bg-gray-200'}`} />)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <List className="w-4 h-4" />
                        <span className="text-sm font-semibold">جدول</span>
                      </div>
                      {displaySettings.projectsView === 'list' && <span className="badge badge-blue text-xs">الوضع الحالي</span>}
                    </button>
                  </div>
                </div>
              </div>

              {/* عرض الموظفين */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary-500" />
                  <h3 className="font-semibold text-gray-700 text-sm">طريقة عرض الموظفين</h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setD('employeesView', 'grid')}
                      className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${displaySettings.employeesView === 'grid' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[1,2,3,4].map(i => <div key={i} className={`w-8 h-6 rounded ${displaySettings.employeesView === 'grid' ? 'bg-primary-300' : 'bg-gray-200'}`} />)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <LayoutGrid className="w-4 h-4" />
                        <span className="text-sm font-semibold">بطاقات</span>
                      </div>
                      {displaySettings.employeesView === 'grid' && <span className="badge badge-blue text-xs">الوضع الحالي</span>}
                    </button>
                    <button type="button" onClick={() => setD('employeesView', 'list')}
                      className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${displaySettings.employeesView === 'list' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="space-y-1.5 w-full">
                        {[1,2,3].map(i => <div key={i} className={`h-2.5 rounded ${displaySettings.employeesView === 'list' ? 'bg-primary-300' : 'bg-gray-200'}`} />)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <List className="w-4 h-4" />
                        <span className="text-sm font-semibold">جدول</span>
                      </div>
                      {displaySettings.employeesView === 'list' && <span className="badge badge-blue text-xs">الوضع الحالي</span>}
                    </button>
                  </div>
                </div>
              </div>

              {/* بطاقات لوحة التحكم */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-700 text-sm">محتوى لوحة التحكم</h3>
                  <p className="text-xs text-gray-400 mt-0.5">اختر ما تريد إظهاره في الصفحة الرئيسية</p>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { key: 'dashboardShowStats',     label: 'الإحصائيات الرئيسية',    desc: 'المشاريع، NCR، المواد، الزيارات' },
                    { key: 'dashboardShowAlerts',    label: 'التنبيهات العاجلة',       desc: 'المشاريع المتأخرة و NCR المعلقة' },
                    { key: 'dashboardShowDeadlines', label: 'مواعيد التسليم',          desc: 'المشاريع خلال 30 يوماً القادمة'  },
                    { key: 'dashboardShowNcrList',   label: 'قائمة NCR المعلقة',      desc: 'عرض NCR بشكل تفصيلي'             },
                    { key: 'dashboardShowLowMats',   label: 'المواد تحت حد الأمان',   desc: 'قائمة المواد المنخفضة'           },
                    { key: 'dashboardShowCharts',    label: 'الرسوم البيانية',         desc: 'مخططات حالة المشاريع والإنجاز'  },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        {(displaySettings as any)[item.key]
                          ? <Eye className="w-4 h-4 text-primary-500" />
                          : <EyeOff className="w-4 h-4 text-gray-300" />}
                        <div>
                          <div className="text-sm font-medium text-gray-700">{item.label}</div>
                          <div className="text-xs text-gray-400">{item.desc}</div>
                        </div>
                      </div>
                      <Toggle value={(displaySettings as any)[item.key]} onChange={v => setD(item.key, v)} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={saveDisplaySettings} className="btn btn-primary">
                  <Save className="w-4 h-4" /> حفظ إعدادات العرض
                </button>
              </div>
            </div>
          )}

          {/* ── إعدادات الطباعة ── */}
          {activeSection === 'print' && (
            <div className="space-y-4">
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-primary-500" />
                  <h3 className="font-semibold text-gray-700 text-sm">إعدادات الطباعة والتقارير</h3>
                </div>
                <div className="p-5 space-y-5">
                  {/* محتوى التقرير */}
                  <div>
                    <div className="font-medium text-gray-700 text-sm mb-3">محتوى التقرير المطبوع</div>
                    <div className="space-y-3">
                      {[
                        { key: 'showLogo',      label: 'شعار الشركة',     desc: 'إظهار الشعار في أعلى التقرير' },
                        { key: 'showDate',      label: 'تاريخ الطباعة',   desc: 'إضافة تاريخ ووقت الطباعة'    },
                        { key: 'showFooter',    label: 'ذيل التقرير',     desc: 'نص ذيل الصفحة المخصص'        },
                        { key: 'showSignature', label: 'خانة التوقيع',    desc: 'إضافة خانة للتوقيع والختم'   },
                      ].map(item => (
                        <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div>
                            <div className="text-sm font-medium text-gray-700">{item.label}</div>
                            <div className="text-xs text-gray-400">{item.desc}</div>
                          </div>
                          <Toggle value={(printSettings as any)[item.key]} onChange={v => setP(item.key, v)} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* حجم الورق */}
                  <div>
                    <div className="font-medium text-gray-700 text-sm mb-2">حجم الورق</div>
                    <div className="flex gap-2">
                      {['A4','A3','Letter'].map(size => (
                        <button key={size} type="button" onClick={() => setP('paperSize', size)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${printSettings.paperSize === size ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* الاتجاه */}
                  <div>
                    <div className="font-medium text-gray-700 text-sm mb-2">اتجاه الطباعة</div>
                    <div className="flex gap-2">
                      {[{ v: 'portrait', l: '📄 عمودي' }, { v: 'landscape', l: '📄 أفقي' }].map(opt => (
                        <button key={opt.v} type="button" onClick={() => setP('orientation', opt.v)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${printSettings.orientation === opt.v ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* حجم الخط */}
                  <div>
                    <div className="font-medium text-gray-700 text-sm mb-2">حجم الخط</div>
                    <div className="flex gap-2">
                      {[{ v: 'small', l: 'صغير' }, { v: 'medium', l: 'متوسط' }, { v: 'large', l: 'كبير' }].map(opt => (
                        <button key={opt.v} type="button" onClick={() => setP('fontSize', opt.v)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${printSettings.fontSize === opt.v ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* معاينة */}
              <div className="card p-4 border-dashed border-gray-200">
                <div className="text-xs text-gray-400 mb-2">معاينة رأس التقرير:</div>
                <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
                  {printSettings.showLogo && logoPreview && (
                    <div className="flex justify-center mb-2">
                      <img src={logoPreview} alt="شعار" className="h-10 object-contain" />
                    </div>
                  )}
                  <div className="text-center font-bold text-gray-800">{tenantForm.name}</div>
                  {printSettings.showDate && (
                    <div className="text-center text-xs text-gray-400">{new Date().toLocaleDateString('ar-EG')}</div>
                  )}
                  <div className="border-t border-gray-100 pt-2 text-center text-xs text-gray-300">
                    {printSettings.paperSize} • {printSettings.orientation === 'portrait' ? 'عمودي' : 'أفقي'} • خط {printSettings.fontSize === 'small' ? 'صغير' : printSettings.fontSize === 'large' ? 'كبير' : 'متوسط'}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={savePrintSettings} className="btn btn-primary">
                  <Save className="w-4 h-4" /> حفظ إعدادات الطباعة
                </button>
              </div>
            </div>
          )}

          {/* ── الأمان والنظام ── */}
          {activeSection === 'security' && (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">معلومات النظام</div>
                    <div className="text-xs text-gray-400">إصدار النظام والمعلومات التقنية</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'إصدار النظام',   value: 'وثيق v1.0' },
                    { label: 'الخطة الحالية',  value: planInfo.label },
                    { label: 'رقم المقاول SEC', value: (tenant as any)?.sec_contractor_id || '—' },
                    { label: 'حالة الاشتراك',  value: isActive ? '✅ نشط' : '❌ موقوف' },
                  ].map(item => (
                    <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                      <div className="font-semibold text-gray-800 text-sm">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Bell className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">تنبيهات النظام</div>
                    <div className="text-xs text-gray-400">إعدادات التنبيهات</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'تنبيه المواد تحت حد الأمان', desc: 'إشعار عند انخفاض الكمية'     },
                    { label: 'تنبيه تأخر المشاريع',        desc: 'إشعار عند تجاوز تاريخ التسليم' },
                    { label: 'تنبيه NCR معلقة',            desc: 'تذكير بالمخالفات غير المغلقة'  },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <div className="text-sm font-medium text-gray-700">{item.label}</div>
                        <div className="text-xs text-gray-400">{item.desc}</div>
                      </div>
                      <Toggle value={true} onChange={() => {}} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showBranchModal && (
        <BranchModal branch={editBranch}
          onClose={() => { setBranchModal(false); setEditBranch(null) }}
          onSave={handleSaveBranch} />
      )}
    </div>
  )
}
