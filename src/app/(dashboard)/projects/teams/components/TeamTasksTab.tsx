'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatTeamTypeLabel, TEAM_TYPE_STYLE } from '@/lib/project-teams'
import type { TeamsPageData, ProjectRow } from './types'
import {
  TaskModal, STATUS_STEPS, PRIORITY_COLOR,
  type ProjectTask, type TaskProject,
} from './taskShared'
import ProjectDetailsModal from './ProjectDetailsModal'
import { NewAssignModal } from './modals'
import { Plus, Search, Pencil, Trash2, Eye, X, FileText, Link2, UserMinus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function TeamTasksTab({ data }: { data: TeamsPageData }) {
  const { teams, projects, employees, tenantId, canEdit, reload } = data
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [loading, setLoading] = useState(true)
  const [teamFilter, setTeamFilter] = useState<number | ''>('')
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'board'>('list')
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState<ProjectTask | null>(null)
  const [detailTask, setDetailTask] = useState<ProjectTask | null>(null)
  const [logProject, setLogProject] = useState<ProjectRow | null>(null)
  const [showAssign, setShowAssign] = useState(false)

  const activeTeams = useMemo(() => teams.filter(t => t.is_active), [teams])

  const unassigned = useMemo(
    () => projects.filter(p => !p.team_id && p.status !== 'مكتمل' && p.status !== 'ملغي'),
    [projects],
  )

  async function assignProject(teamId: number, projectId: number) {
    const team = teams.find(t => t.id === teamId)
    const lead = team?.lead_id ? employees.find(e => e.id === team.lead_id) : null
    const { error } = await supabase.from('projects').update({
      team_id: teamId,
      lead_id: team?.lead_id || null,
      engineer: lead?.name || undefined,
      updated_at: new Date().toISOString(),
    }).eq('id', projectId)
    if (error) { toast.error(error.message); return }
    toast.success('تم إسناد المشروع ✅')
    await reload()
    loadTasks()
  }

  async function unassignProject(p: ProjectRow) {
    if (!confirm(`إلغاء إسناد "${p.name}" من الفريق؟`)) return
    const { error } = await supabase.from('projects').update({
      team_id: null, updated_at: new Date().toISOString(),
    }).eq('id', p.id)
    if (error) { toast.error(error.message); return }
    toast.success('تم سحب الإسناد')
    await reload()
    loadTasks()
  }

  /** كل مشاريع الفرع — مثل الصفحة القديمة */
  const allProjects: TaskProject[] = useMemo(
    () => projects.map(p => ({ id: p.id, name: p.name, code: p.code, team_id: p.team_id })),
    [projects],
  )

  /** مشاريع معروضة في الفلاتر (اختياري: حسب الفريق) */
  const visibleProjects = useMemo(() => {
    if (!teamFilter) return allProjects
    return allProjects.filter(p => p.team_id === teamFilter)
  }, [allProjects, teamFilter])

  const projectIds = useMemo(() => allProjects.map(p => p.id), [allProjects])

  useEffect(() => { loadTasks() }, [tenantId, projectIds.join(',')])

  async function loadTasks() {
    if (!tenantId) {
      setTasks([])
      setLoading(false)
      return
    }
    setLoading(true)
    if (projectIds.length === 0) {
      setTasks([])
      setLoading(false)
      return
    }
    const { data: rows } = await supabase.from('project_tasks')
      .select('*, project:projects(name, code, team_id)')
      .eq('tenant_id', tenantId)
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
    setTasks(rows || [])
    setLoading(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذه المهمة؟')) return
    await supabase.from('project_tasks').delete().eq('id', id)
    setTasks(t => t.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  const teamName = (tid?: number | null) => {
    if (!tid) return '—'
    return teams.find(t => t.id === tid)?.name || '—'
  }

  const filtered = tasks.filter(t => {
    if (teamFilter && t.project?.team_id !== teamFilter) return false
    if (filterProject && String(t.project_id) !== filterProject) return false
    if (filterStatus && t.status !== filterStatus) return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (search && !t.title.includes(search) && !(t.assignee || '').includes(search) && !(t.project?.name || '').includes(search)) return false
    return true
  })

  const today = new Date().toISOString().split('T')[0]
  const stats = {
    total:   filtered.length,
    done:    filtered.filter(t => t.status === 'مكتملة').length,
    inprog:  filtered.filter(t => t.status === 'قيد التنفيذ').length,
    overdue: filtered.filter(t => t.due_date && t.due_date < today && t.status !== 'مكتملة' && t.status !== 'ملغاة').length,
    high:    filtered.filter(t => t.priority === 'عالي' && t.status !== 'مكتملة').length,
  }

  const assignedProjects = useMemo(() => {
    let list = projects.filter(p => p.team_id)
    if (teamFilter) list = list.filter(p => p.team_id === teamFilter)
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  }, [projects, teamFilter])

  const defaultProjectId = visibleProjects.length === 1 ? visibleProjects[0].id : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>✅ مهام المشاريع</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text3)' }}>
            كل مهام الفرع — فلتر اختياري حسب الفريق
          </p>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowAssign(true)}
              disabled={unassigned.length === 0 || activeTeams.length === 0}
              className="btn btn-ghost"
              style={{ fontSize: '0.82rem', border: '1px solid #bfdbfe', color: '#1a56db' }}
              title={unassigned.length === 0 ? 'لا مشاريع بانتظار الإسناد' : undefined}
            >
              <Link2 style={{ width: '16px', height: '16px' }} /> إسناد مشروع
            </button>
            {allProjects.length > 0 && (
              <button onClick={() => { setEditTask(null); setShowModal(true) }} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
                <Plus style={{ width: '16px', height: '16px' }} /> مهمة جديدة
              </button>
            )}
          </div>
        )}
      </div>

      {unassigned.length > 0 && (
        <div className="card" style={{ padding: '14px 18px', border: '1px solid #fde68a', background: '#fffbeb' }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#b45309', marginBottom: '8px' }}>
            ⚠️ {unassigned.length} مشروع بانتظار الإسناد — اسند من الزر أعلاه
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {unassigned.map(p => (
              <span key={p.id} style={{ fontSize: '0.75rem', padding: '3px 9px', borderRadius: '8px', background: 'white', border: '1px solid #fde68a', color: '#92400e' }}>
                {p.code || p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
        {[
          { label: 'إجمالي', value: stats.total, color: '#1a56db', bg: '#eff6ff' },
          { label: 'قيد التنفيذ', value: stats.inprog, color: '#e6820a', bg: '#fffbeb' },
          { label: 'مكتملة', value: stats.done, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'متأخرة', value: stats.overdue, color: '#c81e1e', bg: '#fef2f2' },
          { label: 'عالية الأولوية', value: stats.high, color: '#7c3aed', bg: '#f5f3ff' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px', background: s.bg }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* المشاريع المسندة + سجل اليوم */}
      {assignedProjects.length > 0 && (
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '10px', color: 'var(--text3)' }}>
            📁 المشاريع المسندة — سجل العمل اليومي
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {assignedProjects.map(p => {
              const team = teams.find(t => t.id === p.team_id)
              const tStyle = TEAM_TYPE_STYLE[team?.team_type || ''] || TEAM_TYPE_STYLE['ميداني']
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                      {p.code && <span>{p.code}</span>}
                      <span style={{ padding: '1px 7px', borderRadius: '8px', background: tStyle.bg, color: tStyle.color, fontWeight: 600 }}>
                        {teamName(p.team_id)}
                      </span>
                      <span>{p.progress ?? 0}%</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setLogProject(p)}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.78rem', color: '#1a56db', border: '1px solid #bfdbfe', background: '#eff6ff', flexShrink: 0 }}
                  >
                    <FileText style={{ width: '14px', height: '14px' }} /> سجل اليوم
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => unassignProject(p)}
                      title="سحب الإسناد"
                      style={{ padding: '7px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e', flexShrink: 0 }}
                    >
                      <UserMinus style={{ width: '14px', height: '14px' }} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px', width: '180px', fontSize: '0.82rem' }} placeholder="بحث..." />
        </div>
        <select value={teamFilter} onChange={e => { setTeamFilter(e.target.value ? Number(e.target.value) : ''); setFilterProject('') }} className="select" style={{ fontSize: '0.82rem', minWidth: '150px' }}>
          <option value="">كل الفرق</option>
          {activeTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '140px' }}>
          <option value="">كل المشاريع</option>
          {visibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
          <option value="">كل الحالات</option>
          {STATUS_STEPS.map(s => <option key={s.id}>{s.id}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
          <option value="">كل الأولويات</option>
          {['عالي', 'متوسط', 'منخفض'].map(p => <option key={p}>{p}</option>)}
        </select>
        <div style={{ marginRight: 'auto', display: 'flex', gap: '4px', background: '#e5e7eb', padding: '3px', borderRadius: '10px' }}>
          {([['list', '☰', 'قائمة'], ['board', '📋', 'كانبان']] as const).map(([v, icon, label]) => (
            <button key={v} onClick={() => setView(v)}
              style={{
                padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px',
                background: view === v ? 'white' : 'transparent',
                color: view === v ? '#1a56db' : 'var(--text3)',
                boxShadow: view === v ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              }}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✅</div>
          لا مهام {teamFilter ? 'لهذا الفريق' : ''}
          {canEdit && allProjects.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <button onClick={() => setShowModal(true)} className="btn btn-primary">
                <Plus style={{ width: '16px', height: '16px' }} /> إضافة مهمة
              </button>
            </div>
          )}
        </div>
      ) : view === 'board' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(200px, 1fr))', gap: '12px', overflowX: 'auto' }}>
          {STATUS_STEPS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.id)
            return (
              <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '8px 12px', borderRadius: '8px', background: col.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: col.color, fontWeight: 700, fontSize: '0.82rem' }}>
                    {col.icon} {col.id}
                  </div>
                  <span style={{ background: col.color, color: 'white', borderRadius: '12px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>{colTasks.length}</span>
                </div>
                {colTasks.map(task => {
                  const isOverdue = task.due_date && task.due_date < today && task.status !== 'مكتملة'
                  const p = PRIORITY_COLOR[task.priority]
                  return (
                    <div key={task.id} className="card" style={{ padding: '12px', border: isOverdue ? '1px solid #fca5a5' : undefined, cursor: 'pointer' }}
                      onClick={() => { setEditTask(task); setShowModal(true) }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.4, flex: 1 }}>{task.title}</span>
                        <span style={{ background: p.bg, color: p.color, borderRadius: '6px', padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700 }}>{task.priority}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '4px' }}>📁 {task.project?.name}</div>
                      {task.project?.team_id && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '4px' }}>👥 {teamName(task.project.team_id)}</div>
                      )}
                      {task.assignee && <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>👤 {task.assignee}</div>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['المهمة', 'الفريق', 'المشروع', 'المسؤول', 'الأولوية', 'الحالة', 'الاستحقاق', 'الإنجاز', ''].map(h => (
                  <th key={h} style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => {
                const isOverdue = task.due_date && task.due_date < today && task.status !== 'مكتملة'
                const p = PRIORITY_COLOR[task.priority]
                const s = STATUS_STEPS.find(x => x.id === task.status)
                const tid = task.project?.team_id
                const tStyle = TEAM_TYPE_STYLE[teams.find(t => t.id === tid)?.team_type || ''] || TEAM_TYPE_STYLE['ميداني']
                return (
                  <tr key={task.id} style={{ borderBottom: '1px solid var(--bg2)', background: isOverdue ? '#fff5f5' : 'transparent' }}>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{task.title}</div>
                      {task.category && <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{task.category}</div>}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      {tid ? (
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '8px', background: tStyle.bg, color: tStyle.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {teamName(tid)}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: '0.82rem', color: 'var(--text3)' }}>{task.project?.name}</td>
                    <td style={{ padding: '11px 12px', fontSize: '0.82rem' }}>{task.assignee || '—'}</td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{ background: p?.bg, color: p?.color, borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>{task.priority}</span>
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{ background: s?.bg, color: s?.color, borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {s?.icon} {task.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: isOverdue ? '#c81e1e' : 'var(--text3)', fontWeight: isOverdue ? 700 : 400 }}>
                      {task.due_date || '—'}
                    </td>
                    <td style={{ padding: '11px 12px', minWidth: '90px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ flex: 1, height: '5px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${task.progress}%`, background: task.status === 'مكتملة' ? '#0ea77b' : '#1a56db' }} />
                        </div>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>{task.progress}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => setDetailTask(task)} title="تفاصيل" style={{ padding: '5px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db' }}>
                          <Eye style={{ width: '13px', height: '13px' }} />
                        </button>
                        {canEdit && (
                          <>
                            <button onClick={() => { setEditTask(task); setShowModal(true) }} style={{ padding: '5px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}>
                              <Pencil style={{ width: '13px', height: '13px' }} />
                            </button>
                            <button onClick={() => handleDelete(task.id)} style={{ padding: '5px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e' }}>
                              <Trash2 style={{ width: '13px', height: '13px' }} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <TaskModal
          task={editTask}
          projects={allProjects}
          tenantId={tenantId}
          defaultProjectId={defaultProjectId}
          onClose={() => { setShowModal(false); setEditTask(null) }}
          onSave={() => { setShowModal(false); setEditTask(null); loadTasks() }}
        />
      )}

      {detailTask && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setDetailTask(null)}>
          <div className="modal-box" style={{ maxWidth: '520px' }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, margin: 0 }}>{detailTask.title}</h3>
              <button onClick={() => setDetailTask(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ background: STATUS_STEPS.find(s => s.id === detailTask.status)?.bg, color: STATUS_STEPS.find(s => s.id === detailTask.status)?.color, padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>{detailTask.status}</span>
                <span style={{ background: PRIORITY_COLOR[detailTask.priority]?.bg, color: PRIORITY_COLOR[detailTask.priority]?.color, padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>{detailTask.priority}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'الفريق', value: teamName(detailTask.project?.team_id) },
                  { label: 'المشروع', value: detailTask.project?.name || '—' },
                  { label: 'المسؤول', value: detailTask.assignee || '—' },
                  { label: 'الاستحقاق', value: detailTask.due_date || '—' },
                ].map(r => (
                  <div key={r.label} style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{r.label}</div>
                    <div style={{ fontWeight: 600 }}>{r.value}</div>
                  </div>
                ))}
              </div>
              {detailTask.description && <p style={{ lineHeight: 1.6, margin: 0 }}>{detailTask.description}</p>}
            </div>
            <div className="modal-footer">
              <button onClick={() => setDetailTask(null)} className="btn btn-ghost">إغلاق</button>
              {canEdit && (
                <button onClick={() => { setEditTask(detailTask); setDetailTask(null); setShowModal(true) }} className="btn btn-primary">
                  <Pencil style={{ width: '14px', height: '14px' }} /> تعديل
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {logProject && (
        <ProjectDetailsModal
          project={logProject}
          data={data}
          onClose={() => setLogProject(null)}
        />
      )}

      {showAssign && (
        <NewAssignModal
          unassigned={unassigned}
          activeTeams={activeTeams.map(t => ({ id: t.id, name: t.name, team_type: formatTeamTypeLabel(t) }))}
          onClose={() => setShowAssign(false)}
          onAssign={(teamId, projectId) => assignProject(teamId, projectId)}
        />
      )}
    </div>
  )
}
