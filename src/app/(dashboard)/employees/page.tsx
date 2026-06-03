'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Users, Plus, Pencil, X, Save, Shield, UserCheck, UserX, Search, LayoutGrid, List } from 'lucide-react'
import toast from 'react-hot-toast'

const ALL_PERMISSIONS = [
  { key: 'dashboard',     label: 'لوحة التحكم' },
  { key: 'projects_view', label: 'عرض المشاريع' },
  { key: 'projects_edit', label: 'تعديل المشاريع' },
  { key: 'visits_quality',label: 'الزيارات الفنية' },
  { key: 'qhse',          label: 'السلامة والجودة' },
  { key: 'inventory',     label: 'المخزون' },
  { key: 'purchases',     label: 'المشتريات' },
  { key: 'employees',     label: 'المستخدمون' },
  { key: 'reports',       label: 'التقارير' },
  { key: 'settings',      label: 'الإعدادات' },
]

const ROLES = ['مدير عام','مدير مشروع','مهندس جودة','مهندس سلامة','مشرف كهربائي','مهندس مدني','أمين مستودع','موظف']

// ══════════════════════════════════════
// نافذة منح/تعديل الصلاحيات
// ══════════════════════════════════════
function EmployeeModal({ emp, hrCandidates, onClose, onSave }: {
  emp: any | null
  hrCandidates: any[]
  onClose: () => void
  onSave: (d: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [selectedHrId, setSelectedHrId] = useState<number|''>('')
  const [form, setForm] = useState({
    name:        emp?.name        || '',
    role:        emp?.role        || 'موظف',
    username:    emp?.username    || '',
    phone:       emp?.phone       || '',
    permissions: emp?.permissions || [] as string[],
    is_active:   emp?.is_active   ?? true,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // عند اختيار موظف من HR — تعبئة تلقائية
  function fillFromHR(id: number) {
    const hr = hrCandidates.find(e => e.id === id)
    if (!hr) return
    setSelectedHrId(id)
    setForm(f => ({ ...f, name: hr.name, role: hr.role, phone: hr.phone || '' }))
  }

  function togglePerm(perm: string) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p: string) => p !== perm)
        : [...f.permissions, perm]
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!emp && !selectedHrId) { toast.error('يجب اختيار موظف من الموارد البشرية'); return }
    if (!form.name.trim()) { toast.error('أدخل الاسم'); return }
    setSaving(true)
    const saveData = emp
      ? { id: emp.id, ...form }
      : { id: selectedHrId, ...form }
    await onSave(saveData)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{emp ? 'تعديل صلاحيات المستخدم' : 'منح صلاحيات لموظف'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* إضافة جديدة — يجب اختيار موظف من HR */}
            {!emp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  اختر موظفاً من الموارد البشرية <span className="text-red-500">*</span>
                </label>
                {hrCandidates.length === 0 ? (
                  <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '0.82rem', color: '#c81e1e' }}>
                    ⛔ لا يوجد موظفون في الموارد البشرية — أضف الموظفين أولاً من صفحة HR
                  </div>
                ) : (
                  <select value={selectedHrId} onChange={e => fillFromHR(Number(e.target.value))} className="select" required>
                    <option value="">— اختر موظفاً —</option>
                    {hrCandidates.map(e => (
                      <option key={e.id} value={e.id}>{e.name} — {e.role}</option>
                    ))}
                  </select>
                )}
                {form.name && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: '#ecfdf5', borderRadius: '8px', fontSize: '0.82rem', color: '#065f46' }}>
                    ✅ تم تعبئة البيانات من ملف الموظف: <strong>{form.name}</strong>
                  </div>
                )}
              </div>
            )}

            {/* تعديل — عرض الاسم والدور فقط */}
            {emp && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم</label>
                  <input value={form.name} readOnly className="input" style={{ background: 'var(--bg2)', cursor: 'not-allowed' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">الدور</label>
                  <input value={form.role} readOnly className="input" style={{ background: 'var(--bg2)', cursor: 'not-allowed' }} />
                </div>
              </div>
            )}

            {/* اسم المستخدم */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المستخدم (للدخول)</label>
              <input value={form.username} onChange={e => set('username', e.target.value)} className="input" dir="ltr" placeholder="مثال: ahmed.ali" />
            </div>

            {/* الصلاحيات */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الصلاحيات
                <span style={{ marginRight: '8px', fontSize: '0.75rem', color: 'var(--text3)', fontWeight: 400 }}>
                  ({form.permissions.length} صلاحية محددة)
                </span>
                <button type="button"
                  onClick={() => set('permissions', form.permissions.length === ALL_PERMISSIONS.length ? [] : ALL_PERMISSIONS.map(p => p.key))}
                  style={{ marginRight: '8px', fontSize: '0.72rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  {form.permissions.length === ALL_PERMISSIONS.length ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {ALL_PERMISSIONS.map(p => (
                  <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                    background: form.permissions.includes(p.key) ? 'var(--primary-light)' : 'var(--bg2)',
                    border: `1px solid ${form.permissions.includes(p.key) ? 'var(--primary)' : 'var(--border)'}` }}>
                    <input type="checkbox" checked={form.permissions.includes(p.key)} onChange={() => togglePerm(p.key)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: form.permissions.includes(p.key) ? 600 : 400,
                      color: form.permissions.includes(p.key) ? 'var(--primary)' : 'var(--text2)' }}>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* الحالة */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'var(--bg2)', borderRadius: '10px' }}>
              <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4" id="active" />
              <label htmlFor="active" className="text-sm font-medium text-gray-700">حساب نشط (يمكنه الدخول للنظام)</label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ الصلاحيات
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function EmployeesPage() {
  const { tenant, currentUser, setEmployees } = useStore()
  const [allEmployees, setAllEmps] = useState<any[]>([])
  const [hrEmployees, setHREmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'active'|'pending'>('active')
  const [viewMode, setViewMode] = useState<'grid'|'list'>('grid')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editEmp, setEditEmp] = useState<any | null>(null)
  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { load() }, [tenant?.id])

  // جلب موظفي HR
  useEffect(() => {
    if (!tenant) return
    supabase.from('hr_employees')
      .select('id, employee_id, employee:employees!hr_employees_employee_id_fkey(id, name, role, phone)')
      .eq('tenant_id', tenant.id).eq('is_active', true)
      .then(({ data }) => {
        setHREmployees((data || []).map((e: any) => ({
          id: e.employee?.id,
          name: e.employee?.name,
          role: e.employee?.role,
          phone: e.employee?.phone,
        })).filter((e: any) => e.id))
      })
  }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const { data } = await supabase.from('employees')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('name')
    setAllEmps(data || [])
    setEmployees(data || [])
    setLoading(false)
  }

  async function handleSave(data: any) {
    if (!tenant) return
    const payload = { ...data, tenant_id: tenant.id }
    if (data.id) {
      await supabase.from('employees').update(payload).eq('id', data.id)
    } else {
      await supabase.from('employees').insert({ ...payload, username: payload.username || 'user_' + Date.now() })
    }
    await load()
    setShowModal(false); setEditEmp(null)
    // انتقل لتاب المفعّلين بعد منح الصلاحيات
    if (data.permissions && data.permissions.length > 0) setActiveTab('active')
    toast.success(data.id ? 'تم التعديل ✅' : 'تمت إضافة الصلاحيات ✅')
  }

  // الموظفون في HR بدون صلاحيات بعد
  const hrCandidates = hrEmployees.filter(hr =>
    !allEmployees.find(e => e.id === hr.id && e.permissions?.length > 0)
  )

  const activeEmps  = allEmployees.filter(e => e.permissions && e.permissions.length > 0)
  const pendingEmps = allEmployees.filter(e => !e.permissions || e.permissions.length === 0)

  const displayList = (activeTab === 'active' ? activeEmps : pendingEmps)
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield style={{ width: '20px', height: '20px', color: 'var(--primary)' }} /> المستخدمون والصلاحيات
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>إدارة صلاحيات الوصول للنظام</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'لديهم صلاحيات',  value: activeEmps.length,  color: '#0ea77b', bg: '#ecfdf5', icon: <UserCheck style={{ width: '18px', height: '18px' }} /> },
          { label: 'بدون صلاحيات',   value: pendingEmps.length, color: pendingEmps.length > 0 ? '#e6820a' : '#0ea77b', bg: pendingEmps.length > 0 ? '#fffbeb' : '#ecfdf5', icon: <UserX style={{ width: '18px', height: '18px' }} /> },
          { label: 'إجمالي الموظفين',value: allEmployees.length, color: '#1a56db', bg: '#eff6ff', icon: <Users style={{ width: '18px', height: '18px' }} /> },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: kpi.bg, color: kpi.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {kpi.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content' }}>
        <button onClick={() => setActiveTab('active')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            background: activeTab === 'active' ? '#0ea77b' : 'transparent',
            color: activeTab === 'active' ? 'white' : 'var(--text3)',
            boxShadow: activeTab === 'active' ? '0 2px 8px rgba(14,167,123,0.3)' : 'none' }}>
          <UserCheck style={{ width: '16px', height: '16px' }} /> المفعّلون ({activeEmps.length})
        </button>
        <button onClick={() => setActiveTab('pending')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            background: activeTab === 'pending' ? '#e6820a' : 'transparent',
            color: activeTab === 'pending' ? 'white' : 'var(--text3)',
            boxShadow: activeTab === 'pending' ? '0 2px 8px rgba(230,130,10,0.3)' : 'none' }}>
          <UserX style={{ width: '16px', height: '16px' }} /> بدون صلاحيات ({pendingEmps.length})
        </button>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ width: '16px', height: '16px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '36px', width: '220px' }} placeholder="بحث بالاسم..." />
          </div>
          {/* toggle view */}
          <div style={{ display: 'flex', gap: '2px', background: '#f3f4f6', padding: '3px', borderRadius: '8px' }}>
            {([{m:'grid',icon:<LayoutGrid style={{width:'15px',height:'15px'}}/>},{m:'list',icon:<List style={{width:'15px',height:'15px'}}/>}] as any[]).map(({m,icon})=>(
              <button key={m} type="button" onClick={()=>setViewMode(m as any)}
                style={{ padding:'5px 8px', borderRadius:'6px', border:'none', cursor:'pointer', transition:'all 0.15s',
                  background: viewMode===m ? 'white' : 'transparent',
                  color: viewMode===m ? '#1a56db' : '#9ca3af',
                  boxShadow: viewMode===m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {icon}
              </button>
            ))}
          </div>
        </div>
        {isAdmin && activeTab === 'active' && (
          <button onClick={() => { setEditEmp(null); setShowModal(true) }} className="btn btn-primary">
            <Shield style={{ width: '16px', height: '16px' }} /> منح صلاحيات لموظف
          </button>
        )}
      </div>

      {/* المحتوى */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : displayList.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          {activeTab === 'active'
            ? <><UserCheck style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} /><p style={{ color: 'var(--text3)' }}>لا يوجد مستخدمون مفعّلون</p></>
            : <><UserX style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} /><p style={{ color: 'var(--text3)' }}>جميع الموظفين لديهم صلاحيات</p></>
          }
        </div>

      ) : viewMode === 'list' ? (
        /* ── عرض جدول ── */
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الموظف','الدور','اسم المستخدم','الصلاحيات','الحالة',''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayList.map(emp => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--bg2)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: activeTab==='active'?'#ecfdf5':'#fffbeb', color: activeTab==='active'?'#0ea77b':'#e6820a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                          {emp.name?.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 700 }}>{emp.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text3)', fontSize: '0.82rem' }}>{emp.role}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text3)' }}>{emp.username || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {emp.permissions?.length > 0
                        ? <span style={{ fontSize: '0.75rem', color: '#0ea77b', fontWeight: 600 }}>{emp.permissions.length} صلاحية</span>
                        : <span style={{ fontSize: '0.75rem', color: '#e6820a' }}>⚠️ لا صلاحيات</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge text-xs ${emp.is_active ? 'badge-green' : 'badge-gray'}`}>{emp.is_active ? 'نشط' : 'غير نشط'}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {isAdmin && (
                        <button onClick={() => { setEditEmp(emp); setShowModal(true) }} className="btn btn-ghost btn-xs">
                          <Pencil style={{ width: '13px', height: '13px' }} /> تعديل
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      ) : (
        /* ── عرض بطاقات ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayList.map(emp => (
            <div key={emp.id} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: activeTab==='active'?'#ecfdf5':'#fffbeb', color: activeTab==='active'?'#0ea77b':'#e6820a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>
                    {emp.name?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{emp.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{emp.role}</div>
                  </div>
                </div>
                <span className={`badge text-xs ${emp.is_active ? 'badge-green' : 'badge-gray'}`}>
                  {emp.is_active ? 'نشط' : 'غير نشط'}
                </span>
              </div>

              {/* الصلاحيات */}
              {activeTab === 'active' && emp.permissions?.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: '6px' }}>الصلاحيات:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {emp.permissions.slice(0, 4).map((p: string) => (
                      <span key={p} style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '20px', fontWeight: 600 }}>
                        {ALL_PERMISSIONS.find(x => x.key === p)?.label || p}
                      </span>
                    ))}
                    {emp.permissions.length > 4 && (
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'var(--bg2)', color: 'var(--text3)', borderRadius: '20px' }}>
                        +{emp.permissions.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'pending' && (
                <div style={{ marginBottom: '12px', padding: '10px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.8rem', color: '#e6820a' }}>
                  ⚠️ هذا الموظف لا يملك صلاحيات للدخول للنظام بعد
                </div>
              )}

              {emp.username && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '10px' }}>
                  👤 {emp.username}
                </div>
              )}

              {isAdmin && (
                <div style={{ paddingTop: '10px', borderTop: '1px solid var(--bg2)', display: 'flex', gap: '8px' }}>
                  {activeTab === 'pending' ? (
                    <button onClick={() => { setEditEmp(emp); setShowModal(true) }} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center', background: '#0ea77b' }}>
                      <Shield style={{ width: '14px', height: '14px' }} /> تفعيل وإعطاء صلاحيات
                    </button>
                  ) : (
                    <button onClick={() => { setEditEmp(emp); setShowModal(true) }} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                      <Pencil style={{ width: '14px', height: '14px' }} /> تعديل الصلاحيات
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <EmployeeModal
          emp={editEmp}
          hrCandidates={hrCandidates}
          onClose={() => { setShowModal(false); setEditEmp(null) }}
          onSave={handleSave} />
      )}
    </div>
  )
}
