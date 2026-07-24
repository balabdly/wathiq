'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, ClipboardList, FileText, HardHat, Image, Paperclip, Undo2, Send, Upload, Users, Flag } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '@/hooks/useStore'
import { reopenProjectPlanning } from '@/lib/project-planning-service'
import {
  fetchExecutionProject,
  fetchActiveTeams,
  assignExecutionTeam,
  fetchProjectDailyLogs,
  submitDailyLog,
  formatTodayLabel,
  type ExecutionProjectDetail,
} from '@/lib/project-execution-service'
import { advanceProjectToClose } from '@/lib/project-execution-service'
import { formatTeamTypeLabel, TEAM_TYPE_STYLE, type TeamProjectLog } from '@/lib/project-teams'
import { formatDate } from '@/lib/utils'
import PlanningProgressBadge from '@/components/projects/PlanningProgressBadge'

const PLAN_TABS = [
  { slug: 'boq', label: 'المقايسة', emoji: '📐' },
  { slug: 'materials', label: 'استلام المواد', emoji: '📦' },
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

  const reload = useCallback(async () => {
    if (!tenant) return
    const { project: p } = await fetchExecutionProject(tenant.id, projectId)
    setProject(p)
    setProgressPct(p?.progress ?? 0)
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

  async function handleAssignTeam(teamId: number | null) {
    if (!tenant || !project) return
    setAssigning(true)
    try {
      const team = teams.find(t => t.id === teamId)
      let leadName: string | null = null
      if (team?.lead_id) {
        const { supabase } = await import('@/lib/supabase')
        const { data: leadEmp } = await supabase.from('hr_employees').select('name').eq('id', team.lead_id).maybeSingle()
        leadName = leadEmp?.name || null
      }
      await assignExecutionTeam(
        tenant.id,
        projectId,
        teamId,
        leadName,
        team?.lead_id || null,
      )
      toast.success(teamId ? 'تم إسناد الفريق ✅' : 'تم إلغاء الإسناد')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الإسناد')
    }
    setAssigning(false)
  }

  async function handleSubmitLog() {
    if (!tenant || !project?.team_id) {
      toast.error('يجب إسناد فريق أولاً')
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
        {/* إسناد الفريق */}
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users style={{ width: '16px', height: '16px', color: '#1a56db' }} />
            إسناد الفريق
          </div>
          {canEdit ? (
            <select
              value={project.team_id || ''}
              disabled={assigning}
              onChange={e => handleAssignTeam(e.target.value ? Number(e.target.value) : null)}
              className="input"
              style={{ width: '100%', marginBottom: '8px' }}
            >
              <option value="">— اختر فريق —</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({formatTeamTypeLabel(t)})
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: '0.85rem' }}>{project.team?.name || 'غير مسند'}</div>
          )}
          {project.team && (
            <span style={{ display: 'inline-block', marginTop: '6px', padding: '4px 10px', borderRadius: '8px', background: teamStyle.bg, color: teamStyle.color, fontSize: '0.78rem', fontWeight: 600 }}>
              {formatTeamTypeLabel(project.team)}
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
              يجب إسناد فريق للمشروع قبل تسجيل الإنجاز اليومي
            </div>
          ) : (
            <>
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

function DailyLogEntry({ log }: { log: TeamProjectLog }) {
  const dateLabel = log.log_date ? formatDate(log.log_date) : formatDate(log.created_at)

  return (
    <div style={{ padding: '14px 16px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>📅 {dateLabel}</span>
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
