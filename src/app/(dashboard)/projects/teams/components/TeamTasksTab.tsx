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
import { NewAssignModal, AssignTeamToProjectModal } from './modals'
import { Plus, Search, Pencil, Trash2, Eye, X, FileText, Link2, UserMinus } from 'lucide-react'
import toast from 'react-hot-toast'

const iconBtn = (color: string, bg: string, border: string) => ({
  padding: '7px', borderRadius: '8px', border: `1px solid ${border}`,
  background: bg, cursor: 'pointer' as const, color, display: 'flex' as const, alignItems: 'center' as const, flexShrink: 0 as const,
})

export default function TeamTasksTab({ data }: { data: TeamsPageData }) {
  const { teams, projects, employees, tenantId, canEdit, reload } = data
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [loading, setLoading] = useState(true)
  const [teamFilter, setTeamFilter] = useState<number | ''>('')
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterAssignment, setFilterAssignment] = useState<'' | 'assigned' | 'unassigned'>('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState<ProjectTask | null>(null)
  const [detailTask, setDetailTask] = useState<ProjectTask | null>(null)
  const [logProject, setLogProject] = useState<ProjectRow | null>(null)
  const [showAssign, setShowAssign] = useState(false)
  const [quickAssignProject, setQuickAssignProject] = useState<ProjectRow | null>(null)

  const activeTeams = useMemo(() => teams.filter(t => t.is_active), [teams])
  const teamOptions = useMemo(
    () => activeTeams.map(t => ({ id: t.id, name: t.name, team_type: formatTeamTypeLabel(t) })),
    [activeTeams],
  )

  const unassignedProjects = useMemo(
    () => projects.filter(p => !p.team_id && p.status !== 'مكتمل' && p.status !== 'ملغي'),
    [projects],
  )

  const allProjects: TaskProject[] = useMemo(
    () => projects.map(p => ({ id: p.id, name: p.name, code: p.code, team_id: p.team_id })),
    [projects],
  )

  const visibleProjects = useMemo(() => {
    if (!teamFilter) return allProjects
    return allProjects.filter(p => p.team_id === teamFilter)
  }, [allProjects, teamFilter])

  const projectIds = useMemo(() => allProjects.map(p => p.id), [allProjects])
  const projectMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects])

  useEffect(() => { loadTasks() }, [tenantId, projectIds.join(',')])

  async function loadTasks() {
    if (!tenantId || projectIds.length === 0) {
      setTasks([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data: rows } = await supabase.from('project_tasks')
      .select('*, project:projects(name, code, team_id)')
      .eq('tenant_id', tenantId)
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
    setTasks(rows || [])
    setLoading(false)
  }

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

  const isTaskAssigned = (task: ProjectTask) => !!task.project?.team_id

  const filtered = tasks.filter(t => {
    const assigned = isTaskAssigned(t)
    if (filterAssignment === 'assigned' && !assigned) return false
    if (filterAssignment === 'unassigned' && assigned) return false
    if (teamFilter && t.project?.team_id !== teamFilter) return false
    if (filterProject && String(t.project_id) !== filterProject) return false
    if (filterStatus && t.status !== filterStatus) return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (search && !t.title.includes(search) && !(t.assignee || '').includes(search) && !(t.project?.name || '').includes(search)) return false
    return true
  })

  const today = new Date().toISOString().split('T')[0]
  const stats = {
    total:      filtered.length,
    assigned:   filtered.filter(isTaskAssigned).length,
    unassigned: filtered.filter(t => !isTaskAssigned(t)).length,
    done:       filtered.filter(t => t.status === 'مكتملة').length,
    inprog:     filtered.filter(t => t.status === 'قيد التنفيذ').length,
    overdue:    filtered.filter(t => t.due_date && t.due_date < today && t.status !== 'مكتملة' && t.status !== 'ملغاة').length,
  }

  const defaultProjectId = visibleProjects.length === 1 ? visibleProjects[0].id : undefined

  function openAssignForTask(task: ProjectTask) {
    const p = projectMap[task.project_id]
    if (p) setQuickAssignProject(p)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* رأس + أزرار */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>✅ مهام المشاريع</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text3)' }}>
            <span style={{ color: '#0ea77b', fontWeight: 600 }}>● مسندة</span>
            {' · '}
            <span style={{ color: '#c81e1e', fontWeight: 600 }}>● غير مسندة</span>
          </p>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowAssign(true)}
              disabled={unassignedProjects.length === 0 || activeTeams.length === 0}
              className="btn btn-ghost"
              style={{ fontSize: '0.82rem', border: '1px solid #bfdbfe', color: '#1a56db' }}
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

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' }}>
        {[
          { label: 'إجمالي', value: stats.total, color: '#1a56db', bg: '#eff6ff' },
          { label: 'مسندة', value: stats.assigned, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'غير مسندة', value: stats.unassigned, color: '#c81e1e', bg: '#fef2f2' },
          { label: 'قيد التنفيذ', value: stats.inprog, color: '#e6820a', bg: '#fffbeb' },
          { label: 'متأخرة', value: stats.overdue, color: '#7c3aed', bg: '#f5f3ff' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px', background: s.bg }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px', width: '180px', fontSize: '0.82rem' }} placeholder="بحث..." />
        </div>
        <select value={filterAssignment} onChange={e => setFilterAssignment(e.target.value as '' | 'assigned' | 'unassigned')} className="select" style={{ fontSize: '0.82rem' }}>
          <option value="">كل المهام</option>
          <option value="assigned">مسندة فقط</option>
          <option value="unassigned">غير مسندة فقط</option>
        </select>
        <select value={teamFilter} onChange={e => { setTeamFilter(e.target.value ? Number(e.target.value) : ''); setFilterProject('') }} className="select" style={{ fontSize: '0.82rem', minWidth: '140px' }}>
          <option value="">كل الفرق</option>
          {activeTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '130px' }}>
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
      </div>

      {/* قائمة المهام */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
          لا مهام مطابقة للفلاتر
          {canEdit && (
            <div style={{ marginTop: '12px' }}>
              <button onClick={() => setShowModal(true)} className="btn btn-primary">
                <Plus style={{ width: '16px', height: '16px' }} /> إضافة مهمة
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(task => {
              const assigned = isTaskAssigned(task)
              const p = PRIORITY_COLOR[task.priority]
              const s = STATUS_STEPS.find(x => x.id === task.status)
              const tid = task.project?.team_id
              const tStyle = TEAM_TYPE_STYLE[teams.find(t => t.id === tid)?.team_type || ''] || TEAM_TYPE_STYLE['ميداني']
              const isOverdue = task.due_date && task.due_date < today && task.status !== 'مكتملة'
              const proj = projectMap[task.project_id]

              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                    padding: '12px 14px', borderRadius: '10px', flexWrap: 'wrap',
                    background: assigned ? '#ecfdf5' : '#fef2f2',
                    border: assigned ? '1px solid #86efac' : '1px solid #fecaca',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                        background: assigned ? '#0ea77b' : '#c81e1e', color: 'white',
                      }}>
                        {assigned ? 'مسندة' : 'غير مسندة'}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{task.title}</span>
                      {task.category && <span style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>({task.category})</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>📁 {task.project?.name}</span>
                      {assigned && tid && (
                        <span style={{ padding: '1px 7px', borderRadius: '8px', background: tStyle.bg, color: tStyle.color, fontWeight: 600 }}>
                          {teamName(tid)}
                        </span>
                      )}
                      {task.assignee && <span>👤 {task.assignee}</span>}
                      <span style={{ background: p?.bg, color: p?.color, padding: '1px 6px', borderRadius: '5px', fontWeight: 600 }}>{task.priority}</span>
                      <span style={{ background: s?.bg, color: s?.color, padding: '1px 6px', borderRadius: '5px', fontWeight: 600 }}>{task.status}</span>
                      {task.due_date && (
                        <span style={{ color: isOverdue ? '#c81e1e' : 'inherit', fontWeight: isOverdue ? 700 : 400 }}>
                          📅 {task.due_date}{isOverdue ? ' ⚠️' : ''}
                        </span>
                      )}
                      <span>{task.progress}%</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    {assigned && proj && (
                      <button onClick={() => setLogProject(proj)} title="سجل اليوم" style={iconBtn('#1a56db', '#eff6ff', '#bfdbfe')}>
                        <FileText style={{ width: '15px', height: '15px' }} />
                      </button>
                    )}
                    {canEdit && !assigned && (
                      <button onClick={() => openAssignForTask(task)} title="إسناد للفريق" style={iconBtn('#0ea77b', '#ecfdf5', '#86efac')}>
                        <Link2 style={{ width: '15px', height: '15px' }} />
                      </button>
                    )}
                    {canEdit && assigned && proj && (
                      <button onClick={() => unassignProject(proj)} title="إلغاء الإسناد" style={iconBtn('#c81e1e', '#fef2f2', '#fecaca')}>
                        <UserMinus style={{ width: '15px', height: '15px' }} />
                      </button>
                    )}
                    <button onClick={() => setDetailTask(task)} title="تفاصيل" style={iconBtn('#1a56db', '#eff6ff', '#bfdbfe')}>
                      <Eye style={{ width: '15px', height: '15px' }} />
                    </button>
                    {canEdit && (
                      <>
                        <button onClick={() => { setEditTask(task); setShowModal(true) }} title="تعديل" style={iconBtn('#6b7280', '#f9fafb', '#e5e7eb')}>
                          <Pencil style={{ width: '15px', height: '15px' }} />
                        </button>
                        <button onClick={() => handleDelete(task.id)} title="حذف" style={iconBtn('#c81e1e', '#fef2f2', '#fecaca')}>
                          <Trash2 style={{ width: '15px', height: '15px' }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
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
                <span style={{
                  background: isTaskAssigned(detailTask) ? '#ecfdf5' : '#fef2f2',
                  color: isTaskAssigned(detailTask) ? '#0ea77b' : '#c81e1e',
                  padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
                }}>
                  {isTaskAssigned(detailTask) ? 'مسندة' : 'غير مسندة'}
                </span>
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
        <ProjectDetailsModal project={logProject} data={data} onClose={() => setLogProject(null)} />
      )}

      {showAssign && (
        <NewAssignModal
          unassigned={unassignedProjects}
          activeTeams={teamOptions}
          onClose={() => setShowAssign(false)}
          onAssign={(teamId, projectId) => assignProject(teamId, projectId)}
        />
      )}

      {quickAssignProject && (
        <AssignTeamToProjectModal
          project={quickAssignProject}
          activeTeams={teamOptions}
          onClose={() => setQuickAssignProject(null)}
          onAssign={teamId => assignProject(teamId, quickAssignProject.id)}
        />
      )}
    </div>
  )
}
