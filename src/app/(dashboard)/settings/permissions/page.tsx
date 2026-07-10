'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Shield, Save, Users, ChevronDown, ChevronUp, Check } from 'lucide-react'
import toast from 'react-hot-toast'

// ── تعريف الصلاحيات وتجميعاتها ──
const PERMISSION_GROUPS = [
  {
    label: 'عام', color: '#6b7280',
    perms: [
      { id: 'dashboard',      label: 'لوحة التحكم',     icon: '📊' },
    ]
  },
  {
    label: 'المشاريع', color: '#1a56db',
    perms: [
      { id: 'projects_view',  label: 'عرض المشاريع',    icon: '👁️' },
      { id: 'projects_edit',  label: 'تعديل المشاريع',  icon: '✏️' },
      { id: 'pmo',            label: 'إدارة PMO',        icon: '📋' },
    ]
  },
  {
    label: 'الزيارات', color: '#0ea77b',
    perms: [
      { id: 'visits',              label: 'كل الزيارات',       icon: '🔎' },
      { id: 'visits_quality',      label: 'زيارات الجودة',     icon: '✅' },
      { id: 'visits_safety',       label: 'زيارات السلامة',    icon: '🦺' },
      { id: 'visits_electrical',   label: 'زيارات كهربائية',   icon: '⚡' },
      { id: 'visits_field',        label: 'زيارات ميدانية',    icon: '🏗️' },
    ]
  },
  {
    label: 'QHSE', color: '#e6820a',
    perms: [
      { id: 'qhse',           label: 'QHSE',             icon: '🛡️' },
    ]
  },
  {
    label: 'المخزون والمشتريات', color: '#7c3aed',
    perms: [
      { id: 'inventory',      label: 'المخزون',           icon: '📦' },
      { id: 'purchases',      label: 'المشتريات',         icon: '🛒' },
    ]
  },
  {
    label: 'الموارد البشرية', color: '#9333ea',
    perms: [
      { id: 'hr',             label: 'HR',                icon: '👥' },
      { id: 'employees',      label: 'الموظفون',           icon: '👤' },
      { id: 'hr_self',        label: 'الخدمة الذاتية',     icon: '🙋' },
    ]
  },
  {
    label: 'المالية', color: '#0f766e',
    perms: [
      { id: 'finance',        label: 'المالية',            icon: '💰' },
    ]
  },
  {
    label: 'التقارير', color: '#64748b',
    perms: [
      { id: 'reports',        label: 'التقارير',           icon: '📈' },
    ]
  },
]

const ALL_PERMS = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.id))

// ── الأدوار الافتراضية ──
const DEFAULT_ROLES: Record<string, string[]> = {
  'مدير عام':      ALL_PERMS,
  'مدير مشروع':    ['dashboard','projects_view','projects_edit','visits','visits_quality','visits_safety','visits_electrical','visits_field','inventory','purchases','reports','pmo'],
  'مهندس جودة':    ['dashboard','projects_view','visits_quality','qhse','reports'],
  'مهندس سلامة':   ['dashboard','projects_view','visits_safety','qhse','reports'],
  'مهندس كهرباء':  ['dashboard','projects_view','visits_electrical','visits_field','inventory','reports'],
  'مهندس ميداني':  ['dashboard','projects_view','visits_field','reports'],
  'مشرف':          ['dashboard','projects_view','visits_field','reports'],
  'محاسب':         ['dashboard','finance','purchases','reports'],
  'مدير HR':       ['dashboard','hr','employees','reports'],
  'مدير المالية':  ['dashboard','finance','purchases','reports','employees'],
}

type Employee = { id: number; name: string; role: string; permissions: string[]; is_active: boolean }

