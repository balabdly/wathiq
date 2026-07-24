'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowRight, ClipboardList, ArrowLeftCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { completeProjectInitiation } from '@/lib/project-initiation-service'
import { useInitiation } from '../../InitiationContext'
import ProjectQuantitiesEditor from '@/components/projects/ProjectQuantitiesEditor'

export default function ProjectQuantitiesPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = Number(params.projectId)
  const { projects, frameworkItems, reloadShared, reloadKpis, tenantId } = useInitiation()
  const project = projects.find(p => p.id === projectId)
  const [sending, setSending] = useState(false)

  const ready = !!project?.client_id

  async function handleSendToPlanning() {
    if (!tenantId || !project) return
    if (!confirm(`إنهاء مرحلة البدء ونقل «${project.name}» إلى التخطيط؟`)) return
    setSending(true)
    try {
      await completeProjectInitiation(tenantId, projectId, project)
      toast.success('تم نقل المشروع إلى مرحلة التخطيط')
      await reloadShared()
      await reloadKpis()
      router.push('/projects/planning')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل النقل')
    }
    setSending(false)
  }

  async function handleSaved() {
    await reloadShared()
    await reloadKpis()
  }

  if (!project) {
    return (
      <div className="card" style={{ padding: '24px', color: 'var(--text3)' }}>
        المشروع غير موجود في سلة البدء — ربما انتقل إلى مرحلة أخرى.
        <button onClick={() => router.push('/projects/initiation/projects')} className="btn btn-ghost" style={{ marginTop: '12px' }}>
          العودة للقائمة
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/projects/initiation/projects')} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem' }}>
          <ArrowRight style={{ width: '14px', height: '14px' }} /> العودة
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            كميات المشروع — {project.code ? `${project.code} — ` : ''}{project.name}
          </h2>
          {project.client_name && (
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text3)' }}>{project.client_name}</p>
          )}
        </div>
        <button
          onClick={handleSendToPlanning}
          disabled={!ready || sending}
          className="btn btn-primary"
          style={{ fontSize: '0.82rem', opacity: !ready ? 0.6 : 1 }}
          title={ready ? 'إنهاء البدء وإرسال للتخطيط' : 'حدّد العميل أولاً'}
        >
          <ArrowLeftCircle style={{ width: '16px', height: '16px' }} />
          {sending ? 'جاري النقل...' : 'إرسال للتخطيط'}
        </button>
      </div>

      <div className="card" style={{ padding: '16px', marginBottom: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '0.82rem', color: '#1a56db' }}>
        المقايسة أصبحت في <strong>مرحلة التخطيط</strong> (تبويب المقايسة). يمكنك حفظ مسودة هنا أو الانتقال مباشرة للتخطيط.
      </div>

      <div className="card" style={{ padding: '16px' }}>
        <ProjectQuantitiesEditor
          projectId={projectId}
          frameworkItems={frameworkItems}
          onSaved={handleSaved}
        />
      </div>
    </div>
  )
}
