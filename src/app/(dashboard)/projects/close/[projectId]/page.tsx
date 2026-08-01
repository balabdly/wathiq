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
  reopenProjectToExecution,
  uploadClosureFile,
  type CloseProjectDetail,
  type ProjectClosure,
} from '@/lib/project-close-service'
import { formatMissingClosureDocs } from '@/lib/project-tasks'
import PlanningProgressBadge from '@/components/projects/PlanningProgressBadge'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

type DateField = 'assets_handover_date' | 'gis_mapping_date' | 'client_handover_date' | 'completion_certificate_date'

const PROCEDURE_ITEMS: {
  dateField: DateField
  label: string
  emoji: string
  requiresFile?: boolean
}[] = [
  { dateField: 'assets_handover_date', label: 'هل تم تسليم المشروع للأصول؟', emoji: '🏢' },
  { dateField: 'gis_mapping_date', label: 'هل تم رسم المشروع على خريطة GIS؟', emoji: '🗺️' },
  { dateField: 'client_handover_date', label: 'تسليم العميل (إجراء 155)', emoji: '🤝' },
  { dateField: 'completion_certificate_date', label: 'هل تم إصدار شهادة إنجاز؟ (إجراء 156)', emoji: '📜', requiresFile: true },
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

  const [partialNumber, setPartialNumber] = useState('')
  const [partialDate, setPartialDate] = useState('')
  const [partialAmount, setPartialAmount] = useState('')
  const [partialSkipped, setPartialSkipped] = useState(false)
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
    setPartialNumber(c?.partial_invoice_number || '')
    setPartialDate(c?.partial_invoice_date || '')
    setPartialAmount(c?.partial_invoice_amount != null ? String(c.partial_invoice_amount) : '')
    setPartialSkipped(!!c?.partial_invoice_skipped)
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

  async function patchClosure(patch: Partial<Omit<ProjectClosure, 'id' | 'tenant_id' | 'project_id'>>) {
    if (!tenant || !canEdit) return
    setSaving(true)
    try {
      await updateProjectClosure(tenant.id, projectId, patch)
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
    }
    setSaving(false)
  }

  async function toggleProcedure(dateField: DateField, checked: boolean, currentDate?: string | null) {
    await patchClosure({ [dateField]: checked ? (currentDate || todayStr()) : null })
    if (checked) toast.success('تم التسجيل')
  }

  async function updateProcedureDate(dateField: DateField, value: string) {
    await patchClosure({ [dateField]: value || null })
  }

  async function handleUploadCertificate(file: File) {
    if (!tenant || !canEdit) return
    setSaving(true)
    try {
      const { path, name } = await uploadClosureFile(tenant.id, projectId, file, 'certificate')
      await updateProjectClosure(tenant.id, projectId, {
        completion_certificate_file_path: path,
        completion_certificate_file_name: name,
        completion_certificate_date: project?.closure?.completion_certificate_date || todayStr(),
      })
      toast.success('تم رفع شهادة الإنجاز')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الرفع')
    }
    setSaving(false)
  }

  async function handleUploadInvoice(kind: 'partial' | 'final', file: File) {
    if (!tenant || !canEdit) return
    setSaving(true)
    try {
      const { path, name } = await uploadClosureFile(tenant.id, projectId, file, kind)
      const patch = kind === 'partial'
        ? { partial_invoice_file_path: path, partial_invoice_file_name: name }
        : { final_invoice_file_path: path, final_invoice_file_name: name }
      await updateProjectClosure(tenant.id, projectId, patch)
      toast.success('تم رفع الملف')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الرفع')
    }
    setSaving(false)
  }

  async function handleSaveInvoices() {
    if (!tenant || !canEdit) return
    setSaving(true)
    try {
      await updateProjectClosure(tenant.id, projectId, {
        partial_invoice_number: partialSkipped ? null : (partialNumber.trim() || null),
        partial_invoice_date: partialSkipped ? null : (partialDate || null),
        partial_invoice_amount: partialSkipped ? null : (partialAmount ? Number(partialAmount) : null),
        partial_invoice_skipped: partialSkipped,
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

  async function handleToggleSkipPartial(checked: boolean) {
    setPartialSkipped(checked)
    if (checked) {
      setPartialNumber('')
      setPartialDate('')
      setPartialAmount('')
    }
    await patchClosure({
      partial_invoice_skipped: checked,
      ...(checked ? {
        partial_invoice_number: null,
        partial_invoice_date: null,
        partial_invoice_amount: null,
        partial_invoice_file_path: null,
        partial_invoice_file_name: null,
      } : {}),
    })
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

  async function handleReopenExecution() {
    if (!tenant) return
    if (!confirm('إرجاع المشروع إلى مرحلة التنفيذ؟')) return
    setReopening(true)
    try {
      await reopenProjectToExecution(tenant.id, projectId)
      toast.success('تم الإرجاع')
      router.push('/projects/execution')
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
  const readOnly = closure?.closure_status === 'closed'
  const blockers = project.blockers
  const hasBlockers = (blockers?.openTasks || 0) > 0 || (blockers?.openNcr || 0) > 0 || (blockers?.missingDocs?.length || 0) > 0

  function procedureDone(item: typeof PROCEDURE_ITEMS[number]): boolean {
    const date = closure?.[item.dateField]
    if (!date) return false
    if (item.requiresFile) return !!closure?.completion_certificate_file_path
    return true
  }

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
            <button onClick={handleReopenExecution} disabled={reopening} className="btn btn-ghost" style={{ fontSize: '0.78rem', color: '#e6820a', border: '1px solid #fcd34d' }}>
              <Undo2 style={{ width: '14px', height: '14px' }} />
              {reopening ? 'جاري...' : 'إرجاع للتنفيذ'}
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
          {PROCEDURE_ITEMS.map(item => {
            const done = procedureDone(item)
            const dateVal = closure?.[item.dateField] || ''
            return (
              <div key={item.dateField} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', flexWrap: 'wrap',
                borderRadius: '10px', background: done ? '#ecfdf5' : '#f9fafb', border: `1px solid ${done ? '#86efac' : '#e5e7eb'}`,
              }}>
                <span style={{ fontSize: '1.1rem', marginTop: '2px' }}>{item.emoji}</span>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>{item.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {canEdit && !readOnly ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                        <input
                          type="checkbox"
                          checked={!!dateVal}
                          disabled={saving}
                          onChange={e => toggleProcedure(item.dateField, e.target.checked, dateVal)}
                        />
                        تم
                      </label>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: done ? '#0ea77b' : '#9ca3af', fontWeight: 700 }}>
                        {done ? '✓ مكتمل' : '—'}
                      </span>
                    )}
                    <input
                      type="date"
                      value={dateVal}
                      onChange={e => {
                        if (canEdit && !readOnly) updateProcedureDate(item.dateField, e.target.value)
                      }}
                      disabled={!canEdit || readOnly || saving}
                      className="input"
                      dir="ltr"
                      style={{ width: 'auto', minWidth: '150px', fontSize: '0.78rem', padding: '6px 10px' }}
                    />
                    {item.requiresFile && canEdit && !readOnly && (
                      <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#0ea77b' }}>
                        <Upload style={{ width: '14px', height: '14px' }} /> رفع الشهادة
                        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadCertificate(f) }} />
                      </label>
                    )}
                    {item.requiresFile && closure?.completion_certificate_file_name && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>📎 {closure.completion_certificate_file_name}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          <div style={{ borderTop: '2px solid #e5e7eb', margin: '8px 0' }} />

          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#374151', marginBottom: '4px' }}>🧾 المستخلصات</div>

          {!partialSkipped && (
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '10px' }}>المستخلص الجزئي</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                <input value={partialNumber} onChange={e => setPartialNumber(e.target.value)} disabled={!canEdit || readOnly} className="input" placeholder="رقم المستخلص" />
                <input type="date" value={partialDate} onChange={e => setPartialDate(e.target.value)} disabled={!canEdit || readOnly} className="input" dir="ltr" />
                <input type="number" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} disabled={!canEdit || readOnly} className="input" placeholder="المبلغ" dir="ltr" />
              </div>
              {canEdit && !readOnly && (
                <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#0ea77b', marginTop: '8px' }}>
                  <Upload style={{ width: '14px', height: '14px' }} /> رفع ملف الجزئي
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadInvoice('partial', f) }} />
                </label>
              )}
              {closure?.partial_invoice_file_name && (
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>📎 {closure.partial_invoice_file_name}</span>
              )}
            </div>
          )}

          {canEdit && !readOnly && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', padding: '4px 0' }}>
              <input
                type="checkbox"
                checked={partialSkipped}
                disabled={saving}
                onChange={e => handleToggleSkipPartial(e.target.checked)}
              />
              <span style={{ color: '#6b7280' }}>إلغاء المستخلص الجزئي والاكتفاء بالنهائي</span>
            </label>
          )}

          <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #86efac' }}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '10px' }}>المستخلص النهائي</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
              <input value={finalNumber} onChange={e => setFinalNumber(e.target.value)} disabled={!canEdit || readOnly} className="input" placeholder="رقم المستخلص" />
              <input type="date" value={finalDate} onChange={e => setFinalDate(e.target.value)} disabled={!canEdit || readOnly} className="input" dir="ltr" />
              <input type="number" value={finalAmount} onChange={e => setFinalAmount(e.target.value)} disabled={!canEdit || readOnly} className="input" placeholder="المبلغ" dir="ltr" />
            </div>
            {canEdit && !readOnly && (
              <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#0ea77b', marginTop: '8px' }}>
                <Upload style={{ width: '14px', height: '14px' }} /> رفع ملف النهائي
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadInvoice('final', f) }} />
              </label>
            )}
            {closure?.final_invoice_file_name && (
              <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>📎 {closure.final_invoice_file_name}</span>
            )}
          </div>

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

      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '12px' }}>📚 الدروس المستفادة وملاحظات</div>
        <textarea value={lessons} onChange={e => setLessons(e.target.value)} disabled={!canEdit || readOnly} className="input" placeholder="ملخص الدروس..." style={{ minHeight: '80px', marginBottom: '8px' }} />
        <textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={!canEdit || readOnly} className="input" placeholder="ملاحظات الإغلاق..." style={{ minHeight: '60px' }} />
      </div>

      {canEdit && !readOnly && (
        <div>
          <button onClick={handleSaveInvoices} disabled={saving} className="btn btn-primary" style={{ background: '#0ea77b', fontSize: '0.82rem' }}>
            {saving ? 'جاري الحفظ...' : 'حفظ المستخلصات والملاحظات'}
          </button>
        </div>
      )}
    </div>
  )
}
