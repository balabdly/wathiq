'use client'
import { useState } from 'react'
import { Pencil, Plus, Trash2, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { TEAM_TYPE_STYLE, type ProjectTeam, type TeamMember } from '@/lib/project-teams'
import type { TeamsPageData } from './types'
import { TeamModal, MemberModal } from './modals'

export default function FormationTab({ data }: { data: TeamsPageData }) {
  const { teams, members, employees, canEdit, tenantId, reload } = data
  const [selectedId, setSelectedId] = useState<number | null>(teams[0]?.id ?? null)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [editTeam, setEditTeam] = useState<ProjectTeam | null>(null)
  const [showMemberModal, setShowMemberModal] = useState(false)

  const selected = teams.find(t => t.id === selectedId) ?? null
  const teamMembers = selected ? (members[selected.id] || []) : []

  async function removeMember(memberId: number) {
    if (!selected || !confirm('إزالة هذا العضو من الفريق؟')) return
    const { error } = await supabase.from('team_members').update({ is_active: false }).eq('id', memberId)
    if (error) { toast.error(error.message); return }
    toast.success('تمت إزالة العضو')
    await reload()
  }

  async function setLead(empId: number) {
    if (!selected) return
    const emp = employees.find(e => e.id === empId)
    await supabase.from('teams').update({ lead_id: empId, updated_at: new Date().toISOString() }).eq('id', selected.id)
    await supabase.from('team_members').upsert({
      tenant_id: tenantId, team_id: selected.id,
      employee_id: empId, role_in_team: 'قائد', is_active: true,
    }, { onConflict: 'team_id,employee_id' })
    if (emp) {
      await supabase.from('projects').update({ lead_id: empId, engineer: emp.name })
        .eq('team_id', selected.id)
    }
    toast.success('تم تعيين المشرف')
    await reload()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px', alignItems: 'start' }}>
      {/* قائمة الفرق */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>الفرق ({teams.length})</span>
          {canEdit && (
            <button
              onClick={() => { setEditTeam(null); setShowTeamModal(true) }}
              style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', background: '#1a56db', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
            >
              <Plus style={{ width: '14px', height: '14px' }} /> جديد
            </button>
          )}
        </div>
        <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
          {teams.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>لا فرق بعد</div>
          ) : teams.map(t => {
            const style = TEAM_TYPE_STYLE[t.team_type] || TEAM_TYPE_STYLE['مختلط']
            const isSel = t.id === selectedId
            return (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                style={{
                  width: '100%', textAlign: 'right', padding: '12px 16px', border: 'none', cursor: 'pointer',
                  background: isSel ? '#eff6ff' : 'transparent',
                  borderRight: isSel ? '3px solid #1a56db' : '3px solid transparent',
                  borderBottom: '1px solid var(--bg2)', fontFamily: 'inherit',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: t.is_active ? '#1a1a2e' : '#9ca3af' }}>{t.name}</div>
                <div style={{ fontSize: '0.68rem', color: style.color, marginTop: '2px' }}>{t.team_type}{!t.is_active ? ' · موقوف' : ''}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* تفاصيل التكوين */}
      {!selected ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
          اختر فريقاً من القائمة أو أنشئ فريقاً جديداً
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{selected.name}</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text3)', marginTop: '4px' }}>{selected.description || 'بدون وصف'}</p>
              </div>
              {canEdit && (
                <button onClick={() => { setEditTeam(selected); setShowTeamModal(true) }} className="btn btn-ghost">
                  <Pencil style={{ width: '14px', height: '14px' }} /> تعديل البيانات
                </button>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>👥 أعضاء الفريق ({teamMembers.length})</span>
              {canEdit && (
                <button onClick={() => setShowMemberModal(true)} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>
                  <UserPlus style={{ width: '14px', height: '14px' }} /> إضافة موظف
                </button>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  {['الاسم', 'المسمى', 'الدور', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamMembers.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)' }}>أضف المشرف والموظفين</td></tr>
                ) : teamMembers.map((m: TeamMember) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{m.employee?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: '0.82rem' }}>{m.employee?.job_title || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '2px 10px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600,
                        background: m.role_in_team === 'قائد' ? '#eff6ff' : '#f3f4f6',
                        color: m.role_in_team === 'قائد' ? '#1a56db' : '#4b5563',
                      }}>
                        {m.role_in_team}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'left' }}>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {m.role_in_team !== 'قائد' && (
                            <>
                              <button onClick={() => setLead(m.employee_id)} style={{ fontSize: '0.68rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}>
                                تعيين مشرف
                              </button>
                              <button onClick={() => removeMember(m.id)} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#c81e1e' }}>
                                <Trash2 style={{ width: '14px', height: '14px' }} />
                              </button>
                            </>
                          )}
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

      {showTeamModal && (
        <TeamModal
          team={editTeam}
          employees={employees}
          branchId={data.branchId}
          tenantId={tenantId}
          onClose={() => { setShowTeamModal(false); setEditTeam(null) }}
          onSave={async () => {
            setShowTeamModal(false)
            setEditTeam(null)
            await reload()
          }}
        />
      )}

      {showMemberModal && selected && (
        <MemberModal
          teamId={selected.id}
          tenantId={tenantId}
          employees={employees}
          existingIds={new Set(teamMembers.map(m => m.employee_id))}
          onClose={() => setShowMemberModal(false)}
          onSave={async () => {
            setShowMemberModal(false)
            await reload()
          }}
        />
      )}
    </div>
  )
}
