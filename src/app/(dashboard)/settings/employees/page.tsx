'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Users, Pencil, X, Save, Search, Shield, UserCheck, UserX, RefreshCw, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
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
  { key: 'finance',        label: 'المالية والمحاسبة' },
]

type Emp = {
  id: number; name: string; role: string; username?: string
  permissions: string[]; is_active: boolean; phone?: string; email?: string
  hr_employee_id?: number
}
type HREmp = {
  id: number; name: string; job_title?: string; phone?: string; email?: string
}

// ══ مودال تنشيط موظف كمستخدم ══
function ActivateModal({ hrEmp, onClose, onSave, onGoToPermissions }: {
  hrEmp: HREmp; onClose: () => void; onSave: (data: any) => Promise<void>; onGoToPermissions: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    username:    '',
    password:    '',
    role:        hrEmp.job_title || '',
    permissions: [] as string[],
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
    if (!form.username.trim()) { toast.error('أدخل اسم المستخدم'); return }
    if (!form.password.trim()) { toast.error('أدخل كلمة المرور'); return }
    setSaving(true)
    await onSave({ hrEmpId: hrEmp.id, name: hrEmp.name, ...form, is_active: true })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus style={{ width: '18px', height: '18px', color: '#0ea77b' }} />
            تنشيط {hrEmp.name} كمستخدم
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* معلومات الموظف */}
            <div style={{ background: '#ecfdf5', borderRadius: '10px', padding: '12px 14px', border: '1px solid #86efac', fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 700, color: '#0ea77b', marginBottom: '4px' }}>👤 {hrEmp.name}</div>
              {hrEmp.job_title && <div style={{ color: '#6b7280' }}>{hrEmp.job_title}</div>}
              {hrEmp.phone && <div style={{ color: '#6b7280' }}>📞 {hrEmp.phone}</div>}
            </div>

            {/* بيانات الدخول */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>اسم المستخدم *</label>
                <input value={form.username} onChange={e => set('username', e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  className="input" dir="ltr" placeholder="username" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>كلمة المرور *</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  className="input" dir="ltr" placeholder="••••••" />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>الدور الوظيفي</label>
              <input value={form.role} onChange={e => set('role', e.target.value)}
                onMouseDown={e => e.stopPropagation()}
                className="input" placeholder="مثال: مدير مشاريع" />
            </div>

            {/* الصلاحيات — تُدار من صفحة الصلاحيات المخصصة */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.82rem', color: '#1a56db', fontWeight: 600 }}>
                🔐 لإدارة الصلاحيات التفصيلية
              </div>
              <button onClick={() => { onClose(); onGoToPermissions() }}
                style={{ fontSize: '0.78rem', background: '#1a56db', color: 'white', padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                صفحة الصلاحيات ←
              </button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ background: '#0ea77b' }}>
              {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <UserPlus style={{ width: '14px', height: '14px' }} />}
              تنشيط كمستخدم
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── ثوابت الصلاحيات ──
const PERMISSION_GROUPS = [
  { label: 'عام',                color: '#6b7280', perms: [{ id: 'dashboard', label: 'لوحة التحكم', icon: '📊' }] },
  { label: 'المشاريع',          color: '#1a56db', perms: [{ id: 'projects_view', label: 'عرض المشاريع', icon: '👁️' }, { id: 'projects_edit', label: 'تعديل المشاريع', icon: '✏️' }, { id: 'pmo', label: 'إدارة PMO', icon: '📋' }] },
  { label: 'الزيارات',          color: '#0ea77b', perms: [{ id: 'visits', label: 'كل الزيارات', icon: '🔎' }, { id: 'visits_quality', label: 'زيارات الجودة', icon: '✅' }, { id: 'visits_safety', label: 'زيارات السلامة', icon: '🦺' }, { id: 'visits_electrical', label: 'زيارات كهربائية', icon: '⚡' }, { id: 'visits_field', label: 'زيارات ميدانية', icon: '🏗️' }] },
  { label: 'QHSE',              color: '#e6820a', perms: [{ id: 'qhse', label: 'QHSE', icon: '🛡️' }] },
  { label: 'المخزون والمشتريات', color: '#7c3aed', perms: [{ id: 'inventory', label: 'المخزون', icon: '📦' }, { id: 'purchases', label: 'المشتريات', icon: '🛒' }] },
  { label: 'الموارد البشرية',   color: '#9333ea', perms: [{ id: 'hr', label: 'HR', icon: '👥' }, { id: 'employees', label: 'الموظفون', icon: '👤' }] },
  { label: 'المالية',           color: '#0f766e', perms: [{ id: 'finance', label: 'المالية', icon: '💰' }] },
  { label: 'التقارير',          color: '#64748b', perms: [{ id: 'reports', label: 'التقارير', icon: '📈' }] },
]

const DEFAULT_ROLES_PERMS: Record<string, string[]> = {
  'مدير عام':     ['dashboard','projects_view','projects_edit','visits','visits_quality','visits_safety','visits_electrical','visits_field','inventory','purchases','qhse','employees','reports','finance','pmo','hr'],
  'مدير مشروع':  ['dashboard','projects_view','projects_edit','visits','visits_quality','visits_safety','visits_electrical','visits_field','inventory','purchases','reports','pmo'],
  'مهندس جودة':  ['dashboard','projects_view','visits_quality','qhse','reports'],
  'مهندس سلامة': ['dashboard','projects_view','visits_safety','qhse','reports'],
  'مهندس كهرباء':['dashboard','projects_view','visits_electrical','visits_field','inventory','reports'],
  'مهندس ميداني':['dashboard','projects_view','visits_field','reports'],
  'مشرف':        ['dashboard','projects_view','visits_field','reports'],
  'محاسب':       ['dashboard','finance','purchases','reports'],
  'مدير HR':     ['dashboard','hr','employees','reports'],
}

// ══ مودال تعديل صلاحيات مستخدم موجود ══
function EditPermissionsModal({ emp, onClose, onSave }: {
  emp: Emp; onClose: () => void; onSave: (data: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [userPerms, setUserPerms] = useState<string[]>(emp.permissions || [])
  const [form, setForm] = useState({
    role:      emp.role || '',
    username:  emp.username || '',
    password:  '',
    is_active: emp.is_active,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function togglePerm(key: string) {
    setUserPerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({ id: emp.id, name: emp.name, ...form, permissions: userPerms })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield style={{ width: '18px', height: '18px', color: '#1a56db' }} />
            تعديل صلاحيات {emp.name}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>اسم المستخدم</label>
                <input value={form.username} onChange={e => set('username', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" dir="ltr" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>كلمة مرور جديدة</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" dir="ltr" placeholder="اتركه فارغاً للإبقاء" />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>الدور الوظيفي</label>
              <input value={form.role} onChange={e => set('role', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" />
            </div>

            {/* تطبيق دور جاهز */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text3)' }}>تطبيق دور جاهز:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {Object.keys(DEFAULT_ROLES_PERMS).map(role => (
                  <button key={role} type="button"
                    onClick={() => setUserPerms(DEFAULT_ROLES_PERMS[role])}
                    style={{ padding: '3px 10px', borderRadius: '20px', border: '1px solid var(--border)', background: form.role === role ? '#eff6ff' : 'white', color: form.role === role ? '#1a56db' : 'var(--text3)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* الصلاحيات */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px' }}>
                الصلاحيات <span style={{ color: '#6b7280', fontWeight: 400 }}>({userPerms.length} مختارة)</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto', padding: '2px' }}>
                {PERMISSION_GROUPS.map(group => (
                  <div key={group.label}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: group.color, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: group.color }} /> {group.label}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {group.perms.map(perm => {
                        const active = userPerms.includes(perm.id)
                        return (
                          <button key={perm.id} type="button" onClick={() => togglePerm(perm.id)}
                            style={{ padding: '4px 10px', borderRadius: '7px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.1s', border: `2px solid ${active ? group.color : '#e5e7eb'}`, background: active ? group.color + '15' : 'white', color: active ? group.color : 'var(--text3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {perm.icon} {perm.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '14px', height: '14px' }} />}
              حفظ التعديلات
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
  const router = useRouter()
  const [employees,   setEmployees]   = useState<Emp[]>([])
  const [hrEmployees, setHrEmployees] = useState<HREmp[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [activeTab,   setActiveTab]   = useState<'active' | 'inactive' | 'hr_pending'>('active')
  const [showActivate,setShowActivate]= useState(false)
  const [showEdit,    setShowEdit]    = useState(false)
  const [editEmp,     setEditEmp]     = useState<Emp | null>(null)
  const [activateHr,  setActivateHr]  = useState<HREmp | null>(null)
  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [empRes, hrRes] = await Promise.all([
      supabase.from('employees').select('id, name, role, username, permissions, is_active, phone, email, hr_employee_id').eq('tenant_id', tenant.id).order('name'),
      supabase.from('hr_employees').select('id, name, job_title, phone, email').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
    ])
    const emps = (empRes.data || []) as Emp[]
    setEmployees(emps)
    // الموظفون الذين لم يُفعّلوا كمستخدمين بعد
    const activatedHrIds = new Set(emps.map(e => e.hr_employee_id).filter(Boolean))
    setHrEmployees((hrRes.data || []).filter((h: HREmp) => !activatedHrIds.has(h.id)))
    setLoading(false)
  }

  async function handleActivate(data: any) {
    if (!tenant) return
    const payload: any = {
      tenant_id:       tenant.id,
      name:            data.name,
      role:            data.role,
      username:        data.username,
      permissions:     data.permissions,
      is_active:       true,
      hr_employee_id:  data.hrEmpId,
    }
    if (data.password) payload.password = data.password
    const { error } = await supabase.from('employees').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); return }
    await load()
    setShowActivate(false); setActivateHr(null)
    toast.success('✅ تم تنشيط ' + data.name + ' كمستخدم')
  }

  async function handleEdit(data: any) {
    if (!tenant) return
    const payload: any = {
      role:      data.role,
      username:  data.username || null,
      permissions: data.permissions, // نحفظ permissions من المودال
      is_active: data.is_active,
    }
    if (data.password) payload.password = data.password
    const { error } = await supabase.from('employees').update(payload).eq('id', data.id)
    if (error) { toast.error('خطأ: ' + error.message); return }
    await load()
    setShowEdit(false); setEditEmp(null)
    toast.success('تم التعديل ✅')
  }

  async function handleToggleActive(emp: Emp) {
    const newStatus = !emp.is_active
    if (!confirm((newStatus ? 'تفعيل ' : 'تعطيل ') + emp.name + '؟')) return
    await supabase.from('employees').update({ is_active: newStatus }).eq('id', emp.id)
    await load()
    toast.success(newStatus ? '✅ تم تفعيل ' + emp.name : '⛔ تم تعطيل ' + emp.name)
  }

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name.includes(search) || (e.role || '').includes(search) || (e.username || '').includes(search)
    const matchTab = activeTab === 'active' ? e.is_active : !e.is_active
    return matchSearch && matchTab
  })

  const filteredHr = hrEmployees.filter(h =>
    !search || (h.name || '').includes(search) || (h.job_title || '').includes(search)
  )

  const activeCount   = employees.filter(e => e.is_active).length
  const inactiveCount = employees.filter(e => !e.is_active).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
            المستخدمون والصلاحيات
          </h1>
          <p style={{ fontSize: '0.82rem', color: '#9ca3af', marginTop: '2px' }}>
            {activeCount} نشط · {inactiveCount} معطّل · {hrEmployees.length} موظف بانتظار التنشيط
          </p>
        </div>
      </div>

      {/* تابات */}
      <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        <button onClick={() => setActiveTab('active')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.15s',
            background: activeTab === 'active' ? '#0ea77b' : 'transparent', color: activeTab === 'active' ? 'white' : '#6b7280' }}>
          <UserCheck style={{ width: '15px', height: '15px' }} /> النشطون ({activeCount})
        </button>
        <button onClick={() => setActiveTab('inactive')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.15s',
            background: activeTab === 'inactive' ? '#6b7280' : 'transparent', color: activeTab === 'inactive' ? 'white' : '#6b7280' }}>
          <UserX style={{ width: '15px', height: '15px' }} /> المعطّلون ({inactiveCount})
        </button>
        <button onClick={() => setActiveTab('hr_pending')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.15s',
            background: activeTab === 'hr_pending' ? '#1a56db' : 'transparent', color: activeTab === 'hr_pending' ? 'white' : '#6b7280' }}>
          <UserPlus style={{ width: '15px', height: '15px' }} /> موظفون HR ({hrEmployees.length})
          {hrEmployees.length > 0 && (
            <span style={{ background: '#c81e1e', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>
              {hrEmployees.length}
            </span>
          )}
        </button>
      </div>

      {/* بحث */}
      <div style={{ position: 'relative', maxWidth: '320px' }}>
        <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الدور..." className="input" style={{ paddingRight: '32px' }} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : activeTab === 'hr_pending' ? (
        /* ══ موظفون بانتظار التنشيط ══ */
        filteredHr.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
            <UserCheck style={{ width: '48px', height: '48px', margin: '0 auto 12px', color: '#86efac' }} />
            <p>جميع الموظفين مفعّلون كمستخدمين</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.82rem', color: '#1a56db' }}>
              💡 هؤلاء الموظفون مضافون في الموارد البشرية — اضغط "تنشيط" لمنحهم صلاحية الدخول للنظام
            </div>
            {filteredHr.map(h => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '12px', background: 'white', border: '1px solid #e5e7eb' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a56db', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
                  {(h.name || '?')[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{h.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', gap: '10px', marginTop: '2px' }}>
                    {h.job_title && <span>💼 {h.job_title}</span>}
                    {h.phone && <span>📞 {h.phone}</span>}
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => { setActivateHr(h); setShowActivate(true) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #86efac', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <UserPlus style={{ width: '14px', height: '14px' }} /> تنشيط
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* ══ المستخدمون النشطون / المعطّلون ══ */
        filtered.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
            <Users style={{ width: '48px', height: '48px', margin: '0 auto 12px', color: '#e5e7eb' }} />
            <p>لا يوجد مستخدمون</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(emp => (
              <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '12px', background: 'white', border: `1px solid ${emp.is_active ? '#e5e7eb' : '#f3f4f6'}`, opacity: emp.is_active ? 1 : 0.7 }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: emp.is_active ? '#ecfdf5' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: emp.is_active ? '#0ea77b' : '#9ca3af', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
                  {(emp.name || '?')[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{emp.name}</span>
                    {emp.role === 'مدير عام' && (
                      <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', background: '#fef2f2', color: '#c81e1e', fontWeight: 600 }}>مدير عام</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', gap: '10px', marginTop: '2px', flexWrap: 'wrap' }}>
                    {emp.role && <span>💼 {emp.role}</span>}
                    {emp.username && <span>👤 {emp.username}</span>}
                    <span style={{ color: emp.is_active ? '#0ea77b' : '#c81e1e' }}>{emp.is_active ? '🟢 نشط' : '🔴 معطّل'}</span>
                  </div>
                  {emp.permissions && emp.permissions.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {emp.permissions.slice(0, 4).map(p => {
                        const label = ALL_PERMISSIONS.find(x => x.key === p)?.label || p
                        return (
                          <span key={p} style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: '10px', background: '#eff6ff', color: '#1a56db', border: '1px solid #bfdbfe' }}>{label}</span>
                        )
                      })}
                      {emp.permissions.length > 4 && (
                        <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: '10px', background: '#f3f4f6', color: '#9ca3af' }}>+{emp.permissions.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => { setEditEmp(emp); setShowEdit(true) }}
                      style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Pencil style={{ width: '13px', height: '13px' }} /> صلاحيات
                    </button>
                    <button onClick={() => handleToggleActive(emp)}
                      style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${emp.is_active ? '#fecaca' : '#bbf7d0'}`, background: emp.is_active ? '#fef2f2' : '#ecfdf5', color: emp.is_active ? '#c81e1e' : '#0ea77b', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {emp.is_active ? <><UserX style={{ width: '13px', height: '13px', display: 'inline', marginLeft: '3px' }} />تعطيل</> : <><UserCheck style={{ width: '13px', height: '13px', display: 'inline', marginLeft: '3px' }} />تفعيل</>}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* المودالات */}
      {showActivate && activateHr && (
        <ActivateModal hrEmp={activateHr}
          onClose={() => { setShowActivate(false); setActivateHr(null) }}
          onSave={handleActivate}
          onGoToPermissions={() => { setShowActivate(false); setActivateHr(null); router.push('/settings/permissions') }} />
      )}
      {showEdit && editEmp && (
        <EditPermissionsModal emp={editEmp}
          onClose={() => { setShowEdit(false); setEditEmp(null) }}
          onSave={handleEdit} />
      )}
    </div>
  )
}
