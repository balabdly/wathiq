'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, ClipboardList, FileText, HardHat, Image, Paperclip, Undo2, Send, Upload, Users, Flag, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '@/hooks/useStore'
import { reopenProjectPlanning } from '@/lib/project-planning-service'
import {
  fetchExecutionProject,
  fetchActiveTeams,
  assignExecutionTeam,
  addTeamToSequence,
  handoffExecutionTeam,
  clearProjectTeamSequence,
  removePendingTeamAssignment,
  fetchProjectDailyLogs,
  submitDailyLog,
  formatTodayLabel,
  type ExecutionProjectDetail,
} from '@/lib/project-execution-service'
import { advanceProjectToClose } from '@/lib/project-execution-service'
import {
  formatTeamTypeLabel,
  TEAM_TYPE_STYLE,
  ASSIGNMENT_STATUS_LABEL,
  ASSIGNMENT_STATUS_STYLE,
  type TeamProjectLog,
  type ProjectTeamAssignment,
} from '@/lib/project-teams'
import { formatDate } from '@/lib/utils'
import PlanningProgressBadge from '@/components/projects/PlanningProgressBadge'

const PLAN_TABS = [
  { slug: 'boq', label: 'المقايسة', emoji: '📐' },
  { slug: 'permit', label: 'تصريح البلدية', emoji: '🏛️' },
  { slug: 'timeline', label: 'الخطة الزمنية', emoji: '📅' },
  { slug: 'safe-work', label: 'العمل الآمن', emoji: '🦺' },
  { slug: 'risks', label: 'المخاطر', emoji: '⚠️' },
  { slug: 'quality', label: 'الجودة', emoji: '✅' },
  { slug: 'costs', label: 'التكاليف', emoji: '💰' },
]

