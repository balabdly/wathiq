'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { employeesApi } from '@/lib/db'
import { ROLES_PERMISSIONS } from '@/lib/utils'
import { Users, Plus, Search, Pencil, Trash2, X, Shield, Eye, EyeOff } from 'lucide-react'
import type { Employee, UserRole } from '@/types'
import toast from 'react-hot-toast'

const ALL_PERMISSIONS = [
  { key: 'dashboard',          label: 'لوحة التحكم' },
  { key: 'projects_view',      label: 'عرض المشاريع' },
  { key: 'projects_edit',      label: 'تعديل المشاريع' },
  { key: 'visits_quality',     label: 'زيارات الجودة' },
  { key: 'visits_safety',      label: 'زيارات السلامة' },
  { key: 'visits_electrical',  label: 'زيارات كهربائية' },
  { key: 'visits_field',       label: 'زيارات ميدانية' },
  { key: 'inventory',          label: 'المخزون' },
  { key: 'purchases',          label: 'المشتريات' },
  { key: 'employees',          label: 'الموظفون' },
  { key: 'reports',            label: 'التقارير' },
  { key: 'qhse',               label: 'QHSE' },
]

const ROLES: UserRole[] = ['مدير عام','مدير مشروع','مهندس جودة','مهندس سلامة','مشرف كهربائي','مهندس مدني','أمين مستودع']

