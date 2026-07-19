'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { fetchProjectPlanning, ensureProjectPlanning, closeProjectPlanning, fetchCostItems } from '@/lib/project-planning-service'
import { computePlanningProgress, type PlanningProgress } from '@/lib/planning-progress'
import PlanningProgressBadge from '@/components/projects/PlanningProgressBadge'
import { ArrowRight, ClipboardList, Archive } from 'lucide-react'
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

export default function ProjectPlanningLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const { tenant } = useStore()
  const projectId = Number(params.projectId)

  const [project, setProject] = useState<ProjectPlanningDetail | null>(null)
  const [planning, setPlanning] = useState<ProjectPlanning | null>(null)
  const [progress, setProgress] = useState<PlanningProgress | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!tenant || !projectId) return
    let result = await fetchProjectPlanning(tenant.id, projectId)
    if (!result.planning) {
      await ensureProjectPlanning(tenant.id, projectId, {
        start_date: result.project?.start_date,
        end_date: result.project?.end_date,
      })
      result = await fetchProjectPlanning(tenant.id, projectId)
    }
    setProject(result.project as ProjectPlanningDetail)
    setPlanning(result.planning)
    const { data: costItems } = await fetchCostItems(tenant.id, projectId)
    setProgress(computePlanningProgress(result.planning, costItems.length))
  }, [tenant?.id, projectId])

  useEffect(() => {
    if (!tenant || !projectId) return
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [tenant?.id, projectId, reload])

  const base = `/projects/planning/${projectId}`
  const activeSlug = PROJECT_TABS.find(t => pathname?.startsWith(`${base}/${t.slug}`))?.slug

  async function handleClosePlanning() {
    if (!tenant || !confirm('إغلاق التخطيط ونقل المشروع إلى مرحلة التنفيذ؟')) return
    await closeProjectPlanning(tenant.id, projectId)
    router.push('/projects/execution')
  }

  if (loading || !project || !tenant) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0ea77b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <ProjectPlanningContext.Provider value={{ tenantId: tenant.id, projectId, project, planning, reload }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/projects/planning/active')} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem' }}>
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
          {planning?.planning_status === 'active' && (
            <button onClick={handleClosePlanning} className="btn btn-ghost" style={{ marginRight: 'auto', fontSize: '0.78rem', color: '#6b7280', border: '1px solid #d1d5db' }}>
              <Archive style={{ width: '14px', height: '14px' }} /> إغلاق التخطيط والانتقال للتنفيذ
            </button>
          )}
        </div>

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
