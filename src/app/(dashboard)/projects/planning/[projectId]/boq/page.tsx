'use client'
import { useEffect, useState } from 'react'
import { ClipboardList, Upload, FileText, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '@/hooks/useStore'
import { ensureDefaultSecContract, fetchFrameworkBoqItems } from '@/lib/sec-workflow-service'
import { DEFAULT_SEC_CONTRACT } from '@/lib/sec-workflow'
import { updateProjectPlanning, uploadPlanningFile } from '@/lib/project-planning-service'
import ProjectQuantitiesEditor from '@/components/projects/ProjectQuantitiesEditor'
import { useProjectPlanning } from '../ProjectPlanningContext'
import { supabase } from '@/lib/supabase'

type FrameworkBoqRow = {
  id: number
  item_code: string
  description_ar?: string
  unit: string
  unit_price: number
}

export default function PlanningBoqPage() {
  const { tenant } = useStore()
  const { tenantId, projectId, project, planning, reload, readOnly } = useProjectPlanning()
  const [frameworkItems, setFrameworkItems] = useState<FrameworkBoqRow[]>([])
  const [loadingFw, setLoadingFw] = useState(true)
  const [uploadingApproval, setUploadingApproval] = useState(false)

  const isRevision = planning?.planning_status === 'active'
    && (!!planning?.cost_plan_notes?.includes('[تعديل مقايسة]') || !!(planning?.boq_revision_snapshot as unknown[] | null)?.length)

  const revisionSnapshot = (planning?.boq_revision_snapshot || []) as import('@/lib/project-planning-service').BoqRevisionSnapshotLine[]

  useEffect(() => {
    if (!tenant) return
    setLoadingFw(true)
    ensureDefaultSecContract(tenant.id, DEFAULT_SEC_CONTRACT)
      .then(contractId => fetchFrameworkBoqItems(tenant.id, contractId))
      .then(({ data: items }) => {
        setFrameworkItems((items || []).map(i => ({
          id: i.id,
          item_code: i.item_code,
          description_ar: i.description_ar || i.description_en,
          unit: i.unit,
          unit_price: Number(i.unit_price),
        })))
      })
      .catch(() => setFrameworkItems([]))
      .finally(() => setLoadingFw(false))
  }, [tenant?.id])

  async function handleApprovalUpload(file: File) {
    if (!tenantId || readOnly) return
    setUploadingApproval(true)
    try {
      const { path, name } = await uploadPlanningFile(tenantId, projectId, file, 'boq_revision_approval')
      await updateProjectPlanning(tenantId, projectId, {
        boq_revision_approval_file_path: path,
        boq_revision_approval_file_name: name,
      })
      toast.success('تم رفع نموذج الموافقة ✅')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الرفع')
    }
    setUploadingApproval(false)
  }

  async function openApprovalFile() {
    if (!planning?.boq_revision_approval_file_path) return
    const { data } = await supabase.storage
      .from('project-attachments')
      .createSignedUrl(planning.boq_revision_approval_file_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (loadingFw) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)' }}>
        جاري تحميل بنود العقد الإطاري...
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '20px' }}>
      {isRevision && !readOnly && (
        <div style={{
          padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
          background: '#fffbeb', border: '1px solid #fcd34d', fontSize: '0.82rem', color: '#92400e',
        }}>
          <strong>تعديل مقايسة</strong> — الكمية السابقة ثابتة للمراجعة. عدّل عمود «الكمية المعدّلة» ثم أرفق موافقة SEC وأعد اعتماد التخطيط.
        </div>
      )}

      {isRevision && (
        <div className="card" style={{
          padding: '14px 16px', marginBottom: '16px',
          background: planning?.boq_revision_approval_file_path ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${planning?.boq_revision_approval_file_path ? '#86efac' : '#fecaca'}`,
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {planning?.boq_revision_approval_file_path
              ? <CheckCircle2 style={{ width: '16px', height: '16px', color: '#0ea77b' }} />
              : <FileText style={{ width: '16px', height: '16px', color: '#c81e1e' }} />}
            موافقة الكهرباء على تعديل المقايسة
            {!planning?.boq_revision_approval_file_path && !readOnly && (
              <span style={{ fontSize: '0.72rem', color: '#c81e1e', fontWeight: 600 }}>— مطلوب قبل الاعتماد</span>
            )}
          </div>
          {planning?.boq_revision_approval_file_name ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={openApprovalFile} className="btn btn-ghost" style={{ fontSize: '0.78rem', color: '#1a56db' }}>
                <FileText style={{ width: '14px', height: '14px' }} /> {planning.boq_revision_approval_file_name}
              </button>
              {!readOnly && (
                <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#6b7280' }}>
                  <Upload style={{ width: '14px', height: '14px' }} /> استبدال
                  <input type="file" accept=".pdf,.doc,.docx,image/*" style={{ display: 'none' }}
                    disabled={uploadingApproval}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleApprovalUpload(f) }} />
                </label>
              )}
            </div>
          ) : !readOnly ? (
            <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#1a56db', fontWeight: 600 }}>
              <Upload style={{ width: '16px', height: '16px' }} />
              {uploadingApproval ? 'جاري الرفع...' : 'رفع نموذج الموافقة (PDF / Word / صورة)'}
              <input type="file" accept=".pdf,.doc,.docx,image/*" style={{ display: 'none' }}
                disabled={uploadingApproval}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleApprovalUpload(f) }} />
            </label>
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>لم يُرفق بعد</span>
          )}
        </div>
      )}

      <div style={{ marginBottom: '14px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardList style={{ width: '18px', height: '18px', color: '#1a56db' }} />
          المقايسة — {project.name}
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text3)' }}>
          {isRevision
            ? 'قارن الكمية السابقة بالكمية المعدّلة — البنود المختلفة تظهر بخلفية برتقالية'
            : 'بنود الأعمال، الكميات، أسعار الوحدة، والإجمالي النهائي للمشروع'}
        </p>
      </div>

      <ProjectQuantitiesEditor
        projectId={projectId}
        frameworkItems={frameworkItems}
        readOnly={!!readOnly}
        isRevision={isRevision}
        revisionSnapshot={revisionSnapshot}
        title={isRevision ? 'تعديل المقايسة' : 'بنود المقايسة'}
        saveLabel={isRevision ? 'حفظ تعديل المقايسة' : 'حفظ المقايسة'}
        onSaved={() => reload()}
      />
    </div>
  )
}