function EmpModal({ emp, onClose, onSave }: {
  emp: Employee | null
  onClose: () => void
  onSave: (d: Partial<Employee>) => Promise<void>
}) {
  const [saving, setSaving]         = useState(false)
  const [showPass, setShowPass]     = useState(false)
  const [form, setForm]             = useState({
    name:     emp?.name     || '',
    username: emp?.username || '',
    password: '',
    role:     (emp?.role    || 'مهندس جودة') as UserRole,
    phone:    emp?.phone    || '',
    email:    emp?.email    || '',
    is_active: emp?.is_active ?? true,
  })
  const [perms, setPerms] = useState<string[]>(emp?.permissions || ROLES_PERMISSIONS['مهندس جودة'])
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function handleRoleChange(role: UserRole) {
    set('role', role)
    setPerms(ROLES_PERMISSIONS[role] || [])
  }

  function togglePerm(key: string) {
    setPerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.username.trim()) return
    setSaving(true)
    const payload: Partial<Employee> = {
      ...(emp ? { id: emp.id } : {}),
      name:        form.name,
      username:    form.username,
      role:        form.role,
      phone:       form.phone || undefined,
      email:       form.email || undefined,
      permissions: perms,
      is_active:   form.is_active,
    }
    // In a real app, hash the password server-side
    if (form.password) (payload as any).password_hash = form.password
    await onSave(payload)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-2xl">
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{emp ? 'تعديل موظف' : 'إضافة موظف'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم الكامل <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="الاسم" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المستخدم <span className="text-red-500">*</span></label>
                <input value={form.username} onChange={e => set('username', e.target.value)} className="input" placeholder="username" dir="ltr" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{emp ? 'كلمة مرور جديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور'}</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    className="input pl-10"
                    placeholder={emp ? '••••••' : 'كلمة المرور'}
                    required={!emp}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المسمى الوظيفي</label>
                <select value={form.role} onChange={e => handleRoleChange(e.target.value as UserRole)} className="select">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الجوال</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" placeholder="05xxxxxxxx" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" placeholder="email@example.com" dir="ltr" />
              </div>
            </div>

            {/* Permissions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Shield className="w-4 h-4" /> الصلاحيات</label>
                <button type="button" onClick={() => setPerms(ROLES_PERMISSIONS[form.role] || [])}
                  className="text-xs text-primary-600 hover:underline">إعادة تعيين حسب الدور</button>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl">
                {ALL_PERMISSIONS.map(p => (
                  <label key={p.key} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={perms.includes(p.key)} onChange={() => togglePerm(p.key)}
                      className="w-4 h-4 rounded accent-primary-500" />
                    <span className="text-xs text-gray-600 group-hover:text-gray-800">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="sr-only peer" />
                <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-primary-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:right-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-[-20px]" />
              </label>
              <span className="text-sm text-gray-600">حساب نشط</span>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {emp ? 'حفظ التعديلات' : 'إضافة الموظف'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function EmployeesPage() {
  const { tenant, employees, setEmployees, currentUser } = useStore()
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [roleFilter, setRole]   = useState('')
  const [showModal, setModal]   = useState(false)
  const [editEmp, setEditEmp]   = useState<Employee | null>(null)

  const canEdit = currentUser?.permissions?.includes('employees')
  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { loadEmployees() }, [tenant?.id])

  async function loadEmployees() {
    if (!tenant) return
    setLoading(true)
    const { data } = await employeesApi.getAll(tenant.id)
    setEmployees(data || [])
    setLoading(false)
  }

  async function handleSave(data: Partial<Employee>) {
    if (!tenant) return
    const { error } = await employeesApi.upsert({ ...data, tenant_id: tenant.id })
    if (error) { toast.error('حدث خطأ'); return }
    await loadEmployees()
    setModal(false)
    setEditEmp(null)
    toast.success(editEmp ? 'تم التعديل' : 'تمت الإضافة')
  }

  async function handleDelete(emp: Employee) {
    if (emp.id === currentUser?.id) { toast.error('لا يمكنك حذف حسابك'); return }
    if (!confirm(`حذف "${emp.name}"؟`)) return
    await employeesApi.delete(emp.id)
    setEmployees(employees.filter(e => e.id !== emp.id))
    toast.success('تم الحذف')
  }

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    const matchS = !q || e.name.toLowerCase().includes(q) || e.username.toLowerCase().includes(q)
    const matchR = !roleFilter || e.role === roleFilter
    return matchS && matchR
  })

  const ROLE_COLORS: Record<string, string> = {
    'مدير عام': 'badge-red', 'مدير مشروع': 'badge-blue',
    'مهندس جودة': 'badge-green', 'مهندس سلامة': 'badge-amber',
    'مشرف كهربائي': 'badge-blue', 'مهندس مدني': 'badge-gray',
    'أمين مستودع': 'badge-gray',
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-500" />
            الموظفون
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">{filtered.length} موظف</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditEmp(null); setModal(true) }} className="btn btn-primary">
            <Plus className="w-4 h-4" /> إضافة موظف
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input pr-9 text-sm" placeholder="بحث بالاسم أو المستخدم..." />
        </div>
        <select value={roleFilter} onChange={e => setRole(e.target.value)} className="select w-auto text-sm">
          <option value="">كل الأدوار</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">لا يوجد موظفون</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <div key={emp.id} className={`card p-5 hover:shadow-md transition-all ${!emp.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">{emp.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{emp.username}</div>
                  </div>
                </div>
                {!emp.is_active && <span className="badge badge-gray text-xs">غير نشط</span>}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className={`badge ${ROLE_COLORS[emp.role] || 'badge-gray'} text-xs`}>{emp.role}</span>
              </div>
              <div className="text-xs text-gray-400 space-y-1 mb-3">
                {emp.phone && <div>📞 {emp.phone}</div>}
                {emp.email && <div>✉️ {emp.email}</div>}
                <div className="text-gray-300">{emp.permissions.length} صلاحية</div>
              </div>
              {canEdit && (
                <div className="flex gap-2 pt-3 border-t border-gray-50">
                  <button onClick={() => { setEditEmp(emp); setModal(true) }} className="btn btn-ghost btn-sm flex-1 justify-center">
                    <Pencil className="w-3.5 h-3.5" /> تعديل
                  </button>
                  {isAdmin && emp.id !== currentUser?.id && (
                    <button onClick={() => handleDelete(emp)} className="btn btn-ghost btn-sm px-2.5 text-red-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <EmpModal emp={editEmp} onClose={() => { setModal(false); setEditEmp(null) }} onSave={handleSave} />
      )}
    </div>
  )
}
