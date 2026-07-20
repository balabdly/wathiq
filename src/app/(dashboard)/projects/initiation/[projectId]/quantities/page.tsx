'use client'
import { useParams, useRouter } from 'next/navigation'
import { ArrowRight, ClipboardList } from 'lucide-react'
import { useInitiation } from '../../InitiationContext'
import ProjectQuantitiesEditor from '@/components/projects/ProjectQuantitiesEditor'
import ProjectPhaseBadge from '@/components/projects/ProjectPhaseBadge'

export default function ProjectQuantitiesPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = Number(params.projectId)
  const { projects, frameworkItems, reloadKpis } = useInitiation()
  const project = projects.find(p => p.id === projectId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => router.back()} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem' }}>
          <ArrowRight style={{ width: '14px', height: '14px' }} /> العودة
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            كميات المشروع — {project?.code ? `${project.code} — ` : ''}{project?.name || `#${projectId}`}
          </h2>
          {project?.client_name && (
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text3)' }}>{project.client_name}</p>
          )}
        </div>
        {project && <ProjectPhaseBadge phase={project.pmo_phase} />}
      </div>

      <div className="card" style={{ padding: '16px' }}>
        <ProjectQuantitiesEditor
          projectId={projectId}
          frameworkItems={frameworkItems}
          onSaved={reloadKpis}
        />
      </div>
    </div>
  )
}
