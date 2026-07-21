'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Ruler, Undo2, CheckCircle2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '@/hooks/useStore'
import {
  fetchMeasureProject,
  updateProjectMeasure,
  closeProjectMeasure,
  reopenProjectToExecution,
  uploadMeasureFile,
  type MeasureProjectDetail,
} from '@/lib/project-measure-service'
import PlanningProgressBadge from '@/components/projects/PlanningProgressBadge'

const CHECKLIST = [
  { key: 'execution_confirmed' as const, label: 'اكتمال التنفيذ (100%)', emoji: '🏗️' },
  { key: 'as_built_confirmed' as const, label: 'مقايسة AS-BUILT معتمدة', emoji: '📐' },
  { key: 'material_reconciled' as const, label: 'مطابقة المواد والعهدة', emoji: '📦' },
  { key: 'variance_reviewed' as const, label: 'مراجعة أوامر التغيير', emoji: '🔄' },
  { key: 'interim_invoice_number' as const, label: 'مستخلص 50% (SPLIT_50_50)', emoji: '🧾', billingOnly: 'SPLIT_50_50' as const },
]

export default function MeasureProjectPage() {
  const params = useParams()
  const router = useRouter()
  const { tenant, currentUser } = useStore()
  const projectId = Number(params.projectId)

  const canEdit = !!(currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit'))

  const [project, setProject] = useState<MeasureProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [reopening, setReopening] = useState(false)

  const [interimNumber, setInterimNumber] = useState('')
  const [interimDate, setInterimDate] = useState('')
  const [interimAmount, setInterimAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [reconNotes, setReconNotes] = useState('')

  const reload = useCallback(async () => {
    if (!tenant) return
    const { project: p } = await fetchMeasureProject(tenant.id, projectId)
    setProject(p)
    const m = p.measure
    setInterimNumber(m?.interim_invoice_number || '')
    setInterimDate(m?.interim_invoice_date || '')
    setInterimAmount(m?.interim_invoice_amount != null ? String(m.interim_invoice_amount) : '')
    setNotes(m?.measure_notes || '')
    setReconNotes(m?.material_reconciliation_notes || '')
  }, [tenant?.id, projectId])

  useEffect(() => {
    if (!tenant || !projectId) return
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [tenant?.id, projectId, reload])

  async function toggleFlag(field: 'execution_confirmed' | 'as_built_confirmed' | 'material_reconciled' | 'variance_reviewed', value: boolean) {
    if (!tenant || !canEdit) return
    setSaving(true)
    try {
      await updateProjectMeasure(tenant.id, projectId, { [field]: value })
      toast.success('تم الحفظ')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
    }
    setSaving(false)
  }

  async function handleSaveInvoice() {
    if (!tenant || !canEdit) return
    setSaving(true)
    try {
      await updateProjectMeasure(tenant.id, projectId, {
        interim_invoice_number: interimNumber.trim() || null,
        interim_invoice_date: interimDate || null,
        interim_invoice_amount: interimAmount ? Number(interimAmount) : null,
        measure_notes: notes.trim() || null,
        material_reconciliation_notes: reconNotes.trim() || null,
      })
      toast.success('تم الحفظ')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
    }
    setSaving(false)
  }

  async function handleUploadInvoice(file: File) {
    if (!tenant || !canEdit) return
    setSaving(true)
    try {
      const { path, name } = await uploadMeasureFile(tenant.id, projectId, file, 'interim')
      await updateProjectMeasure(tenant.id, projectId, {
        interim_invoice_file_path: path,
        interim_invoice_file_name: name,
      })
      toast.success('تم رفع الملف')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الرفع')
    }
    setSaving(false)
  }

  async function handleCloseMeasure() {
    if (!tenant) return
    if (!confirm('اعتماد المقايسة ونقل المشروع إلى سلة الإغلاق؟')) return
    setClosing(true)
    try {
      await closeProjectMeasure(tenant.id, projectId)
      toast.success('تم اعتماد المقايسة')
      router.push('/projects/close')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الاعتماد')
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
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  const proj = project
  const measure = proj.measure
  const billing = proj.billing_model || 'SPLIT_50_50'
  const readOnly = measure?.measure_status === 'closed'

  function isCheckDone(key: typeof CHECKLIST[number]['key']): boolean {
    if (key === 'execution_confirmed') return !!(measure?.execution_confirmed || (proj.progress ?? 0) >= 100)
    if (key === 'as_built_confirmed') return !!(measure?.as_built_confirmed || proj.hasAsBuiltBoq)
    if (key === 'material_reconciled') return !!measure?.material_reconciled
    if (key === 'variance_reviewed') return !!measure?.variance_reviewed
    if (key === 'interim_invoice_number') return billing === 'FULL_100' || !!measure?.interim_invoice_number?.trim()
    return false
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/projects/measure')} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem' }}>
          <ArrowRight style={{ width: '14px', height: '14px' }} /> العودة
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Ruler style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            {project.code ? `${project.code} — ` : ''}{project.name}
          </h2>
          {project.client_name && (
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text3)' }}>{project.client_name}</p>
          )}
        </div>
        {project.measureProgress && <PlanningProgressBadge progress={project.measureProgress} />}
        {canEdit && !readOnly && (
          <>
            <button onClick={handleReopenExecution} disabled={reopening} className="btn btn-ghost" style={{ fontSize: '0.78rem', color: '#e6820a', border: '1px solid #fcd34d' }}>
              <Undo2 style={{ width: '14px', height: '14px' }} />
              {reopening ? 'جاري...' : 'إرجاع للتنفيذ'}
            </button>
            <button
              onClick={handleCloseMeasure}
              disabled={closing || !project.measureProgress?.isComplete}
              className="btn btn-primary"
              style={{ fontSize: '0.78rem', background: project.measureProgress?.isComplete ? '#0ea77b' : '#9ca3af' }}
            >
              <CheckCircle2 style={{ width: '14px', height: '14px' }} />
              {closing ? 'جاري الاعتماد...' : 'اعتماد المقايسة → الإغلاق'}
            </button>
          </>
        )}
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '16px' }}>✅ قائمة المقايسة والتسوية</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {CHECKLIST.filter(item => !item.billingOnly || item.billingOnly === billing).map(item => {
            const done = isCheckDone(item.key)
            const isToggle = item.key !== 'interim_invoice_number'
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
                      checked={!!measure?.[item.key as 'execution_confirmed']}
                      disabled={saving || (item.key === 'execution_confirmed' && (project.progress ?? 0) >= 100)}
                      onChange={e => toggleFlag(item.key as 'execution_confirmed', e.target.checked)}
                    />
                    {done ? '✓' : 'تأكيد'}
                  </label>
                ) : (
                  <span style={{ fontSize: '0.78rem', color: done ? '#0ea77b' : '#9ca3af', fontWeight: 700 }}>{done ? '✓ مكتمل' : '—'}</span>
                )}
              </div>
            )
          })}
        </div>
        {project.hasAsBuiltBoq && !measure?.as_built_confirmed && (
          <p style={{ fontSize: '0.75rem', color: '#0ea77b', marginTop: '12px' }}>
            ✓ يوجد BOQ من نوع AS-BUILT نشط —{' '}
            <Link href={`/inventory/pmc?project=${projectId}`} style={{ color: '#1a56db' }}>عرض في PMC</Link>
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '12px' }}>📦 مطابقة المواد</div>
          <textarea
            value={reconNotes}
            onChange={e => setReconNotes(e.target.value)}
            disabled={!canEdit || readOnly}
            className="input"
            placeholder="ملاحظات مطابقة العهدة والفائض..."
            style={{ minHeight: '80px', marginBottom: '10px' }}
          />
        </div>

        {billing === 'SPLIT_50_50' && (
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '12px' }}>🧾 مستخلص 50% (بعد المقايسة)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input value={interimNumber} onChange={e => setInterimNumber(e.target.value)} disabled={!canEdit || readOnly} className="input" placeholder="رقم المستخلص" />
              <input type="date" value={interimDate} onChange={e => setInterimDate(e.target.value)} disabled={!canEdit || readOnly} className="input" dir="ltr" />
              <input type="number" value={interimAmount} onChange={e => setInterimAmount(e.target.value)} disabled={!canEdit || readOnly} className="input" placeholder="المبلغ" dir="ltr" />
              {canEdit && !readOnly && (
                <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#7c3aed' }}>
                  <Upload style={{ width: '14px', height: '14px' }} /> رفع ملف المستخلص
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadInvoice(f) }} />
                </label>
              )}
              {measure?.interim_invoice_file_name && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>📎 {measure.interim_invoice_file_name}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {canEdit && !readOnly && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="ملاحظات عامة للمقايسة..." style={{ minHeight: '60px', marginBottom: '10px' }} />
          <button onClick={handleSaveInvoice} disabled={saving} className="btn btn-primary" style={{ background: '#7c3aed', fontSize: '0.82rem' }}>
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      )}
    </div>
  )
}
