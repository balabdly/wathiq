'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { branchesApi } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { Settings, Building2, Plus, Pencil, Trash2, X, Save, GitBranch } from 'lucide-react'
import type { Branch, Tenant } from '@/types'
import toast from 'react-hot-toast'

// ── Branch Modal ─────────────────────────────────────────────────
function BranchModal({ branch, onClose, onSave }: {
  branch: Branch | null
  onClose: () => void
  onSave: (d: Partial<Branch>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:        branch?.name        || '',
    location:    branch?.location    || '',
    description: branch?.description || '',
    color:       branch?.color       || '#1a56db',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await onSave({
      ...(branch ? { id: branch.id } : {}),
      name:        form.name,
      location:    form.location    || undefined,
      description: form.description || undefined,
      color:       form.color,
    })
    setSaving(false)
  }

  const PRESET_COLORS = ['#1a56db','#0ea77b','#c81e1e','#e6820a','#8b5cf6','#ec4899','#14b8a6','#f59e0b']

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{branch ? 'تعديل فرع' : 'إضافة فرع'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الفرع <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: فرع الرياض" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="مثال: الرياض، حي العليا" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الوصف</label>
              <input value={form.description} onChange={e => set('description', e.target.value)} className="input" placeholder="وصف مختصر للفرع" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">لون الفرع</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => set('color', c)}
                    className={`w-8 h-8 rounded-lg transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }} />
                ))}
                <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200" title="لون مخصص" />
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

// ── الصفحة ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const { tenant, setTenant, branches, setBranches, currentUser } = useStore()
  const [loading, setLoading]       = useState(false)
  const [savingTenant, setSaving]   = useState(false)
  const [showBranchModal, setBranchModal] = useState(false)
  const [editBranch, setEditBranch] = useState<Branch | null>(null)
  const [tenantForm, setTenantForm] = useState({
    name:              tenant?.name              || '',
    name_en:           tenant?.name_en           || '',
    phone:             tenant?.phone             || '',
    email:             tenant?.email             || '',
    address:           tenant?.address           || '',
    cr_number:         tenant?.cr_number         || '',
    sec_contractor_id: tenant?.sec_contractor_id || '',
    footer_text:       tenant?.footer_text       || '',
  })

  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => {
    if (tenant) {
      setTenantForm({
        name:              tenant.name              || '',
        name_en:           tenant.name_en           || '',
        phone:             tenant.phone             || '',
        email:             tenant.email             || '',
        address:           tenant.address           || '',
        cr_number:         tenant.cr_number         || '',
        sec_contractor_id: tenant.sec_contractor_id || '',
        footer_text:       tenant.footer_text       || '',
      })
    }
  }, [tenant?.id])

  const setT = (k: string, v: string) => setTenantForm(f => ({ ...f, [k]: v }))

  async function saveTenant(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant) return
    setSaving(true)
    const { data, error } = await supabase
      .from('tenants')
      .update(tenantForm)
      .eq('id', tenant.id)
      .select()
      .single()
    if (error) { toast.error('حدث خطأ في الحفظ'); setSaving(false); return }
    setTenant(data as Tenant)
    toast.success('تم حفظ بيانات الشركة ✅')
    setSaving(false)
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
    setBranchModal(false)
    setEditBranch(null)
    toast.success(editBranch ? 'تم تعديل الفرع' : 'تمت إضافة الفرع')
  }

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Settings className="w-12 h-12 text-gray-200 mb-3" />
      <p className="text-gray-400">هذه الصفحة للمدير العام فقط</p>
    </div>
  )

  return (
    <div className="space-y-6 fade-in max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary-500" />
          الإعدادات
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">إعدادات الشركة والفروع</p>
      </div>

      {/* Tenant Info */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary-500" />
          <h3 className="font-semibold text-gray-700 text-sm">بيانات الشركة</h3>
        </div>
        <form onSubmit={saveTenant} className="p-5 space-y-4">
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
              <input value={tenantForm.cr_number} onChange={e => setT('cr_number', e.target.value)} className="input" dir="ltr" placeholder="1234567890" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم المقاول (SEC)</label>
              <input value={tenantForm.sec_contractor_id} onChange={e => setT('sec_contractor_id', e.target.value)} className="input" dir="ltr" placeholder="SEC-XXXXX" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الجوال</label>
              <input value={tenantForm.phone} onChange={e => setT('phone', e.target.value)} className="input" dir="ltr" placeholder="+966 5x xxx xxxx" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني</label>
              <input type="email" value={tenantForm.email} onChange={e => setT('email', e.target.value)} className="input" dir="ltr" placeholder="info@company.sa" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">العنوان</label>
            <input value={tenantForm.address} onChange={e => setT('address', e.target.value)} className="input" placeholder="المدينة، الحي، الشارع" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نص الذيل (للتقارير المطبوعة)</label>
            <input value={tenantForm.footer_text} onChange={e => setT('footer_text', e.target.value)} className="input" placeholder="مثال: هذا المستند سري وخاص بالشركة" />
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={savingTenant} className="btn btn-primary">
              {savingTenant ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ البيانات
            </button>
          </div>
        </form>
      </div>

      {/* Branches */}
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
            <p className="p-8 text-center text-gray-400 text-sm">لا توجد فروع مضافة</p>
          ) : branches.map(b => (
            <div key={b.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-800 text-sm">{b.name}</div>
                {b.location && <div className="text-xs text-gray-400 mt-0.5">📍 {b.location}</div>}
                {b.description && <div className="text-xs text-gray-400">{b.description}</div>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditBranch(b); setBranchModal(true) }} className="btn btn-ghost btn-xs"><Pencil className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showBranchModal && (
        <BranchModal
          branch={editBranch}
          onClose={() => { setBranchModal(false); setEditBranch(null) }}
          onSave={handleSaveBranch}
        />
      )}
    </div>
  )
}
