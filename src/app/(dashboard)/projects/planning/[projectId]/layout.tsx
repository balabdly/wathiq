'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { fetchProjectPlanning, ensureProjectPlanning, closeProjectPlanning, fetchCostItems } from '@/lib/project-planning-service'
import { reopenProjectToInitiation } from '@/lib/project-initiation-service'
import { computePlanningProgress, type PlanningProgress } from '@/lib/planning-progress'
import PlanningProgressBadge from '@/components/projects/PlanningProgressBadge'
import { ArrowRight, ClipboardList, Archive, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { ProjectPlanningContext, type ProjectPlanningDetail } from './ProjectPlanningContext'
import type { ProjectPlanning } from '@/lib/project-planning-service'

const PROJECT_TABS = [
  { slug: 'materials', label: 'استلام المواد',       emoji: '📦', color: '#6366f1' },
  { slug: 'permit',    label: 'تصريح البلدية',       emoji: '🏛️', color: '#1a56db' },
  { slug: 'timeline',  label: 'الخطة الزمنية',       emoji: '📅', color: '#7c3aed' },
  { slug: 'safe-work', label: 'إجراءات العمل الآمنة', emoji: '🦺', color: '#e6820a' },
  { slug: 'risks',     label: 'تقييم المخاطر',       emoji: '⚠️', color: '#c81e1e' },
  { slug: 'quality',   label: 'خطط الجودة',          emoji: '✅', color: '#0ea77b' },
  { slug: 'costs',     label: 'خطة التكاليف',        emoji: '💰', color: '#0891b2' },
]

const POST_PLANNING_PHASES = new Set(['3_EXEC', '4_MEASURE', '5_CLOSE'])

export default function ProjectPlanningLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const { tenant, currentUser } = useStore()
  const projectId = Number(params.projectId)
  const canEdit = !!(currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit'))
  const [returning, setReturning] = useState(false)

  const [project, setProject] = useState<ProjectPlanningDetail | null>(null)
  const [planning, setPlanning] = useState<ProjectPlanning | null>(null)
  const [progress, setProgress] = useState<PlanningProgress | null>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!tenant || !projectId) return
    const result = await fetchProjectPlanning(tenant.id, projectId)
    const phase = result.project?.pmo_phase
    const isPostPlanning = !!phase && POST_PLANNING_PHASES.has(phase)

    if (phase === '1_RECEIPT') {
      router.replace('/projects/initiation/projects')
      return
    }
    if (isPostPlanning && result.planning?.planning_status !== 'closed') {
      router.replace('/projects/execution')
      return
    }
    if (!isPostPlanning && phase !== '2_PREP') {
      router.replace('/projects/planning')
      return
    }
    if (!result.planning && phase === '2_PREP') {
      await ensureProjectPlanning(tenant.id, projectId, {
        start_date: result.project?.start_date,
        end_date: result.project?.end_date,
      })
      const refreshed = await fetchProjectPlanning(tenant.id, projectId)
      result.project = refreshed.project
      result.planning = refreshed.planning
    }

    const viewOnly = result.planning?.planning_status === 'closed' || isPostPlanning
    setReadOnly(viewOnly)
    setProject(result.project as ProjectPlanningDetail)
    setPlanning(result.planning)
    const { data: costItems } = await fetchCostItems(tenant.id, projectId)
    setProgress(computePlanningProgress(
      result.planning,
      (costItems || []).some(i => Number(i.planned_amount) > 0) ? 1 : 0,
    ))
  }, [tenant?.id, projectId, router])

  useEffect(() => {
    if (!tenant || !projectId) return
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [tenant?.id, projectId, reload])

  const base = `/projects/planning/${projectId}`
  const activeSlug = PROJECT_TABS.find(t => pathname?.startsWith(`${base}/${t.slug}`))?.slug

  async function handleClosePlanning() {
    if (!tenant || !progress?.isComplete) {
      toast.error('أكمل جميع أقسام التخطيط قبل الاعتماد')
      return
    }
    if (!confirm('اعتماد التخطيط ونقل المشروع إلى سلة التنفيذ؟')) return
    try {
      await closeProjectPlanning(tenant.id, projectId)
      toast.success('تم اعتماد التخطيط')
      router.push('/projects/execution')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الاعتماد')
    }
  }

  async function handleReturnToInitiation() {
    if (!tenant || !project) return
    const msg = [
      `إرجاع «${project.name}» إلى مرحلة البدء؟`,
      '',
      '• لتصحيح بيانات المشروع أو الكميات',
      '• خطط التخطيط تبقى محفوظة',
    ].join('\n')
    if (!confirm(msg)) return
    setReturning(true)
    try {
      await reopenProjectToInitiation(tenant.id, projectId)
      toast.success('تم إرجاع المشروع إلى مرحلة البدء')
      router.push('/projects/initiation/projects')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الإرجاع')
    }
    setReturning(false)
  }

  if (loading || !project || !tenant) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0ea77b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <ProjectPlanningContext.Provider value={{ tenantId: tenant.id, projectId, project, planning, reload, readOnly }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push(readOnly ? '/projects/execution' : '/projects/planning')}
            className="btn btn-ghost"
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
          >
            <ArrowRight style={{ width: '14px', height: '14px' }} /> العودة
          </button>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardList style={{ width: '18px', height: '18px', color: '#0ea77b' }} />
              {project.code ? `${project.code} — ` : ''}{project.name}
            </h2>
            {project.client_name && (
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text3)' }}>{project.client_name}</p>
            )}
          </div>
          {progress && (
            <div style={{ minWidth: '140px' }}>
              <PlanningProgressBadge progress={progress} />
            </div>
          )}
          {!readOnly && planning?.planning_status === 'active' && progress?.isComplete && (
            <button onClick={handleClosePlanning} className="btn btn-primary" style={{ marginRight: 'auto', fontSize: '0.82rem' }}>
              <Archive style={{ width: '14px', height: '14px' }} /> اعتماد التخطيط والانتقال للتنفيذ
            </button>
          )}
          {!readOnly && canEdit && planning?.planning_status === 'active' && (
            <button
              onClick={handleReturnToInitiation}
              disabled={returning}
              className="btn btn-ghost"
              style={{ fontSize: '0.78rem', color: '#1a56db', border: '1px solid #bfdbfe', marginRight: !progress?.isComplete ? 'auto' : undefined }}
              title="إرجاع لمرحلة البدء"
            >
              <Undo2 style={{ width: '14px', height: '14px' }} />
              {returning ? 'جاري الإرجاع...' : 'إرجاع للبدء'}
            </button>
          )}
          {!readOnly && planning?.planning_status === 'active' && progress && !progress.isComplete && (
            <span style={{ marginRight: 'auto', fontSize: '0.78rem', color: '#e6820a', fontWeight: 600 }}>
              أكمل {progress.completed}/{progress.total} أقسام للاعتماد
            </span>
          )}
        </div>

        {readOnly && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '0.8rem', color: '#1a56db' }}>
            عرض للقراءة فقط — التخطيط معتمد والمشروع في مرحلة التنفيذ
          </div>
        )}

        <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', flexWrap: 'wrap' }}>
          {PROJECT_TABS.map(t => {
            const href = `${base}/${t.slug}`
            const active = activeSlug === t.slug
            return (
              <Link key={t.slug} href={href} style={{
                padding: '8px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600,
                textDecoration: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
                background: active ? t.color : 'transparent',
                color: active ? 'white' : 'var(--text3)',
                boxShadow: active ? `0 2px 8px ${t.color}44` : 'none',
              }}>
                {t.emoji} {t.label}
              </Link>
            )
          })}
        </div>

        {children}
      </div>
    </ProjectPlanningContext.Provider>
  )
}
