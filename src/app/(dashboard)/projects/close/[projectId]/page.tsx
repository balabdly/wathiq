'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Archive, Undo2, CheckCircle2, Upload, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '@/hooks/useStore'
import {
  fetchCloseProject,
  updateProjectClosure,
  approveProjectClosure,
  reopenProjectToMeasure,
  uploadClosureFile,
  type CloseProjectDetail,
} from '@/lib/project-close-service'
import { formatMissingClosureDocs } from '@/lib/project-tasks'
import PlanningProgressBadge from '@/components/projects/PlanningProgressBadge'

const CHECKLIST = [
  { key: 'final_boq_confirmed' as const, label: 'اعتماد BOQ النهائي', emoji: '📐' },
  { key: 'client_handover_date' as const, label: 'تسليم العميل', emoji: '🤝', dateField: true },
  { key: 'as_built_drawings_confirmed' as const, label: 'مخططات As-Built', emoji: '📋' },
  { key: 'final_invoice_number' as const, label: 'مستخلص 50% النهائي', emoji: '🧾', billingOnly: 'SPLIT_50_50' as const },
]

export default function CloseProjectPage() {
  const params = useParams()
  const router = useRouter()
  const { tenant, currentUser } = useStore()
  const projectId = Number(params.projectId)

  const canEdit = !!(currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit'))

  const [project, setProject] = useState<CloseProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [reopening, setReopening] = useState(false)

  const [handoverDate, setHandoverDate] = useState('')
  const [handoverNotes, setHandoverNotes] = useState('')
  const [finalNumber, setFinalNumber] = useState('')
  const [finalDate, setFinalDate] = useState('')
  const [finalAmount, setFinalAmount] = useState('')
  const [lessons, setLessons] = useState('')
  const [notes, setNotes] = useState('')

  const reload = useCallback(async () => {
    if (!tenant) return
    const { project: p } = await fetchCloseProject(tenant.id, projectId)
    setProject(p)
    const c = p.closure
    setHandoverDate(c?.client_handover_date || '')
    setHandoverNotes(c?.client_handover_notes || '')
    setFinalNumber(c?.final_invoice_number || '')
    setFinalDate(c?.final_invoice_date || '')
    setFinalAmount(c?.final_invoice_amount != null ? String(c.final_invoice_amount) : '')
    setLessons(c?.lessons_learned || '')
    setNotes(c?.closure_notes || '')
  }, [tenant?.id, projectId])

  useEffect(() => {
    if (!tenant || !projectId) return
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [tenant?.id, projectId, reload])

  async function toggleFlag(field: 'final_boq_confirmed' | 'as_built_drawings_confirmed', value: boolean) {
    if (!tenant || !canEdit) return
    setSaving(true)
    try {
      await updateProjectClosure(tenant.id, projectId, { [field]: value })
      toast.success('تم الحفظ')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
    }
    setSaving(false)
  }

  async function handleSave() {
    if (!tenant || !canEdit) return
    setSaving(true)
    try {
      await updateProjectClosure(tenant.id, projectId, {
        client_handover_date: handoverDate || null,
        client_handover_notes: handoverNotes.trim() || null,
        final_invoice_number: finalNumber.trim() || null,
        final_invoice_date: finalDate || null,
        final_invoice_amount: finalAmount ? Number(finalAmount) : null,
        lessons_learned: lessons.trim() || null,
        closure_notes: notes.trim() || null,
      })
      toast.success('تم الحفظ')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
    }
    setSaving(false)
  }

  async function handleUploadFinal(file: File) {
    if (!tenant || !canEdit) return
    setSaving(true)
    try {
      const { path, name } = await uploadClosureFile(tenant.id, projectId, file, 'final')
      await updateProjectClosure(tenant.id, projectId, {
        final_invoice_file_path: path,
        final_invoice_file_name: name,
      })
      toast.success('تم رفع الملف')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الرفع')
    }
    setSaving(false)
  }

  async function handleApproveClosure() {
    if (!tenant) return
    if (!confirm('اعتماد إغلاق المشروع وتغيير حالته إلى «مكتمل»؟')) return
    setClosing(true)
    try {
      await approveProjectClosure(tenant.id, projectId)
      toast.success('تم إغلاق المشروع ✅')
      router.push('/projects/monitoring')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الإغلاق')
    }
    setClosing(false)
  }

  async function handleReopenMeasure() {
    if (!tenant) return
    if (!confirm('إرجاع المشروع إلى مرحلة المقايسة؟')) return
    setReopening(true)
    try {
      await reopenProjectToMeasure(tenant.id, projectId)
      toast.success('تم الإرجاع')
      router.push('/projects/measure')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الإرجاع')
    }
    setReopening(false)
  }

  if (loading || !project) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0ea77b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  const closure = project.closure
  const billing = project.billing_model || 'SPLIT_50_50'
  const readOnly = closure?.closure_status === 'closed'
  const blockers = project.blockers

  function isCheckDone(key: typeof CHECKLIST[number]['key']): boolean {
    if (key === 'final_boq_confirmed') return !!closure?.final_boq_confirmed
    if (key === 'client_handover_date') return !!closure?.client_handover_date
    if (key === 'as_built_drawings_confirmed') return !!closure?.as_built_drawings_confirmed
    if (key === 'final_invoice_number') return billing === 'FULL_100' || !!closure?.final_invoice_number?.trim()
    return false
  }

  const hasBlockers = (blockers?.openTasks || 0) > 0 || (blockers?.openNcr || 0) > 0 || (blockers?.missingDocs?.length || 0) > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/projects/close')} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem' }}>
          <ArrowRight style={{ width: '14px', height: '14px' }} /> العودة
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Archive style={{ width: '18px', height: '18px', color: '#0ea77b' }} />
            {project.code ? `${project.code} — ` : ''}{project.name}
          </h2>
          {project.client_name && (
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text3)' }}>{project.client_name}</p>
          )}
        </div>
        {project.closureProgress && <PlanningProgressBadge progress={project.closureProgress} />}
        {canEdit && !readOnly && (
          <>
            <button onClick={handleReopenMeasure} disabled={reopening} className="btn btn-ghost" style={{ fontSize: '0.78rem', color: '#7c3aed', border: '1px solid #c4b5fd' }}>
              <Undo2 style={{ width: '14px', height: '14px' }} />
              {reopening ? 'جاري...' : 'إرجاع للمقايسة'}
            </button>
            <button
              onClick={handleApproveClosure}
              disabled={closing || !project.closureProgress?.isComplete || hasBlockers}
              className="btn btn-primary"
              style={{ fontSize: '0.78rem', background: project.closureProgress?.isComplete && !hasBlockers ? '#0ea77b' : '#9ca3af' }}
            >
              <CheckCircle2 style={{ width: '14px', height: '14px' }} />
              {closing ? 'جاري الإغلاق...' : 'اعتماد الإغلاق'}
            </button>
          </>
        )}
      </div>

      {hasBlockers && (
        <div className="card" style={{ padding: '16px 20px', background: '#fef2f2', border: '1px solid #fecaca' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#c81e1e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle style={{ width: '16px', height: '16px' }} /> موانع الإغلاق
          </div>
          <ul style={{ margin: 0, paddingRight: '18px', fontSize: '0.82rem', color: '#991b1b' }}>
            {(blockers?.missingDocs?.length || 0) > 0 && (
              <li>مرفقات ناقصة: {formatMissingClosureDocs(blockers!.missingDocs)} —{' '}
                <Link href="/projects/monitoring" style={{ color: '#1a56db' }}>لوحة المتابعة</Link>
              </li>
            )}
            {(blockers?.openTasks || 0) > 0 && (
              <li>{blockers!.openTasks} مهمة مفتوحة —{' '}
                <Link href="/projects/tasks" style={{ color: '#1a56db' }}>المهام</Link>
              </li>
            )}
            {(blockers?.openNcr || 0) > 0 && (
              <li>{blockers!.openNcr} زيارة NCR مفتوحة —{' '}
                <Link href="/visits" style={{ color: '#1a56db' }}>الزيارات</Link>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '16px' }}>🏁 قائمة الإغلاق والتسليم</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {CHECKLIST.filter(item => !item.billingOnly || item.billingOnly === billing).map(item => {
            const done = isCheckDone(item.key)
            const isToggle = !item.dateField && item.key !== 'final_invoice_number'
            return (
              <div key={item.key} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                borderRadius: '10px', background: done ? '#ecfdf5' : '#f9fafb', border: `1px solid ${done ? '#86efac' : '#e5e7eb'}`,
              }}>
                <span style={{ fontSize: '1.1rem' }}>{item.emoji}</span>
                <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}>{item.label}</span>
                {isToggle && canEdit && !readOnly ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                    <input
                      type="checkbox"
                      checked={!!closure?.[item.key as 'final_boq_confirmed']}
                      disabled={saving}
                      onChange={e => toggleFlag(item.key as 'final_boq_confirmed', e.target.checked)}
                    />
                    {done ? '✓' : 'تأكيد'}
                  </label>
                ) : (
                  <span style={{ fontSize: '0.78rem', color: done ? '#0ea77b' : '#9ca3af', fontWeight: 700 }}>{done ? '✓ مكتمل' : '—'}</span>
                )}
              </div>
            )
          })}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
            borderRadius: '10px', background: !hasBlockers ? '#ecfdf5' : '#f9fafb', border: `1px solid ${!hasBlockers ? '#86efac' : '#e5e7eb'}`,
          }}>
            <span style={{ fontSize: '1.1rem' }}>🔒</span>
            <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}>بوابات: مهام + NCR + مرفقات</span>
            <span style={{ fontSize: '0.78rem', color: !hasBlockers ? '#0ea77b' : '#c81e1e', fontWeight: 700 }}>
              {!hasBlockers ? '✓ مكتمل' : '⛔ محظور'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '12px' }}>🤝 تسليم العميل</div>
          <input type="date" value={handoverDate} onChange={e => setHandoverDate(e.target.value)} disabled={!canEdit || readOnly} className="input" dir="ltr" style={{ marginBottom: '8px' }} />
          <textarea value={handoverNotes} onChange={e => setHandoverNotes(e.target.value)} disabled={!canEdit || readOnly} className="input" placeholder="محضر التسليم..." style={{ minHeight: '70px' }} />
        </div>

        {billing === 'SPLIT_50_50' && (
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '12px' }}>🧾 مستخلص 50% النهائي</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input value={finalNumber} onChange={e => setFinalNumber(e.target.value)} disabled={!canEdit || readOnly} className="input" placeholder="رقم المستخلص" />
              <input type="date" value={finalDate} onChange={e => setFinalDate(e.target.value)} disabled={!canEdit || readOnly} className="input" dir="ltr" />
              <input type="number" value={finalAmount} onChange={e => setFinalAmount(e.target.value)} disabled={!canEdit || readOnly} className="input" placeholder="المبلغ" dir="ltr" />
              {canEdit && !readOnly && (
                <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#0ea77b' }}>
                  <Upload style={{ width: '14px', height: '14px' }} /> رفع ملف المستخلص
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFinal(f) }} />
                </label>
              )}
              {closure?.final_invoice_file_name && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>📎 {closure.final_invoice_file_name}</span>
              )}
            </div>
          </div>
        )}

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '12px' }}>📚 الدروس المستفادة</div>
          <textarea value={lessons} onChange={e => setLessons(e.target.value)} disabled={!canEdit || readOnly} className="input" placeholder="ملخص الدروس..." style={{ minHeight: '80px', marginBottom: '8px' }} />
          <textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={!canEdit || readOnly} className="input" placeholder="ملاحظات الإغلاق..." style={{ minHeight: '60px' }} />
        </div>
      </div>

      {canEdit && !readOnly && (
        <div>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#0ea77b', fontSize: '0.82rem' }}>
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      )}
    </div>
  )
}
