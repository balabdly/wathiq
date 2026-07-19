'use client'
import { useEffect, useState } from 'react'
import { Save, ShieldAlert, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProjectPlanning } from '../ProjectPlanningContext'
import { updateProjectPlanning } from '@/lib/project-planning-service'

export default function RisksTabPage() {
  const { tenantId, projectId, planning, reload } = useProjectPlanning()
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDone(planning?.risks_assessment_content === 'done')
  }, [planning?.risks_assessment_content, planning?.updated_at])

  async function handleSave() {
    setSaving(true)
    try {
      await updateProjectPlanning(tenantId, projectId, {
        risks_assessment_content: done ? 'done' : null,
      })
      await reload()
      toast.success('تم الحفظ ✅')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ في الحفظ')
    }
    setSaving(false)
  }

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldAlert style={{ width: '17px', height: '17px', color: '#c81e1e' }} /> تقييم المخاطر
      </h3>

      <label style={{
        display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
        padding: '14px 16px', background: done ? '#fef2f2' : 'var(--bg2)', borderRadius: '10px',
        border: `1px solid ${done ? '#fecaca' : 'var(--border)'}`,
      }}>
        <input type="checkbox" checked={done} onChange={e => setDone(e.target.checked)} style={{ width: '18px', height: '18px' }} />
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>تم تقييم مخاطر المشروع</span>
        {done && <CheckCircle2 style={{ width: '18px', height: '18px', color: '#c81e1e', marginRight: 'auto' }} />}
      </label>

      <p style={{ fontSize: '0.82rem', color: 'var(--text3)', marginTop: '12px', lineHeight: 1.6 }}>
        التقييم التفصيلي يُدار خارج النظام — هنا تأكيد فقط أن البند مكتمل في مرحلة التخطيط.
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#c81e1e' }}>
          <Save style={{ width: '14px', height: '14px' }} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
      </div>
    </div>
  )
}
