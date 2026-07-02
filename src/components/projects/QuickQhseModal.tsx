'use client'
/**
 * QuickQhseModal — يفتح مودال زيارة السلامة أو الجودة أو البيئة
 * مباشرةً من أي مكان (مثلاً من صفحة المشاريع) دون الانتقال لصفحة QHSE.
 * يجلب المهندسين والمشاريع داخلياً بـ lazy loading.
 */
import { useState, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'

// تحميل مودالات QHSE بشكل كسول
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
  projectId?: number   // يُعبَّأ تلقائياً في المودال
  onClose:   () => void
  onSave?:   () => void
}

export default function QuickQhseModal({ type, projectId, onClose, onSave }: Props) {
  const { tenant, activeBranch } = useStore()
  const [projects,  setProjects]  = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!tenant) return
    Promise.all([
      supabase.from('projects')
        .select('id, name')
        .eq('tenant_id', tenant.id)
        .order('name'),
      supabase.from('hr_employees')
        .select('id, name, job_title')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name'),
    ]).then(([pRes, eRes]) => {
      setProjects(pRes.data  || [])
      setEmployees(eRes.data || [])
      setLoading(false)
    })
  }, [tenant?.id])

  // Spinner بسيط أثناء الجلب
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
    onClose,
    onSave: () => { onSave?.(); onClose() },
  }

  // إذا مُرِّر projectId، أضف المشروع للقائمة إن لم يكن موجوداً
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
