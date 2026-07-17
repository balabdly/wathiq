'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TEAM_TYPE_STYLE } from '@/lib/project-teams'
import type { TeamsPageData } from './types'
import {
  TaskModal, STATUS_STEPS, PRIORITY_COLOR,
  type ProjectTask, type TaskProject,
} from './taskShared'
import { Plus, Search, Pencil, Trash2, Eye, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function TeamTasksTab({ data }: { data: TeamsPageData }) {
  const { teams, projects, tenantId, canEdit } = data
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [loading, setLoading] = useState(true)
  const [teamFilter, setTeamFilter] = useState<number | ''>('')
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState<ProjectTask | null>(null)
  const [detailTask, setDetailTask] = useState<ProjectTask | null>(null)

  const activeTeams = useMemo(() => teams.filter(t => t.is_active), [teams])

  const teamProjects: TaskProject[] = useMemo(() => {
    let list = projects.filter(p => p.team_id)
    if (teamFilter) list = list.filter(p => p.team_id === teamFilter)
    return list.map(p => ({ id: p.id, name: p.name, code: p.code, team_id: p.team_id }))
  }, [projects, teamFilter])

  const projectIds = useMemo(() => teamProjects.map(p => p.id), [teamProjects])

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

  async function handleDelete(id: number) {
    if (!confirm('حذف هذه المهمة؟')) return
    await supabase.from('project_tasks').delete().eq('id', id)
    setTasks(t => t.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  const teamName = (tid?: number | null) => teams.find(t => t.id === tid)?.name || '—'

  const filtered = tasks.filter(t => {
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

  const defaultProjectId = teamProjects.length === 1 ? teamProjects[0].id : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text3)' }}>
          مهام مشاريع الفرق — إسناد من أعضاء الفريق
        </p>
        {canEdit && teamProjects.length > 0 && (
          <button onClick={() => { setEditTask(null); setShowModal(true) }} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
            <Plus style={{ width: '16px', height: '16px' }} /> مهمة جديدة
          </button>
        )}
      </div>

      {/* KPIs */}
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

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={teamFilter} onChange={e => { setTeamFilter(e.target.value ? Number(e.target.value) : ''); setFilterProject('') }} className="select" style={{ fontSize: '0.82rem', minWidth: '160px' }}>
          <option value="">كل الفرق</option>
          {activeTeams.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="select" style={{ fontSize: '0.82rem', minWidth: '140px' }}>
          <option value="">كل المشاريع</option>
          {teamProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
          <option value="">كل الحالات</option>
          {STATUS_STEPS.map(s => <option key={s.id}>{s.id}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
          <option value="">كل الأولويات</option>
          {['عالي', 'متوسط', 'منخفض'].map(p => <option key={p}>{p}</option>)}
        </select>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px', width: '180px', fontSize: '0.82rem' }} placeholder="بحث..." />
        </div>
      </div>

      {teamProjects.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
          لا مشاريع مسندة للفرق — اسند مشروعاً أولاً من تبويب «الفرق النشطة»
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
          لا مهام {teamFilter ? 'لهذا الفريق' : ''} — أنشئ مهمة جديدة
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
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
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '8px', background: tStyle.bg, color: tStyle.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {teamName(tid)}
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: '0.82rem', color: 'var(--text3)' }}>{task.project?.name}</td>
                    <td style={{ padding: '11px 12px', fontSize: '0.82rem' }}>{task.assignee || '—'}</td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{ background: p?.bg, color: p?.color, borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>{task.priority}</span>
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{ background: s?.bg, color: s?.color, borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>{task.status}</span>
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: '0.78rem', color: isOverdue ? '#c81e1e' : 'var(--text3)', fontWeight: isOverdue ? 700 : 400 }}>
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
          projects={teamProjects}
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
    </div>
  )
}
