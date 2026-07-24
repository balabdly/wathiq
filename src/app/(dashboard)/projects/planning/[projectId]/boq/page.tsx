'use client'
import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { ensureDefaultSecContract, fetchFrameworkBoqItems } from '@/lib/sec-workflow-service'
import { DEFAULT_SEC_CONTRACT } from '@/lib/sec-workflow'
import ProjectQuantitiesEditor from '@/components/projects/ProjectQuantitiesEditor'
import { useProjectPlanning } from '../ProjectPlanningContext'

type FrameworkBoqRow = {
  id: number
  item_code: string
  description_ar?: string
  unit: string
  unit_price: number
}

export default function PlanningBoqPage() {
  const { tenant } = useStore()
  const { projectId, project, planning, reload, readOnly } = useProjectPlanning()
  const [frameworkItems, setFrameworkItems] = useState<FrameworkBoqRow[]>([])
  const [loadingFw, setLoadingFw] = useState(true)

  const isRevision = planning?.planning_status === 'active'
    && !!planning?.cost_plan_notes?.includes('[تعديل مقايسة]')

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
          <strong>تعديل مقايسة</strong> — عدّل البنود والكميات والأسعار ثم أعد اعتماد التخطيط للعودة للتنفيذ.
        </div>
      )}

      <div style={{ marginBottom: '14px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardList style={{ width: '18px', height: '18px', color: '#1a56db' }} />
          المقايسة — {project.name}
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text3)' }}>
          بنود الأعمال، الكميات، أسعار الوحدة، والإجمالي النهائي للمشروع
        </p>
      </div>

      <ProjectQuantitiesEditor
        projectId={projectId}
        frameworkItems={frameworkItems}
        readOnly={!!readOnly}
        isRevision={isRevision}
        title="بنود المقايسة"
        saveLabel={isRevision ? 'حفظ تعديل المقايسة' : 'حفظ المقايسة'}
        onSaved={() => reload()}
      />
    </div>
  )
}
