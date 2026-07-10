'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Users, Pencil, X, Save, Search, Shield, UserCheck, UserX, RefreshCw, UserPlus, Trash2, UserMinus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { hashPassword } from '@/lib/auth'
import { syncUserCookie } from '@/lib/authCookie'
import { deleteEmployeeAccount } from '@/lib/deleteEmployeeAccount'
import {
  isExternalLoginUser,
  isTenantOwner,
  getAccountBadge,
  canDeleteLoginAccount,
  canDisableLoginAccount,
} from '@/lib/userAccountKind'
import { DEFAULT_ROLES_PERMS, PERMISSION_GROUPS } from '@/lib/permissions-config'
import { UserPermissionsEditor } from '@/components/settings/UserPermissionsEditor'
import {
  suggestUsernameFromEmployeeNumber,
  validateLoginUsername,
  validateLoginPassword,
  checkUsernameAvailable,
  shouldSuggestUsernameFromHr,
  LOGIN_USERNAME_LABEL,
  LOGIN_USERNAME_PLACEHOLDER,
} from '@/lib/loginUsername'

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
  is_tenant_owner?: boolean
}
type HREmp = {
  id: number; name: string; job_title?: string; phone?: string; email?: string
  employee_id?: number
  employee_number?: string | null
}

// isExternalLoginUser — من @/lib/userAccountKind

