'use client'
/**
 * QuickQhseModal — يفتح مودال زيارة السلامة أو الجودة أو البيئة
 * مباشرةً من أي مكان (مثلاً من صفحة المشاريع) دون الانتقال لصفحة QHSE.
 */
import { useState, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { fetchAssigneeOptions } from '@/lib/project-teams'
import dynamic from 'next/dynamic'

const InspectionVisitModal  = dynamic(() => import('@/app/(dashboard)/qhse/safety/InspectionVisitModal'),  { ssr: false })
const SafetyObservationModal= dynamic(() => import('@/app/(dashboard)/qhse/safety/SafetyObservationModal'),{ ssr: false })
const QualityInspectionModal= dynamic(() => import('@/app/(dashboard)/qhse/quality/QualityInspectionModal'),{ ssr: false })
const QualityObservationModal=dynamic(() => import('@/app/(dashboard)/qhse/quality/QualityObservationModal'),{ ssr: false })
const EnvInspectionModal    = dynamic(() => import('@/app/(dashboard)/qhse/environment/EnvInspectionModal'),{ ssr: false })

export type QhseVisitType =
  | 'safety_inspection'
  | 'safety_observation'
  | 'quality_inspection'
  | 'quality_observation'
  | 'env_inspection'

interface Props {
  type:      QhseVisitType
  projectId?: number
  onClose:   () => void
  onSave?:   () => void
}

export default function QuickQhseModal({ type, projectId, onClose, onSave }: Props) {
  const { tenant } = useStore()
  const [projects,        setProjects]        = useState<{ id: number; name: string }[]>([])
  const [employees,       setEmployees]       = useState<{ id: number; name: string; job_title?: string }[]>([])
  const [defaultEngineer, setDefaultEngineer] = useState<string | undefined>()
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    if (!tenant) return
    async function load() {
      const pQuery = supabase.from('projects')
        .select('id, name, team_id, engineer')
        .eq('tenant_id', tenant!.id)
        .order('name')

      const { data: projData } = await pQuery
      setProjects(projData || [])

      if (projectId) {
        const proj = (projData || []).find(p => p.id === projectId)
        if (proj) {
          const members = await fetchAssigneeOptions(supabase, tenant!.id, proj.team_id)
          setEmployees(members.map(m => ({ id: m.id, name: m.name, job_title: m.job_title })))
          const lead = members.find(m => m.role_in_team === 'قائد')
          setDefaultEngineer(proj.engineer || lead?.name)
        } else {
          const { data: single } = await supabase.from('projects')
            .select('team_id, engineer').eq('id', projectId).single()
          const members = await fetchAssigneeOptions(supabase, tenant!.id, single?.team_id)
          setEmployees(members.map(m => ({ id: m.id, name: m.name, job_title: m.job_title })))
          setDefaultEngineer(single?.engineer || members.find(m => m.role_in_team === 'قائد')?.name)
        }
      } else {
        const { data: allEmp } = await supabase.from('hr_employees')
          .select('id, name, job_title').eq('tenant_id', tenant!.id).eq('is_active', true).order('name')
        setEmployees(allEmp || [])
      }
      setLoading(false)
    }
    load()
  }, [tenant?.id, projectId])

  if (loading) return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 400, padding: 40, textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--bg2)', borderTopColor: '#1a56db',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: '0.85rem', color: 'var(--text3)' }}>جاري التحميل...</div>
        <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  const shared = {
    projects,
    employees,
    defaultEngineer,
    onClose,
    onSave: () => { onSave?.(); onClose() },
  }

  const projectsWithCurrent = projectId && !projects.find(p => p.id === projectId)
    ? [{ id: projectId, name: `مشروع #${projectId}` }, ...projects]
    : projects

  const sharedWithProject = { ...shared, projects: projectsWithCurrent }

  switch (type) {
    case 'safety_inspection':
      return <InspectionVisitModal   {...sharedWithProject} defaultProjectId={projectId} />
    case 'safety_observation':
      return <SafetyObservationModal {...sharedWithProject} defaultProjectId={projectId} />
    case 'quality_inspection':
      return <QualityInspectionModal {...sharedWithProject} defaultProjectId={projectId} />
    case 'quality_observation':
      return <QualityObservationModal {...sharedWithProject} defaultProjectId={projectId} />
    case 'env_inspection':
      return <EnvInspectionModal onClose={onClose} onSave={() => { onSave?.(); onClose() }} />
    default:
      return null
  }
}