export default function ExecutionProjectPage() {
  const params = useParams()
  const router = useRouter()
  const { tenant, activeBranch, currentUser } = useStore()
  const projectId = Number(params.projectId)

  const canEdit = !!(currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit'))

  const [project, setProject] = useState<ExecutionProjectDetail | null>(null)
  const [teams, setTeams] = useState<Awaited<ReturnType<typeof fetchActiveTeams>>>([])
  const [logs, setLogs] = useState<TeamProjectLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [notes, setNotes] = useState('')
  const [progressPct, setProgressPct] = useState(0)
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('')
  const [handoffNotes, setHandoffNotes] = useState('')
  const [handingOff, setHandingOff] = useState(false)

  const assignments = project?.teamAssignments || []
  const activeAssignment = assignments.find(a => a.status === 'active')
  const nextPending = assignments.find(a => a.status === 'pending')
  const completedCount = assignments.filter(a => a.status === 'completed').length

  const reload = useCallback(async () => {
    if (!tenant) return
    const { project: p } = await fetchExecutionProject(tenant.id, projectId)
    setProject(p)
    setProgressPct(p?.progress ?? 0)
    setSelectedTeamId('')
    if (activeBranch) {
      const t = await fetchActiveTeams(tenant.id, activeBranch.id)
      setTeams(t)
    }
  }, [tenant?.id, projectId, activeBranch?.id])

  const reloadLogs = useCallback(async () => {
    if (!tenant) return
    setLoadingLogs(true)
    const data = await fetchProjectDailyLogs(tenant.id, projectId)
    setLogs(data)
    setLoadingLogs(false)
  }, [tenant?.id, projectId])

  useEffect(() => {
    if (!tenant || !projectId) return
    setLoading(true)
    Promise.all([reload(), reloadLogs()]).finally(() => setLoading(false))
  }, [tenant?.id, projectId, reload, reloadLogs])

  async function handleAddToSequence() {
    if (!tenant || !project) return
    const teamId = selectedTeamId ? Number(selectedTeamId) : null
    if (!teamId) {
      toast.error('اختر فريقاً أولاً')
      return
    }
    setAssigning(true)
    try {
      if (!project?.teamAssignments?.length) {
        await assignExecutionTeam(tenant.id, projectId, teamId)
      } else {
        await addTeamToSequence(tenant.id, projectId, teamId)
      }
      toast.success(project?.teamAssignments?.length ? 'تمت إضافة الفريق للتسلسل ✅' : 'تم اعتماد الفريق الأول ✅')
      setSelectedTeamId('')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الإضافة')
    }
    setAssigning(false)
  }

  async function handleHandoff() {
    if (!tenant || !project) return
    if (!nextPending) {
      toast.error('أضف الفريق التالي في التسلسل أولاً')
      return
    }
    const msg = [
      `تسليم المشروع من «${activeAssignment?.team?.name || 'الفريق الحالي'}» إلى «${nextPending.team?.name}»؟`,
      '',
      '• يُغلق سجل الفريق الحالي',
      '• يبدأ الفريق التالي بتسجيل الإنجاز اليومي',
    ].join('\n')
    if (!confirm(msg)) return
    setHandingOff(true)
    try {
      await handoffExecutionTeam(tenant.id, projectId, {
        handoffNotes: handoffNotes,
        progressAtHandoff: project.progress ?? 0,
      })
      toast.success('تم التسليم للفريق التالي ✅')
      setHandoffNotes('')
      await reload()
      await reloadLogs()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل التسليم')
    }
    setHandingOff(false)
  }

  async function handleRemovePending(assignment: ProjectTeamAssignment) {
    if (!tenant) return
    if (!confirm(`حذف «${assignment.team?.name}» من قائمة الانتظار؟`)) return
    setAssigning(true)
    try {
      await removePendingTeamAssignment(tenant.id, assignment.id)
      toast.success('تم الحذف')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الحذف')
    }
    setAssigning(false)
  }

  async function handleClearTeam() {
    if (!tenant || !project) return
    if (!confirm('إلغاء تسلسل الفرق بالكامل؟ (سجل الإنجاز يبقى محفوظاً)')) return
    setAssigning(true)
    try {
      await clearProjectTeamSequence(tenant.id, projectId)
      toast.success('تم إلغاء التسلسل')
      setSelectedTeamId('')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الإلغاء')
    }
    setAssigning(false)
  }

  const teamIdsInSequence = new Set(assignments.map(a => a.team_id))
  const availableTeams = teams.filter(t => !teamIdsInSequence.has(t.id))
  const hasApprovedTeam = !!project?.team_id

  async function handleSubmitLog() {
    if (!tenant || !project?.team_id) {
      toast.error('يجب اعتماد الفريق أولاً')
      return
    }
    if (!notes.trim() && files.length === 0) {
      toast.error('اكتب ملاحظة أو أرفق ملفاً')
      return
    }
    if (Number.isNaN(progressPct) || progressPct < 0 || progressPct > 100) {
      toast.error('أدخل نسبة إنجاز بين 0 و 100')
      return
    }
    setSaving(true)
    try {
      await submitDailyLog(
        tenant.id,
        projectId,
        project.team_id,
        currentUser?.name || 'مستخدم',
        currentUser?.hr_employee_id,
        notes,
        files,
        progressPct,
      )
      toast.success('تم تسجيل إنجاز اليوم ✅')
      setNotes('')
      setFiles([])
      await reload()
      await reloadLogs()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'فشل الحفظ'
      toast.error(msg.includes('progress_percent') ? 'خطأ في قاعدة البيانات — تواصل مع الدعم لتطبيق التحديث' : msg)
    }
    setSaving(false)
  }

  async function handleAdvanceToClose() {
    if (!tenant) return
    if ((project?.progress ?? 0) < 100) {
      toast.error('يجب أن تصل نسبة الإنجاز إلى 100% أولاً')
      return
    }
    if (!confirm('المقايسة مطابقة للتنفيذ — نقل المشروع إلى مرحلة الإغلاق؟')) return
    setAdvancing(true)
    try {
      await advanceProjectToClose(tenant.id, projectId)
      toast.success('تم نقل المشروع إلى الإغلاق')
      router.push('/projects/close')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل النقل')
    }
    setAdvancing(false)
  }

  async function handleReopenPlanning() {
    if (!tenant) return
    const reason = prompt('سبب تعديل المقايسة (اختياري):') ?? ''
    const msg = [
      'إرجاع المشروع إلى التخطيط لتعديل المقايسة؟',
      '',
      '• يبقى إسناد الفريق وسجل الإنجاز محفوظاً',
      '• عدّل البنود في تبويب المقايسة ثم أعد اعتماد التخطيط',
    ].join('\n')
    if (!confirm(msg)) return
    setReopening(true)
    try {
      await reopenProjectPlanning(tenant.id, projectId, { preserveTeam: true, reason: reason || undefined })
      toast.success('تم إرجاع المشروع للتخطيط — عدّل المقايسة')
      router.push(`/projects/planning/${projectId}/boq`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الإرجاع')
    }
    setReopening(false)
  }

  if (loading || !project) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#e6820a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  const teamStyle = TEAM_TYPE_STYLE[project.team?.team_type || ''] || TEAM_TYPE_STYLE['مختلط']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* رأس المشروع */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/projects/execution')} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem' }}>
          <ArrowRight style={{ width: '14px', height: '14px' }} /> العودة
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardHat style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            {project.code ? `${project.code} — ` : ''}{project.name}
          </h2>
          {project.client_name && (
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text3)' }}>{project.client_name}</p>
          )}
        </div>
        {project.planningProgress && (
          <PlanningProgressBadge progress={project.planningProgress} />
        )}
        {canEdit && project.pmo_phase === '3_EXEC' && (
          <>
            {(project.progress ?? 0) >= 100 && (
              <button
                onClick={handleAdvanceToClose}
                disabled={advancing}
                className="btn btn-primary"
                style={{ fontSize: '0.78rem', background: '#059669', marginRight: 'auto' }}
                title="المقايسة مطابقة — الانتقال للإغلاق"
              >
                <Flag style={{ width: '14px', height: '14px' }} />
                {advancing ? 'جاري النقل...' : '→ الإغلاق'}
              </button>
            )}
            <button
              onClick={handleReopenPlanning}
              disabled={reopening}
              className="btn btn-ghost"
              style={{ fontSize: '0.78rem', color: '#1a56db', border: '1px solid #bfdbfe' }}
              title="تعديل المقايسة — إرجاع للتخطيط"
            >
              <Undo2 style={{ width: '14px', height: '14px' }} />
              {reopening ? 'جاري الإرجاع...' : 'تعديل المقايسة'}
            </button>
          </>
        )}
      </div>

      {/* نسبة الإنجاز */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>📊 نسبة الإنجاز التراكمية</span>
          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#e6820a' }}>{project.progress ?? 0}%</span>
        </div>
        <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${project.progress ?? 0}%`, background: '#e6820a', borderRadius: '8px', transition: 'width 0.3s' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* تسلسل فرق التنفيذ */}
        <div className="card" style={{ padding: '16px 20px', gridColumn: assignments.length ? '1 / -1' : undefined }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <Users style={{ width: '16px', height: '16px', color: '#1a56db' }} />
            تسلسل فرق التنفيذ
            {assignments.length > 1 && (
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '6px', background: '#f5f3ff', color: '#7c3aed', fontWeight: 700 }}>
                {completedCount + 1} / {assignments.length}
              </span>
            )}
            {hasApprovedTeam && (
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#0ea77b', fontWeight: 700 }}>
                ✓ فريق نشط
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text3)', margin: '0 0 12px', lineHeight: 1.5 }}>
            مثال: الفريق الميداني (تمديد كابلات وخرسانات) ← ثم الفريق الكهربائي (توصيل وربط الشبكة)
          </p>

          {assignments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {assignments.map((a, idx) => {
                const st = ASSIGNMENT_STATUS_STYLE[a.status]
                const typeSt = TEAM_TYPE_STYLE[a.team?.team_type || ''] || TEAM_TYPE_STYLE['مختلط']
                return (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                    padding: '10px 12px', borderRadius: '10px',
                    border: `1px solid ${a.status === 'active' ? '#bfdbfe' : '#e5e7eb'}`,
                    background: a.status === 'active' ? '#eff6ff' : '#fafafa',
                  }}>
                    <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#9ca3af', minWidth: '24px' }}>{idx + 1}</span>
                    {idx < assignments.length - 1 && a.status === 'completed' && (
                      <ArrowLeft style={{ width: '14px', height: '14px', color: '#9ca3af', transform: 'rotate(180deg)' }} />
                    )}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{a.team?.name || `فريق #${a.team_id}`}</div>
                      {a.team && (
                        <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '6px', background: typeSt.bg, color: typeSt.color, fontWeight: 600 }}>
                          {formatTeamTypeLabel(a.team)}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: st.bg, color: st.color, fontWeight: 700 }}>
                      {ASSIGNMENT_STATUS_LABEL[a.status]}
                    </span>
                    {a.status === 'completed' && a.completed_at && (
                      <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{formatDate(a.completed_at.slice(0, 10))}</span>
                    )}
                    {canEdit && a.status === 'pending' && (
                      <button type="button" onClick={() => handleRemovePending(a)} disabled={assigning}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e', padding: '4px' }}>
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {canEdit ? (
            <>
              <select
                value={selectedTeamId}
                disabled={assigning || !availableTeams.length}
                onChange={e => setSelectedTeamId(e.target.value ? Number(e.target.value) : '')}
                className="input"
                style={{ width: '100%', marginBottom: '8px' }}
              >
                <option value="">— {assignments.length ? 'اختر فريقاً للتسلسل' : 'اختر الفريق الأول'} —</option>
                {availableTeams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({formatTeamTypeLabel(t)})
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleAddToSequence}
                  disabled={assigning || !selectedTeamId}
                  className="btn btn-primary"
                  style={{ fontSize: '0.78rem', flex: 1, opacity: !selectedTeamId ? 0.55 : 1 }}
                >
                  <Plus style={{ width: '14px', height: '14px' }} />
                  {assigning ? 'جاري...' : assignments.length ? 'إضافة للتسلسل' : 'اعتماد الفريق الأول'}
                </button>
                {assignments.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearTeam}
                    disabled={assigning}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.78rem', color: '#c81e1e', border: '1px solid #fecaca' }}
                  >
                    إلغاء التسلسل
                  </button>
                )}
              </div>

              {activeAssignment && nextPending && (
                <div style={{ marginTop: '14px', padding: '12px', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fcd34d' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#92400e', marginBottom: '8px' }}>
                    تسليم للفريق التالي: {nextPending.team?.name}
                  </div>
                  <input
                    value={handoffNotes}
                    onChange={e => setHandoffNotes(e.target.value)}
                    className="input"
                    placeholder="ملاحظة التسليم (اختياري) — ما أنجزه الفريق الحالي..."
                    style={{ marginBottom: '8px', fontSize: '0.82rem' }}
                  />
                  <button
                    type="button"
                    onClick={handleHandoff}
                    disabled={handingOff}
                    className="btn btn-primary"
                    style={{ fontSize: '0.78rem', background: '#e6820a', width: '100%' }}
                  >
                    <ArrowLeft style={{ width: '14px', height: '14px' }} />
                    {handingOff ? 'جاري التسليم...' : `تسليم من ${activeAssignment.team?.name} → ${nextPending.team?.name}`}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '0.85rem' }}>{project.team?.name || 'غير مسند'}</div>
          )}
          {project.team && (
            <span style={{ display: 'inline-block', marginTop: '8px', padding: '4px 10px', borderRadius: '8px', background: teamStyle.bg, color: teamStyle.color, fontSize: '0.78rem', fontWeight: 600 }}>
              الفريق النشط: {formatTeamTypeLabel(project.team)}
            </span>
          )}
          {teams.length === 0 && canEdit && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '8px' }}>
              لا فرق نشطة — <Link href="/projects/teams" style={{ color: '#1a56db' }}>إنشاء فريق</Link>
            </p>
          )}
        </div>

        {/* خطط التخطيط */}
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ClipboardList style={{ width: '16px', height: '16px', color: '#0ea77b' }} />
            خطط التخطيط
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {PLAN_TABS.map(t => (
              <Link
                key={t.slug}
                href={`/projects/planning/${projectId}/${t.slug}`}
                target="_blank"
                style={{
                  padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
                  textDecoration: 'none', background: '#f3f4f6', color: '#374151',
                  border: '1px solid #e5e7eb', transition: 'background 0.15s',
                }}
              >
                {t.emoji} {t.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* الإنجاز اليومي */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px' }}>
          📜 سجل الإنجاز اليومي ({logs.length})
        </div>

        {/* السجل — الأقدم أعلى */}
        {loadingLogs ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: '0.82rem' }}>جاري التحميل...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text3)', fontSize: '0.82rem', background: '#f9fafb', borderRadius: '10px', marginBottom: '16px' }}>
            لا تحديثات مسجلة بعد — ابدأ بتسجيل إنجاز اليوم أدناه
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {logs.map(log => (
              <DailyLogEntry key={log.id} log={log} />
            ))}
          </div>
        )}

        {/* إدخال اليوم — في الأسفل */}
        <div style={{ padding: '16px', borderRadius: '12px', background: '#fffbeb', border: '2px solid #fcd34d' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '4px' }}>
            📝 إنجاز اليوم
          </div>
          <div style={{ fontSize: '0.75rem', color: '#92400e', marginBottom: '12px' }}>
            {formatTodayLabel()}
          </div>
          {!project.team_id ? (
            <div style={{ fontSize: '0.82rem', color: '#c81e1e', padding: '12px', background: '#fef2f2', borderRadius: '8px' }}>
              يجب اعتماد فريق (أو تسليم للفريق التالي) قبل تسجيل الإنجاز اليومي
            </div>
          ) : (
            <>
              {activeAssignment && (
                <div style={{ fontSize: '0.75rem', color: '#1a56db', marginBottom: '10px', fontWeight: 600 }}>
                  تسجيل إنجاز: {activeAssignment.team?.name} ({formatTeamTypeLabel(activeAssignment.team || { team_type: '' })})
                </div>
              )}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>
                  نسبة الإنجاز التراكمية (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progressPct}
                  onChange={e => setProgressPct(Number(e.target.value))}
                  className="input"
                  style={{ width: '120px', fontWeight: 700 }}
                  dir="ltr"
                />
                <span style={{ fontSize: '0.72rem', color: '#92400e', marginRight: '8px' }}>
                  حدّدها حسب ما تم إنجازه حتى اليوم
                </span>
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="input"
                placeholder="ما تم إنجازه اليوم، المعوقات، الملاحظات..."
                style={{ minHeight: '80px', resize: 'vertical', marginBottom: '10px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#e6820a', fontWeight: 600 }}>
                  <Upload style={{ width: '16px', height: '16px' }} />
                  إرفاق صور/ملفات
                  <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }}
                    onChange={e => setFiles(Array.from(e.target.files || []))} />
                </label>
                {files.length > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{files.length} ملف</span>
                )}
                <button onClick={handleSubmitLog} disabled={saving} className="btn btn-primary" style={{ marginRight: 'auto', fontSize: '0.82rem', background: '#e6820a' }}>
                  <Send style={{ width: '14px', height: '14px' }} /> {saving ? 'جاري الحفظ...' : 'تسجيل إنجاز اليوم'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DailyLogEntry({ log }: { log: TeamProjectLog & { team_name?: string; team_type?: string } }) {
  const dateLabel = log.log_date ? formatDate(log.log_date) : formatDate(log.created_at)

  return (
    <div style={{ padding: '14px 16px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>📅 {dateLabel}</span>
          {log.team_name && (
            <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '6px', background: '#eff6ff', color: '#1a56db', fontWeight: 600 }}>
              👥 {log.team_name}
            </span>
          )}
          {log.progress_percent != null && (
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#fffbeb', color: '#e6820a' }}>
              {Number(log.progress_percent)}%
            </span>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>👤 {log.author_name}</span>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>
          {new Date(log.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {log.notes && (
        <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: '#374151', margin: '0 0 8px' }}>{log.notes}</p>
      )}
      {(log.files || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {(log.files || []).map(f => (
            <a
              key={f.id}
              href={(f as { public_url?: string }).public_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '5px 9px', borderRadius: '7px', background: 'white',
                border: '1px solid #e5e7eb', fontSize: '0.72rem', color: '#1a56db', textDecoration: 'none',
              }}
            >
              {f.file_type?.startsWith('image/') ? <Image style={{ width: '12px', height: '12px' }} /> : f.file_type?.includes('pdf') ? <FileText style={{ width: '12px', height: '12px' }} /> : <Paperclip style={{ width: '12px', height: '12px' }} />}
              {f.file_name}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
