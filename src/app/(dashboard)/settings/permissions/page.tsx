'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Shield, Users, ChevronDown, ChevronUp, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { PERMISSION_GROUPS, DEFAULT_ROLES_PERMS, ALL_PERMISSION_IDS } from '@/lib/permissions-config'
import { UserPermissionsEditor } from '@/components/settings/UserPermissionsEditor'
import { getAccountBadge, isTenantOwner } from '@/lib/userAccountKind'

type Employee = {
  id: number; name: string; role: string; permissions: string[]
  is_active: boolean; username?: string; is_tenant_owner?: boolean
}

export default function PermissionsPage() {
  const { tenant, currentUser } = useStore()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [userPerms, setUserPerms] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [tab, setTab] = useState<'users' | 'roles'>('users')
  const [search, setSearch] = useState('')

  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { if (tenant) loadEmployees() }, [tenant?.id])

  async function loadEmployees() {
    const { data } = await supabase.from('employees')
      .select('id, name, role, permissions, is_active, username, is_tenant_owner')
      .eq('tenant_id', tenant!.id)
      .eq('is_active', true)
      .order('name')
    const emps = data || []
    setEmployees(emps)
    if (selected) {
      const updated = emps.find(e => e.id === selected)
      if (updated) setUserPerms(updated.permissions || [])
    }
  }

  function selectEmployee(emp: Employee) {
    setSelected(emp.id)
    setUserPerms(emp.permissions || [])
  }

  async function savePerms() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('employees')
      .update({ permissions: userPerms })
      .eq('id', selected).eq('tenant_id', tenant!.id)
    setSaving(false)
    if (error) { toast.error('خطأ: ' + error.message); return }
    setEmployees(prev => prev.map(e => e.id === selected ? { ...e, permissions: userPerms } : e))
    toast.success('تم حفظ الصلاحيات ✅')
  }

  const selectedEmp = employees.find(e => e.id === selected)
  const filteredEmployees = employees.filter(e =>
    !search || e.name.includes(search) || (e.role || '').includes(search) || (e.username || '').includes(search)
  )

  const totalPerms = ALL_PERMISSION_IDS.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 'calc(100vh - 120px)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #1a56db, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield style={{ width: '22px', height: '22px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1a1a2e' }}>إدارة الصلاحيات والأدوار</h1>
            <p style={{ fontSize: '0.78rem', color: '#9ca3af' }}>تحديد ما يراه كل مستخدم في النظام — {employees.length} مستخدم نشط</p>
          </div>
        </div>

        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '4px', gap: '4px' }}>
          {[['users', '👤 الموظفون'], ['roles', '🛡️ الأدوار']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as 'users' | 'roles')}
              style={{
                padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.82rem',
                background: tab === id ? 'white' : 'transparent',
                color: tab === id ? '#1a56db' : '#6b7280',
                boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'users' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          gap: '0',
          flex: 1,
          minHeight: 'calc(100vh - 200px)',
          background: 'white',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>

          {/* ── قائمة المستخدمين ── */}
          <div style={{ borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fafbfc' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9ca3af' }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="بحث..." className="input" style={{ paddingRight: '32px', fontSize: '0.82rem', background: 'white' }} />
              </div>
            </div>
            <div style={{ padding: '8px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users style={{ width: '12px', height: '12px' }} />
              {filteredEmployees.length} مستخدم
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredEmployees.map(emp => {
                const isSelected = selected === emp.id
                const badge = getAccountBadge(emp)
                const pct = Math.round(((emp.permissions?.length || 0) / totalPerms) * 100)
                return (
                  <div key={emp.id} onClick={() => selectEmployee(emp)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer',
                      borderBottom: '1px solid #f1f5f9',
                      background: isSelected ? 'white' : 'transparent',
                      borderRight: isSelected ? '3px solid #1a56db' : '3px solid transparent',
                      transition: 'all 0.12s',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                        background: isSelected ? 'linear-gradient(135deg, #1a56db, #3b82f6)' : '#e5e7eb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isSelected ? 'white' : '#6b7280', fontWeight: 800, fontSize: '0.9rem',
                      }}>
                        {(emp.name || '?')[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '1px' }}>{emp.role}</div>
                        {/* شريط تقدم مصغر */}
                        <div style={{ marginTop: '5px', height: '3px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: isSelected ? '#1a56db' : '#93c5fd', borderRadius: '2px', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'left', flexShrink: 0 }}>
                        {badge && (
                          <span style={{ fontSize: '0.58rem', background: badge.bg, color: badge.color, borderRadius: '6px', padding: '1px 5px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                            {badge.label}
                          </span>
                        )}
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4338ca' }}>
                          {emp.permissions?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── لوحة الصلاحيات الكاملة ── */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {selectedEmp ? (
              <>
                {/* Hero */}
                <div style={{
                  padding: '20px 24px',
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #1a56db 50%, #3b82f6 100%)',
                  color: 'white', flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '14px',
                      background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.4rem', fontWeight: 800, border: '2px solid rgba(255,255,255,0.3)',
                    }}>
                      {(selectedEmp.name || '?')[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>{selectedEmp.name}</div>
                      <div style={{ fontSize: '0.82rem', opacity: 0.85, marginTop: '3px' }}>
                        {selectedEmp.role} · @{selectedEmp.username || '—'}
                        {isTenantOwner(selectedEmp) && ' · مدير النظام'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* محرر الصلاحيات */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minHeight: 0 }}>
                  <UserPermissionsEditor
                    userPerms={userPerms}
                    onChange={setUserPerms}
                    currentRole={selectedEmp.role}
                    onSave={savePerms}
                    saving={saving}
                    readOnly={!isAdmin}
                  />
                </div>
              </>
            ) : (
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
      )}

      {tab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', padding: '12px 16px', fontSize: '0.82rem', color: '#e6820a' }}>
            💡 هذه الأدوار الافتراضية — عند تعيين موظف لدور يُطبَّق عليه الصلاحيات تلقائياً
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
            {Object.entries(DEFAULT_ROLES_PERMS).map(([role, perms]) => {
              const isExpanded = expandedRole === role
              const pct = Math.round((perms.length / totalPerms) * 100)
              return (
                <div key={role} style={{ background: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div onClick={() => setExpandedRole(isExpanded ? null : role)}
                    style={{ padding: '16px 18px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                          {role.includes('مدير عام') ? '👑' : role.includes('مهندس') ? '⚡' : role.includes('محاسب') ? '💰' : '👤'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{role}</div>
                          <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '2px' }}>{perms.length} صلاحية · {pct}% تغطية</div>
                        </div>
                      </div>
                      {isExpanded
                        ? <ChevronUp style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
                        : <ChevronDown style={{ width: '16px', height: '16px', color: '#9ca3af' }} />}
                    </div>
                    <div style={{ marginTop: '10px', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#1a56db', borderRadius: '2px' }} />
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '14px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: '6px', background: '#fafbfc' }}>
                      {perms.map(p => {
                        const pInfo = PERMISSION_GROUPS.flatMap(g => g.perms).find(x => x.id === p)
                        return pInfo ? (
                          <span key={p} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600 }}>
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
        </div>
      )}
    </div>
  )
}