export default function PermissionsPage() {
  const { tenant, currentUser } = useStore()
  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [selected,     setSelected]     = useState<number | null>(null)
  const [userPerms,    setUserPerms]    = useState<string[]>([])
  const [saving,       setSaving]       = useState(false)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [tab,          setTab]          = useState<'users' | 'roles'>('users')

  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { if (tenant) loadEmployees() }, [tenant?.id])

  async function loadEmployees() {
    const { data } = await supabase.from('employees')
      .select('id, name, role, permissions, is_active')
      .eq('tenant_id', tenant!.id)
      .eq('is_active', true)
      .order('name')
    const emps = data || []
    setEmployees(emps)
    // لو موظف محدد — حدّث userPerms من البيانات الجديدة
    if (selected) {
      const updated = emps.find(e => e.id === selected)
      if (updated) setUserPerms(updated.permissions || [])
    }
  }

  function selectEmployee(emp: Employee) {
    setSelected(emp.id)
    setUserPerms(emp.permissions || [])
  }

  function togglePerm(perm: string) {
    setUserPerms(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    )
  }

  function applyRole(role: string) {
    const perms = DEFAULT_ROLES[role] || ['dashboard']
    setUserPerms(perms)
    toast.success(`تم تطبيق صلاحيات دور "${role}"`)
  }

  async function savePerms() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('employees')
      .update({ permissions: userPerms })
      .eq('id', selected).eq('tenant_id', tenant!.id)
    setSaving(false)
    if (error) { toast.error('خطأ: ' + error.message); return }
    // تحديث الـ state محلياً مباشرة بدون انتظار loadEmployees
    setEmployees(prev => prev.map(e => e.id === selected ? { ...e, permissions: userPerms } : e))
    await loadEmployees()
    toast.success('تم حفظ الصلاحيات ✅')
  }

  async function saveRole(empId: number, role: string) {
    const perms = DEFAULT_ROLES[role] || ['dashboard']
    const { error } = await supabase.from('employees')
      .update({ role, permissions: perms })
      .eq('id', empId).eq('tenant_id', tenant!.id)
    if (error) { toast.error('خطأ: ' + error.message); return }
    await loadEmployees()
    toast.success('تم تحديث الدور ✅')
  }

  const selectedEmp = employees.find(e => e.id === selected)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Shield style={{ width: '22px', height: '22px', color: '#1a56db' }} />
        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>إدارة الصلاحيات والأدوار</h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>تحديد ما يراه كل موظف في النظام</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '4px', width: 'fit-content', gap: '4px' }}>
        {[['users','👤 الموظفون'], ['roles','🛡️ الأدوار']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            style={{ padding: '7px 20px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.82rem',
              background: tab === id ? 'white' : 'transparent',
              color: tab === id ? '#1a56db' : 'var(--text3)',
              boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px', alignItems: 'start' }}>

          {/* قائمة الموظفين */}
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text3)' }}>
              <Users style={{ width: '13px', height: '13px', display: 'inline', marginLeft: '6px' }} />
              الموظفون ({employees.length})
            </div>
            {employees.map(emp => {
              const roleIcon = emp.role.includes('جودة') ? '🔍' : emp.role.includes('سلامة') ? '🦺' :
                emp.role.includes('مدير') ? '👑' : emp.role.includes('مهندس') ? '⚡' :
                emp.role.includes('محاسب') ? '💰' : emp.role.includes('HR') ? '👥' : '👤'
              return (
                <div key={emp.id} onClick={() => selectEmployee(emp)}
                  style={{
                    padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid var(--bg2)',
                    background: selected === emp.id ? '#eff6ff' : 'white',
                    borderRight: selected === emp.id ? '3px solid #1a56db' : '3px solid transparent',
                    transition: 'all 0.1s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                      {roleIcon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{emp.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{emp.role}</div>
                    </div>
                    <div style={{ marginRight: 'auto', fontSize: '0.65rem', background: '#e0e7ff', color: '#4338ca',
                      borderRadius: '10px', padding: '2px 6px', fontWeight: 600 }}>
                      {emp.permissions?.length || 0}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* لوحة الصلاحيات */}
          {selectedEmp ? (
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)' }}>
              {/* Header الموظف */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{selectedEmp.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>
                    الدور الحالي: <strong>{selectedEmp.role}</strong> · {userPerms.length} صلاحية
                  </div>
                </div>
                <button onClick={savePerms} disabled={saving}
                  className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
                  <Save style={{ width: '14px', height: '14px' }} />
                  {saving ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
                </button>
              </div>

              {/* تطبيق دور جاهز */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text3)', marginBottom: '8px' }}>
                  تطبيق دور جاهز (يُحدَّث الصلاحيات تلقائياً):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {Object.keys(DEFAULT_ROLES).map(role => (
                    <button key={role} onClick={() => applyRole(role)}
                      style={{ padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--border)',
                        background: selectedEmp.role === role ? '#eff6ff' : 'white',
                        color: selectedEmp.role === role ? '#1a56db' : 'var(--text3)',
                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* الصلاحيات */}
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {PERMISSION_GROUPS.map(group => (
                  <div key={group.label}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: group.color,
                      marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: group.color }} />
                      {group.label}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {group.perms.map(perm => {
                        const active = userPerms.includes(perm.id)
                        return (
                          <button key={perm.id} onClick={() => togglePerm(perm.id)}
                            style={{
                              padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                              fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                              border: `2px solid ${active ? group.color : '#e5e7eb'}`,
                              background: active ? group.color + '15' : 'white',
                              color: active ? group.color : 'var(--text3)',
                              display: 'flex', alignItems: 'center', gap: '5px',
                            }}>
                            {active && <Check style={{ width: '11px', height: '11px' }} />}
                            {perm.icon} {perm.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)',
              padding: '60px', textAlign: 'center', color: 'var(--text3)' }}>
              <Shield style={{ width: '40px', height: '40px', margin: '0 auto 12px', color: '#e5e7eb' }} />
              <p style={{ fontWeight: 600 }}>اختر موظفاً من القائمة</p>
              <p style={{ fontSize: '0.78rem', marginTop: '4px' }}>لعرض وتعديل صلاحياته</p>
            </div>
          )}
        </div>
      )}

      {tab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '12px 16px', fontSize: '0.82rem', color: '#e6820a' }}>
            💡 هذه الأدوار الافتراضية — عند تعيين موظف لدور يُطبَّق عليه الصلاحيات تلقائياً
          </div>
          {Object.entries(DEFAULT_ROLES).map(([role, perms]) => {
            const isExpanded = expandedRole === role
            return (
              <div key={role} style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div onClick={() => setExpandedRole(isExpanded ? null : role)}
                  style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>
                      {role.includes('جودة') ? '🔍' : role.includes('سلامة') ? '🦺' :
                       role.includes('مدير عام') ? '👑' : role.includes('مشروع') ? '📋' :
                       role.includes('كهرباء') ? '⚡' : role.includes('ميداني') ? '🏗️' :
                       role.includes('مشرف') ? '👷' : role.includes('محاسب') ? '💰' : '👥'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700 }}>{role}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{perms.length} صلاحية</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '400px' }}>
                      {perms.slice(0, 5).map(p => {
                        const pInfo = PERMISSION_GROUPS.flatMap(g => g.perms).find(x => x.id === p)
                        return pInfo ? (
                          <span key={p} style={{ background: '#f1f5f9', color: '#475569', borderRadius: '6px',
                            padding: '2px 8px', fontSize: '0.68rem', fontWeight: 600 }}>
                            {pInfo.icon} {pInfo.label}
                          </span>
                        ) : null
                      })}
                      {perms.length > 5 && (
                        <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: '6px',
                          padding: '2px 8px', fontSize: '0.68rem', fontWeight: 600 }}>
                          +{perms.length - 5}
                        </span>
                      )}
                    </div>
                    {isExpanded
                      ? <ChevronUp style={{ width: '16px', height: '16px', color: 'var(--text3)' }} />
                      : <ChevronDown style={{ width: '16px', height: '16px', color: 'var(--text3)' }} />}
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: '14px 18px', borderTop: '1px solid var(--bg2)', display: 'flex', flexWrap: 'wrap', gap: '6px', background: '#f8fafc' }}>
                    {perms.map(p => {
                      const pInfo = PERMISSION_GROUPS.flatMap(g => g.perms).find(x => x.id === p)
                      return pInfo ? (
                        <span key={p} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px',
                          padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>
                          {pInfo.icon} {pInfo.label}
                        </span>
                      ) : null
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
