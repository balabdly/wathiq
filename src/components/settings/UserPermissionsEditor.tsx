'use client'
import { useMemo, useState } from 'react'
import { Check, Save, Search, Shield, X } from 'lucide-react'
import { PERMISSION_GROUPS, ALL_PERMISSION_IDS, DEFAULT_ROLES_PERMS } from '@/lib/permissions-config'

type Props = {
  userPerms: string[]
  onChange: (perms: string[]) => void
  currentRole?: string
  onApplyRole?: (role: string, perms: string[]) => void
  onSave?: () => void
  saving?: boolean
  readOnly?: boolean
}

export function UserPermissionsEditor({
  userPerms,
  onChange,
  currentRole = '',
  onApplyRole,
  onSave,
  saving = false,
  readOnly = false,
}: Props) {
  const [permSearch, setPermSearch] = useState('')

  const totalCount = ALL_PERMISSION_IDS.length
  const activeCount = userPerms.length
  const coverage = Math.round((activeCount / totalCount) * 100)

  const filteredGroups = useMemo(() => {
    const q = permSearch.trim()
    if (!q) return PERMISSION_GROUPS
    return PERMISSION_GROUPS
      .map(g => ({
        ...g,
        perms: g.perms.filter(p => p.label.includes(q) || p.id.includes(q) || g.label.includes(q)),
      }))
      .filter(g => g.perms.length > 0)
  }, [permSearch])

  function togglePerm(id: string) {
    if (readOnly) return
    onChange(userPerms.includes(id) ? userPerms.filter(p => p !== id) : [...userPerms, id])
  }

  function toggleGroup(groupPerms: string[], enable: boolean) {
    if (readOnly) return
    if (enable) {
      onChange(Array.from(new Set([...userPerms, ...groupPerms])))
    } else {
      const ids = new Set(groupPerms)
      onChange(userPerms.filter(p => !ids.has(p)))
    }
  }

  function applyRole(role: string) {
    const perms = DEFAULT_ROLES_PERMS[role] || ['dashboard']
    onChange(perms)
    onApplyRole?.(role, perms)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: 0 }}>

      {/* شريط الإحصائيات والبحث */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* حلقة التغطية */}
          <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
            <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="28" cy="28" r="24" fill="none" stroke="#e5e7eb" strokeWidth="5" />
              <circle cx="28" cy="28" r="24" fill="none" stroke="#1a56db" strokeWidth="5"
                strokeDasharray={`${(coverage / 100) * 150.8} 150.8`}
                strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#1a56db' }}>
              {coverage}%
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a2e' }}>
              {activeCount} <span style={{ color: '#9ca3af', fontWeight: 500 }}>/ {totalCount} صلاحية</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
              {coverage >= 80 ? 'صلاحيات واسعة — مدير أو مشرف عام' :
               coverage >= 40 ? 'صلاحيات متوسطة — دور تشغيلي' :
               'صلاحيات محدودة — وصول أساسي'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!readOnly && (
            <>
              <button type="button" onClick={() => onChange(ALL_PERMISSION_IDS)}
                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                تحديد الكل
              </button>
              <button type="button" onClick={() => onChange(['dashboard'])}
                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                إعادة تعيين
              </button>
            </>
          )}
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9ca3af' }} />
            <input value={permSearch} onChange={e => setPermSearch(e.target.value)}
              placeholder="بحث في الصلاحيات..."
              className="input" style={{ paddingRight: '32px', width: '200px', fontSize: '0.82rem' }} />
          </div>
          {onSave && (
            <button onClick={onSave} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 18px' }}>
              <Save style={{ width: '14px', height: '14px' }} />
              {saving ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
            </button>
          )}
        </div>
      </div>

      {/* أدوار جاهزة */}
      <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '14px 16px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '10px' }}>
          قوالب الأدوار — تطبيق فوري
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Object.keys(DEFAULT_ROLES_PERMS).map(role => {
            const roleCount = DEFAULT_ROLES_PERMS[role].length
            const isActive = currentRole === role
            return (
              <button key={role} type="button" disabled={readOnly} onClick={() => applyRole(role)}
                style={{
                  padding: '8px 14px', borderRadius: '10px', cursor: readOnly ? 'default' : 'pointer',
                  border: `2px solid ${isActive ? '#1a56db' : '#e5e7eb'}`,
                  background: isActive ? '#eff6ff' : 'white',
                  color: isActive ? '#1a56db' : '#374151',
                  fontSize: '0.78rem', fontWeight: 600,
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
                  minWidth: '100px', transition: 'all 0.15s',
                  boxShadow: isActive ? '0 2px 8px rgba(26,86,219,0.12)' : 'none',
                }}>
                <span>{role}</span>
                <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 500 }}>{roleCount} صلاحية</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* شبكة بطاقات الصلاحيات */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px',
        flex: 1,
        overflowY: 'auto',
        paddingBottom: '8px',
        alignContent: 'start',
      }}>
        {filteredGroups.map(group => {
          const groupIds = group.perms.map(p => p.id)
          const groupActive = groupIds.filter(id => userPerms.includes(id)).length
          const allOn = groupActive === groupIds.length
          const noneOn = groupActive === 0

          return (
            <div key={group.label} style={{
              background: 'white',
              borderRadius: '14px',
              border: `1px solid ${noneOn ? '#e5e7eb' : group.color + '40'}`,
              overflow: 'hidden',
              boxShadow: noneOn ? 'none' : `0 4px 14px ${group.color}12`,
              transition: 'all 0.2s',
            }}>
              {/* رأس البطاقة */}
              <div style={{
                padding: '12px 16px',
                background: `linear-gradient(135deg, ${group.color}08 0%, ${group.color}04 100%)`,
                borderBottom: `2px solid ${group.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: group.color }} />
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1a1a2e' }}>{group.label}</span>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                    background: groupActive > 0 ? group.color + '20' : '#f3f4f6',
                    color: groupActive > 0 ? group.color : '#9ca3af',
                  }}>
                    {groupActive}/{groupIds.length}
                  </span>
                </div>
                {!readOnly && (
                  <button type="button" onClick={() => toggleGroup(groupIds, !allOn)}
                    style={{ fontSize: '0.68rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: allOn ? group.color + '20' : '#f3f4f6', color: allOn ? group.color : '#6b7280' }}>
                    {allOn ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                )}
              </div>

              {/* قائمة الصلاحيات */}
              <div style={{ padding: '8px' }}>
                {group.perms.map(perm => {
                  const active = userPerms.includes(perm.id)
                  return (
                    <button key={perm.id} type="button" disabled={readOnly}
                      onClick={() => togglePerm(perm.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', borderRadius: '10px', border: 'none', cursor: readOnly ? 'default' : 'pointer',
                        background: active ? group.color + '10' : 'transparent',
                        transition: 'background 0.12s', textAlign: 'right',
                      }}>
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                        border: `2px solid ${active ? group.color : '#d1d5db'}`,
                        background: active ? group.color : 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {active && <Check style={{ width: '12px', height: '12px', color: 'white' }} />}
                      </div>
                      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{perm.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: active ? '#1a1a2e' : '#6b7280' }}>
                          {perm.label}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontFamily: 'monospace', marginTop: '1px' }} dir="ltr">
                          {perm.id}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {filteredGroups.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
            <Shield style={{ width: '32px', height: '32px', margin: '0 auto 8px', opacity: 0.4 }} />
            لا توجد صلاحيات تطابق البحث
          </div>
        )}
      </div>
    </div>
  )
}
