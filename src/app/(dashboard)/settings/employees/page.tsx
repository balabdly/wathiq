'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Users, Plus, Pencil, X, Save, Search, Shield, UserCheck, UserX, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const ALL_PERMISSIONS = [
  { key: 'dashboard',      label: 'لوحة التحكم' },
  { key: 'projects_view',  label: 'المشاريع' },
  { key: 'visits',         label: 'الزيارات الفنية' },
  { key: 'inventory',      label: 'المخزون' },
  { key: 'purchases',      label: 'المشتريات' },
  { key: 'qhse',           label: 'السلامة والجودة' },
  { key: 'employees',      label: 'الموارد البشرية' },
  { key: 'reports',        label: 'التقارير' },
]

type Emp = {
  id: number; name: string; role: string; username?: string
  permissions: string[]; is_active: boolean; phone?: string; email?: string
}

// ══ مودال إضافة / تعديل مستخدم ══
function EmployeeModal({ emp, onClose, onSave }: {
  emp: Emp | null; onClose: () => void; onSave: (data: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:        emp?.name || '',
    role:        emp?.role || '',
    username:    emp?.username || '',
    password:    '',
    permissions: emp?.permissions || [],
    is_active:   emp?.is_active ?? true,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function togglePerm(key: string) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter(p => p !== key)
        : [...f.permissions, key]
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('أدخل الاسم'); return }
    if (!form.role.trim()) { toast.error('أدخل الدور الوظيفي'); return }
    setSaving(true)
    await onSave({ id: emp?.id, ...form })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
            {emp ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* بيانات أساسية */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم الكامل *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="محمد أحمد" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الدور الوظيفي *</label>
                <input value={form.role} onChange={e => set('role', e.target.value)} className="input" placeholder="مدير مشاريع" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المستخدم</label>
                <input value={form.username} onChange={e => set('username', e.target.value)} className="input" dir="ltr" placeholder="user123" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {emp ? 'كلمة المرور (اتركها فارغة للإبقاء)' : 'كلمة المرور'}
                </label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)} className="input" dir="ltr" placeholder="••••••" />
              </div>
            </div>

            {/* الحالة */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: form.is_active ? '#ecfdf5' : '#fef2f2', borderRadius: '10px', border: '1px solid ' + (form.is_active ? '#bbf7d0' : '#fecaca') }}>
              <button type="button" onClick={() => set('is_active', !form.is_active)}
                style={{ width: '42px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: form.is_active ? '#0ea77b' : '#d1d5db', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', transition: 'right 0.2s', right: form.is_active ? '3px' : '21px' }} />
              </button>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: form.is_active ? '#065f46' : '#991b1b' }}>
                  {form.is_active ? '✅ حساب نشط' : '⛔ حساب معطّل'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                  {form.is_active ? 'يمكنه تسجيل الدخول' : 'لا يمكنه تسجيل الدخول'}
                </div>
              </div>
            </div>

            {/* الصلاحيات */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>
                  الصلاحيات ({form.permissions.length}/{ALL_PERMISSIONS.length})
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => set('permissions', ALL_PERMISSIONS.map(p => p.key))}
                    style={{ fontSize: '0.75rem', color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    تحديد الكل
                  </button>
                  <span style={{ color: 'var(--text3)' }}>|</span>
                  <button type="button" onClick={() => set('permissions', [])}
                    style={{ fontSize: '0.75rem', color: '#c81e1e', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    إلغاء الكل
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {ALL_PERMISSIONS.map(p => {
                  const checked = form.permissions.includes(p.key)
                  return (
                    <label key={p.key} onClick={() => togglePerm(p.key)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: '1px solid ' + (checked ? '#bfdbfe' : 'var(--border)'), background: checked ? '#eff6ff' : 'transparent', transition: 'all 0.12s' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '2px solid ' + (checked ? '#1a56db' : '#d1d5db'), background: checked ? '#1a56db' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.12s' }}>
                        {checked && <svg viewBox="0 0 10 8" width="10" height="8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>}
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: checked ? 600 : 400, color: checked ? '#1e40af' : 'var(--text2)' }}>{p.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {emp ? 'حفظ التعديل' : 'إضافة المستخدم'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══ الصفحة الرئيسية ══
export default function EmployeesSettingsPage() {
  const { tenant, currentUser } = useStore()
  const [employees, setEmployees] = useState<Emp[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active')
  const [showModal, setShowModal] = useState(false)
  const [editEmp, setEditEmp]     = useState<Emp | null>(null)
  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const { data } = await supabase.from('employees')
      .select('id, name, role, username, permissions, is_active, phone, email')
      .eq('tenant_id', tenant.id).order('name')
    setEmployees((data || []) as any)
    setLoading(false)
  }

  async function handleSave(data: any) {
    if (!tenant) return
    const payload: any = {
      name: data.name, role: data.role,
      username: data.username || null,
      permissions: data.permissions,
      is_active: data.is_active,
      tenant_id: tenant.id,
    }
    if (data.password) payload.password = data.password

    if (data.id) {
      await supabase.from('employees').update(payload).eq('id', data.id)
    } else {
      await supabase.from('employees').insert(payload)
    }
    await load()
    setShowModal(false); setEditEmp(null)
    // انتقل للتاب المناسب بعد الحفظ
    setActiveTab(data.is_active ? 'active' : 'inactive')
    toast.success(data.id ? 'تم التعديل ✅' : 'تمت الإضافة ✅')
  }

  // ✅ تبديل حالة النشاط مباشرة بدون فتح المودال
  async function handleToggleActive(emp: Emp) {
    const newStatus = !emp.is_active
    const confirmMsg = newStatus
      ? 'تفعيل حساب ' + emp.name + '؟ سيتمكن من تسجيل الدخول.'
      : 'تعطيل حساب ' + emp.name + '؟ لن يتمكن من تسجيل الدخول.'
    if (!confirm(confirmMsg)) return

    const { error } = await supabase.from('employees')
      .update({ is_active: newStatus }).eq('id', emp.id)
    if (error) { toast.error('خطأ: ' + error.message); return }
    await load()
    toast.success(newStatus ? '✅ تم تفعيل ' + emp.name : '⛔ تم تعطيل ' + emp.name)
  }

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name.includes(search) || e.role.includes(search) || (e.username || '').includes(search)
    const matchTab = activeTab === 'active' ? e.is_active : !e.is_active
    return matchSearch && matchTab
  })

  const activeCount   = employees.filter(e => e.is_active).length
  const inactiveCount = employees.filter(e => !e.is_active).length

  return (
    <div className="space-y-5 fade-in">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
            المستخدمون والصلاحيات
          </h1>
          <p style={{ fontSize: '0.82rem', color: '#9ca3af', marginTop: '2px' }}>
            {activeCount} نشط · {inactiveCount} معطّل
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditEmp(null); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> إضافة مستخدم
          </button>
        )}
      </div>

      {/* تابات + بحث */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '10px' }}>
          <button onClick={() => setActiveTab('active')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.15s',
              background: activeTab === 'active' ? '#0ea77b' : 'transparent',
              color: activeTab === 'active' ? 'white' : '#6b7280' }}>
            <UserCheck style={{ width: '15px', height: '15px' }} />
            النشطون ({activeCount})
          </button>
          <button onClick={() => setActiveTab('inactive')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.15s',
              background: activeTab === 'inactive' ? '#6b7280' : 'transparent',
              color: activeTab === 'inactive' ? 'white' : '#6b7280' }}>
            <UserX style={{ width: '15px', height: '15px' }} />
            المعطّلون ({inactiveCount})
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '15px', height: '15px', color: '#9ca3af', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input"
            style={{ paddingRight: '34px', width: '220px', fontSize: '0.875rem' }} placeholder="بحث بالاسم..." />
        </div>
      </div>

      {/* الجدول */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Users style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af' }}>
            {activeTab === 'inactive' ? 'لا يوجد مستخدمون معطّلون' : 'لا يوجد مستخدمون نشطون'}
          </p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الموظف','الدور','اسم المستخدم','الصلاحيات','الحالة',''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--bg2)', opacity: emp.is_active ? 1 : 0.65 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0, background: emp.is_active ? '#ecfdf5' : '#f3f4f6', color: emp.is_active ? '#0ea77b' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                          {emp.name?.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 700 }}>{emp.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: '0.82rem' }}>{emp.role}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.78rem', fontFamily: 'monospace', color: '#6b7280' }}>{emp.username || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {emp.permissions?.length > 0
                        ? <span style={{ fontSize: '0.75rem', color: '#0ea77b', fontWeight: 600 }}>{emp.permissions.length} صلاحية</span>
                        : <span style={{ fontSize: '0.75rem', color: '#e6820a' }}>⚠️ لا صلاحيات</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={'badge text-xs ' + (emp.is_active ? 'badge-green' : 'badge-gray')}>
                        {emp.is_active ? '✅ نشط' : '⛔ معطّل'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          {/* زر تبديل الحالة */}
                          <button onClick={() => handleToggleActive(emp)}
                            title={emp.is_active ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '7px', border: '1px solid ' + (emp.is_active ? '#fecaca' : '#bbf7d0'), background: emp.is_active ? '#fff5f5' : '#ecfdf5', color: emp.is_active ? '#c81e1e' : '#0ea77b', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                            {emp.is_active
                              ? <><UserX style={{ width: '12px', height: '12px' }} /> تعطيل</>
                              : <><UserCheck style={{ width: '12px', height: '12px' }} /> تفعيل</>}
                          </button>
                          {/* زر تعديل */}
                          <button onClick={() => { setEditEmp(emp); setShowModal(true) }} className="btn btn-ghost btn-xs">
                            <Pencil style={{ width: '13px', height: '13px' }} /> تعديل
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <EmployeeModal emp={editEmp} onClose={() => { setShowModal(false); setEditEmp(null) }} onSave={handleSave} />
      )}
    </div>
  )
}