// ══ مودال تنشيط موظف كمستخدم ══
function ActivateModal({ hrEmp, onClose, onSave, onGoToPermissions }: {
  hrEmp: HREmp; onClose: () => void; onSave: (data: any) => Promise<void>; onGoToPermissions: () => void
}) {
  const suggestedUsername = suggestUsernameFromEmployeeNumber(hrEmp.employee_number) || ''
  const [saving, setSaving] = useState(false)
  const [usernameManual, setUsernameManual] = useState(false)
  const [form, setForm] = useState({
    username:    suggestedUsername,
    password:    '',
    role:        hrEmp.job_title || '',
    permissions: [] as string[],
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!usernameManual) {
      const next = suggestUsernameFromEmployeeNumber(hrEmp.employee_number)
      if (next) setForm(f => ({ ...f, username: next }))
    }
  }, [hrEmp.id, hrEmp.employee_number, usernameManual])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const u = validateLoginUsername(form.username)
    if (!u.ok) { toast.error(u.error); return }
    const p = validateLoginPassword(form.password)
    if (!p.ok) { toast.error(p.error); return }
    setSaving(true)
    await onSave({ hrEmpId: hrEmp.id, name: hrEmp.name, ...form, username: u.value, is_active: true })
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
              {hrEmp.employee_number && <div style={{ color: '#0f766e', fontWeight: 600 }}>رقم وظيفي: {hrEmp.employee_number}</div>}
              {hrEmp.job_title && <div style={{ color: '#6b7280' }}>{hrEmp.job_title}</div>}
              {hrEmp.phone && <div style={{ color: '#6b7280' }}>📞 {hrEmp.phone}</div>}
            </div>

            {/* بيانات الدخول */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>{LOGIN_USERNAME_LABEL} *</label>
                <input value={form.username}
                  onChange={e => { setUsernameManual(true); set('username', e.target.value) }}
                  onMouseDown={e => e.stopPropagation()}
                  className="input" dir="ltr" placeholder={LOGIN_USERNAME_PLACEHOLDER} />
                {suggestedUsername && (
                  <p style={{ fontSize: '0.72rem', color: '#0f766e', marginTop: '5px' }}>
                    يُقترح تلقائياً من الرقم الوظيفي — يمكنك تغييره للحالات الخاصة
                  </p>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>كلمة المرور *</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  className="input" dir="ltr" placeholder="8+ أحرف، حرف ورقم" />
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

// ── DEFAULT_ROLES_PERMS — من @/lib/permissions-config

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
  const { tenant, currentUser, setCurrentUser } = useStore()
  const router = useRouter()
  const [employees,   setEmployees]   = useState<Emp[]>([])
  const [hrEmployees, setHrEmployees] = useState<HREmp[]>([])
  const [allHrEmployees, setAllHrEmployees] = useState<HREmp[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [activeTab,   setActiveTab]   = useState<'active' | 'inactive' | 'hr_pending' | 'external'>('active')
  const [showModal,    setShowModal]    = useState(false)
  const [showEdit,    setShowEdit]    = useState(false)
  const [editEmp,     setEditEmp]     = useState<Emp | null>(null)
  const [activateHr,  setActivateHr]  = useState<HREmp | null>(null)
  const isAdmin = currentUser?.role === 'مدير عام'
  // Split View state
  const [selectedEmp, setSelectedEmp] = useState<Emp | null>(null)
  const [userPerms,   setUserPerms]   = useState<string[]>([])
  const [editForm,    setEditForm]    = useState({ role: '', username: '', password: '' })
  const [hrLinkId,    setHrLinkId]    = useState<string>('')
  const [usernameManual, setUsernameManual] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  useEffect(() => { load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [empRes, hrRes] = await Promise.all([
      supabase.from('employees').select('id, name, role, username, permissions, is_active, phone, email, hr_employee_id, is_tenant_owner').eq('tenant_id', tenant.id).order('name'),
      supabase.from('hr_employees').select('id, name, job_title, phone, email, employee_id, employee_number').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
    ])
    const emps = (empRes.data || []) as Emp[]
    setEmployees(emps)
    // الموظفون الذين لم يُفعّلوا كمستخدمين بعد
    const hrRows = (hrRes.data || []) as HREmp[]
    setAllHrEmployees(hrRows)
    const activatedHrIds = new Set(emps.map(e => e.hr_employee_id).filter(Boolean))
    setHrEmployees(hrRows.filter(h => !activatedHrIds.has(h.id)))
    setLoading(false)
  }

  function selectEmp(emp: Emp) {
    setSelectedEmp(emp)
    setUserPerms(emp.permissions || [])
    setEditForm({ role: emp.role || '', username: emp.username || '', password: '' })
    setHrLinkId(emp.hr_employee_id ? String(emp.hr_employee_id) : '')
    setUsernameManual(false)
  }

  function handleHrLinkChange(id: string) {
    setHrLinkId(id)
    const hr = allHrEmployees.find(h => h.id === Number(id))
    const suggested = suggestUsernameFromEmployeeNumber(hr?.employee_number)
    if (suggested && shouldSuggestUsernameFromHr(editForm.username, usernameManual)) {
      setEditForm(f => ({ ...f, username: suggested }))
    }
  }

  async function saveSelectedEmp() {
    if (!selectedEmp || !tenant) return
    const u = validateLoginUsername(editForm.username)
    if (!u.ok) { toast.error(u.error); return }
    if (editForm.password) {
      const p = validateLoginPassword(editForm.password)
      if (!p.ok) { toast.error(p.error); return }
    }
    const usernameChanged = u.value.toLowerCase() !== (selectedEmp.username || '').toLowerCase()
    if (usernameChanged) {
      const { available, error: availErr } = await checkUsernameAvailable(supabase, tenant.id, u.value, selectedEmp.id)
      if (availErr) { toast.error('خطأ: ' + availErr); return }
      if (!available) { toast.error('رقم الموظف / اسم المستخدم مستخدم من قبل موظف آخر'); return }
    }
    const wantsSelfService = userPerms.some(p => ['hr_self', 'hr', 'employees'].includes(p))
    const linkedHrId = hrLinkId ? Number(hrLinkId) : null
    const owner = isTenantOwner(selectedEmp)
    if (wantsSelfService && !linkedHrId && !owner) {
      toast.error('الخدمة الذاتية تتطلب ربط المستخدم بملف موظف HR — اختر الموظف من القائمة أدناه')
      return
    }
    setSaving(true)
    const payload: any = {
      role: editForm.role,
      username: u.value,
      permissions: userPerms,
      hr_employee_id: linkedHrId,
    }
    if (editForm.password) payload.password = await hashPassword(editForm.password)
    const { error } = await supabase.from('employees').update(payload).eq('id', selectedEmp.id).eq('tenant_id', tenant.id)
    if (linkedHrId) {
      await supabase.from('hr_employees').update({ employee_id: selectedEmp.id }).eq('id', linkedHrId).eq('tenant_id', tenant.id)
    }
    setSaving(false)
    if (error) { toast.error('خطأ: ' + error.message); return }
    const updated = { ...selectedEmp, ...payload }
    setEmployees(prev => prev.map(e => e.id === selectedEmp.id ? updated : e))
    setSelectedEmp(updated)
    if (currentUser?.id === selectedEmp.id) {
      setCurrentUser({ ...currentUser, ...updated })
      syncUserCookie({ ...currentUser, ...updated })
    }
    toast.success('تم حفظ الصلاحيات ✅')
  }

  async function handleActivate(data: any) {
    if (!tenant) return
    const u = validateLoginUsername(data.username)
    if (!u.ok) { toast.error(u.error); return }
    const p = validateLoginPassword(data.password)
    if (!p.ok) { toast.error(p.error); return }
    const { available, error: availErr } = await checkUsernameAvailable(supabase, tenant.id, u.value)
    if (availErr) { toast.error('خطأ: ' + availErr); return }
    if (!available) { toast.error('رقم الموظف / اسم المستخدم مستخدم من قبل موظف آخر'); return }

    const payload: any = {
      tenant_id:       tenant.id,
      name:            data.name,
      role:            data.role,
      username:        u.value,
      permissions:     Array.from(new Set([...(data.permissions || []), 'dashboard', 'hr_self'])),
      is_active:       true,
      hr_employee_id:  data.hrEmpId,
    }
    if (data.password) payload.password = await hashPassword(data.password)
    const { error } = await supabase.from('employees').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); return }
    await load()
    setShowModal(false); setActivateHr(null)
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
    if (data.password) payload.password = await hashPassword(data.password)
    const { error } = await supabase.from('employees').update(payload).eq('id', data.id)
    if (error) { toast.error('خطأ: ' + error.message); return }
    await load()
    setShowEdit(false); setEditEmp(null)
    toast.success('تم التعديل ✅')
  }

  async function handleToggleActive(emp: Emp) {
    const check = canDisableLoginAccount(emp, currentUser?.id)
    if (!check.allowed) { toast.error(check.reason!); return }
    const newStatus = !emp.is_active
    if (!confirm((newStatus ? 'تفعيل ' : 'تعطيل ') + emp.name + '؟')) return
    await supabase.from('employees').update({ is_active: newStatus }).eq('id', emp.id)
    await load()
    toast.success(newStatus ? '✅ تم تفعيل ' + emp.name : '⛔ تم تعطيل ' + emp.name)
  }

  async function handleDeleteExternalUser(emp: Emp) {
    if (!tenant || !isAdmin) return
    const check = canDeleteLoginAccount(emp, currentUser?.id, allHrEmployees)
    if (!check.allowed) { toast.error(check.reason!); return }
    if (!confirm(
      `حذف حساب "${emp.name}" نهائياً؟\n\n` +
      `• اسم المستخدم: ${emp.username || '—'}\n` +
      `• ${emp.permissions?.length || 0} صلاحية\n\n` +
      `لا يوجد ملف HR — مناسب للمحترفين/التجربة.\n` +
      `سيتم فك الربط تلقائياً (مثل: مدير قسم، مهام).\n` +
      `هذا الإجراء لا يُراجع.`
    )) return

    setDeleting(true)
    const result = await deleteEmployeeAccount(tenant.id, emp.id)
    setDeleting(false)

    if (!result.ok) {
      toast.error(
        'تعذّر الحذف: ' + (result.error || '') +
        '\nجرّب «تعطيل» الحساب، أو أزل المستخدم من مديرية الأقسام في HR → الهيكل التنظيمي.'
      )
      return
    }

    if (selectedEmp?.id === emp.id) setSelectedEmp(null)
    await load()
    toast.success(`🗑️ تم حذف حساب ${emp.name}`)
  }

  async function handleDeleteAllExternal() {
    if (!tenant || !isAdmin) return
    const targets = employees.filter(e =>
      canDeleteLoginAccount(e, currentUser?.id, allHrEmployees).allowed
    )
    if (targets.length === 0) {
      toast.error('لا توجد حسابات بدون ملف HR للحذف')
      return
    }
    if (!confirm(
      `حذف ${targets.length} حساب بدون ملف HR؟\n\n` +
      targets.map(e => `• ${e.name}`).join('\n') +
      '\n\nهذا الإجراء لا يُراجع.'
    )) return

    setDeleting(true)
    let deleted = 0
    let lastError = ''
    for (const emp of targets) {
      const result = await deleteEmployeeAccount(tenant.id, emp.id)
      if (result.ok) deleted++
      else lastError = result.error || lastError
    }
    setDeleting(false)
    if (deleted < targets.length && lastError) {
      toast.error(`تم حذف ${deleted} فقط. آخر خطأ: ${lastError}`)
    }
    setSelectedEmp(null)
    await load()
    toast.success(`🗑️ تم حذف ${deleted} من ${targets.length} حساب`)
  }

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name.includes(search) || (e.role || '').includes(search) || (e.username || '').includes(search)
    if (activeTab === 'external') {
      return matchSearch && isExternalLoginUser(e, allHrEmployees)
    }
    const matchTab = activeTab === 'active' ? e.is_active : activeTab === 'inactive' ? !e.is_active : true
    return matchSearch && matchTab
  })

  const externalUsers = employees.filter(e =>
    isExternalLoginUser(e, allHrEmployees)
  )

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
            {activeCount} نشط · {inactiveCount} معطّل · {externalUsers.length} بدون HR · {hrEmployees.length} بانتظار التنشيط
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
        <button onClick={() => setActiveTab('external')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.15s',
            background: activeTab === 'external' ? '#c81e1e' : 'transparent', color: activeTab === 'external' ? 'white' : '#6b7280' }}>
          <UserMinus style={{ width: '15px', height: '15px' }} /> بدون HR ({externalUsers.length})
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
                  <button onClick={() => { setActivateHr(h); setShowModal(true) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #86efac', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <UserPlus style={{ width: '14px', height: '14px' }} /> تنشيط
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* ══ Split View: قائمة + صلاحيات ══ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeTab === 'external' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '12px 14px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '0.82rem', color: '#991b1b', lineHeight: 1.6 }}>
                <strong>حسابات بدون ملف HR</strong> — محترفون أو تجربة. بعد انتهاء العمل احذفهم من هنا.
                لا يظهر في هذه القائمة من لهم ملف في الموارد البشرية.
              </div>
              {isAdmin && externalUsers.filter(e => canDeleteLoginAccount(e, currentUser?.id, allHrEmployees).allowed).length > 0 && (
                <button onClick={handleDeleteAllExternal} disabled={deleting}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #fca5a5', background: 'white', color: '#c81e1e', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  <Trash2 style={{ width: '14px', height: '14px' }} />
                  {deleting ? 'جاري الحذف...' : `حذف الكل (${externalUsers.filter(e => canDeleteLoginAccount(e, currentUser?.id, allHrEmployees).allowed).length})`}
                </button>
              )}
            </div>
          )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          gap: '0',
          minHeight: 'calc(100vh - 280px)',
          background: 'white',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>

          {/* قائمة الموظفين */}
          <div style={{ borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fafbfc' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af' }}>
              {filtered.length} مستخدم
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem' }}>
                {activeTab === 'external' ? 'لا توجد حسابات بدون ملف HR' : 'لا يوجد مستخدمون'}
              </div>
            ) : filtered.map(emp => {
              const badge = getAccountBadge(emp, allHrEmployees)
              const isExternal = isExternalLoginUser(emp, allHrEmployees)
              const isOwner = isTenantOwner(emp)
              return (
              <div key={emp.id} onClick={() => isAdmin && selectEmp(emp)}
                style={{
                  padding: '11px 14px', borderBottom: '1px solid var(--bg2)',
                  cursor: isAdmin ? 'pointer' : 'default',
                  background: selectedEmp?.id === emp.id ? '#eff6ff' : 'white',
                  borderRight: selectedEmp?.id === emp.id ? '3px solid #1a56db' : '3px solid transparent',
                  opacity: emp.is_active ? 1 : 0.6, transition: 'background 0.1s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isOwner ? '#fef3c7' : isExternal ? '#fef2f2' : emp.is_active ? '#ecfdf5' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isOwner ? '#b45309' : isExternal ? '#c81e1e' : emp.is_active ? '#0ea77b' : '#9ca3af', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                    {(emp.name||'?')[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{emp.role}</div>
                  </div>
                  {badge && (
                    <span style={{ fontSize: '0.6rem', background: badge.bg, color: badge.color, borderRadius: '8px', padding: '2px 6px', fontWeight: 700, flexShrink: 0 }}>
                      {badge.label}
                    </span>
                  )}
                  <span style={{ fontSize: '0.65rem', background: '#e0e7ff', color: '#4338ca', borderRadius: '10px', padding: '1px 6px', fontWeight: 700, flexShrink: 0 }}>
                    {emp.permissions?.length || 0}
                  </span>
                  {isAdmin && isExternal && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteExternalUser(emp) }}
                      disabled={deleting}
                      title="حذف الحساب"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e', padding: '2px', flexShrink: 0 }}>
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                    </button>
                  )}
                </div>
              </div>
            )})}
            </div>
          </div>

          {/* لوحة الصلاحيات — كاملة */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {selectedEmp ? (() => {
            const selectedBadge = getAccountBadge(selectedEmp, allHrEmployees)
            const selectedOwner = isTenantOwner(selectedEmp)
            const needsHrLink = userPerms.includes('hr_self') && !hrLinkId && !selectedOwner
            return (
            <>
              {/* Hero */}
              <div style={{
                padding: '18px 24px',
                background: selectedOwner
                  ? 'linear-gradient(135deg, #92400e 0%, #b45309 50%, #d97706 100%)'
                  : 'linear-gradient(135deg, #1e3a8a 0%, #1a56db 50%, #3b82f6 100%)',
                color: 'white', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '14px',
                      background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.3rem', fontWeight: 800, border: '2px solid rgba(255,255,255,0.3)',
                    }}>
                      {(selectedEmp.name || '?')[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {selectedEmp.name}
                        {selectedBadge && (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.25)', borderRadius: '8px', padding: '2px 8px', fontWeight: 700 }}>
                            {selectedBadge.label}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.88, marginTop: '3px' }}>
                        {selectedEmp.role} · @{selectedEmp.username || '—'}
                        {!selectedEmp.is_active && ' · معطّل'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {isAdmin && isExternalLoginUser(selectedEmp, allHrEmployees) && (
                      <button onClick={() => handleDeleteExternalUser(selectedEmp)} disabled={deleting}
                        style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Trash2 style={{ width: '13px', height: '13px' }} />
                        {deleting ? '...' : 'حذف'}
                      </button>
                    )}
                    {!selectedOwner && (
                      <button onClick={() => handleToggleActive(selectedEmp)}
                        style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                        {selectedEmp.is_active ? 'تعطيل' : 'تفعيل'}
                      </button>
                    )}
                    <button onClick={saveSelectedEmp} disabled={saving}
                      style={{ padding: '7px 18px', borderRadius: '8px', border: 'none', background: 'white', color: '#1a56db', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Save style={{ width: '14px', height: '14px' }} />
                      {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </button>
                  </div>
                </div>
              </div>

              {/* المحتوى */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* بيانات الحساب */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, marginBottom: '5px', color: '#9ca3af' }}>{LOGIN_USERNAME_LABEL}</label>
                    <input value={editForm.username}
                      onChange={e => { setUsernameManual(true); setEditForm(f => ({ ...f, username: e.target.value })) }}
                      className="input" style={{ fontSize: '0.85rem' }} dir="ltr"
                      placeholder={LOGIN_USERNAME_PLACEHOLDER} />
                    {(() => {
                      const linkedHr = allHrEmployees.find(h => h.id === Number(hrLinkId))
                      const suggested = suggestUsernameFromEmployeeNumber(linkedHr?.employee_number)
                      if (!suggested || editForm.username === suggested) return null
                      return (
                        <button type="button" onClick={() => { setUsernameManual(false); setEditForm(f => ({ ...f, username: suggested })) }}
                          style={{ marginTop: '5px', fontSize: '0.68rem', color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                          استخدام الرقم الوظيفي ({suggested})
                        </button>
                      )
                    })()}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, marginBottom: '5px', color: '#9ca3af' }}>كلمة مرور جديدة</label>
                    <input type="password" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} className="input" style={{ fontSize: '0.85rem' }} placeholder="8+ أحرف، حرف ورقم" dir="ltr" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, marginBottom: '5px', color: '#9ca3af' }}>الدور الوظيفي</label>
                    <input value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className="input" style={{ fontSize: '0.85rem' }} />
                  </div>
                </div>

                {/* ربط HR */}
                <div style={{ padding: '14px 16px', borderRadius: '12px', border: `1px solid ${needsHrLink ? '#fecaca' : '#e5e7eb'}`, background: needsHrLink ? '#fef2f2' : '#f8fafc' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, marginBottom: '6px', color: needsHrLink ? '#c81e1e' : '#64748b' }}>
                    ملف الموظف في HR {userPerms.includes('hr_self') && !selectedOwner ? '(مطلوب للخدمة الذاتية)' : '(اختياري)'}
                  </label>
                  <select value={hrLinkId} onChange={e => handleHrLinkChange(e.target.value)} className="select" style={{ fontSize: '0.85rem', maxWidth: '400px' }}>
                    <option value="">— غير مربوط —</option>
                    {allHrEmployees.map(h => (
                      <option key={h.id} value={h.id}>{h.name}{h.job_title ? ` — ${h.job_title}` : ''}</option>
                    ))}
                  </select>
                  {needsHrLink && (
                    <p style={{ fontSize: '0.75rem', color: '#c81e1e', marginTop: '8px', lineHeight: 1.5 }}>
                      بدون هذا الربط ستظهر رسالة «غير مصرح» رغم وجود صلاحية الخدمة الذاتية.
                    </p>
                  )}
                </div>

                {/* محرر الصلاحيات */}
                <UserPermissionsEditor
                  userPerms={userPerms}
                  onChange={setUserPerms}
                  currentRole={editForm.role}
                  onApplyRole={(role) => setEditForm(f => ({ ...f, role }))}
                  readOnly={!isAdmin}
                />
              </div>
            </>
          )})() : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', padding: '60px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <Shield style={{ width: '36px', height: '36px', color: '#cbd5e1' }} />
              </div>
              <p style={{ fontWeight: 700, fontSize: '1rem', color: '#6b7280' }}>اختر مستخدماً من القائمة</p>
              <p style={{ fontSize: '0.82rem', marginTop: '6px' }}>ستظهر لوحة الصلاحيات الكاملة هنا</p>
            </div>
          )}
          </div>
        </div>
        </div>
      )}

      {/* مودال تنشيط موظف جديد */}
      {showModal && activateHr && (
        <ActivateModal hrEmp={activateHr}
          onClose={() => { setShowModal(false); setActivateHr(null) }}
          onSave={handleActivate}
          onGoToPermissions={() => { setShowModal(false); setActivateHr(null) }} />
      )}
    </div>
  )
}
