'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, FileWarning, ShoppingCart, CheckCircle, ExternalLink, Trash2, Receipt, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'
import { COMPLIANCE_TYPES } from '@/lib/fleet-types'
import { FleetPageHeader } from '../FleetPageHeader'
import {
  complianceStatusFromExpiry,
  complianceAlertDays,
  suggestedRenewalPath,
  keepsStaticDataOnRenewal,
  startComplianceRenewalRequest,
  completeComplianceRenewal,
  canCompleteComplianceRenewal,
  resolveRenewalPath,
  fetchActiveVendors,
  hasActiveComplianceDoc,
  deleteComplianceDoc,
  type ComplianceDocRow,
  type RenewalPath,
} from '@/lib/fleet-compliance'
import type { Vendor } from '@/lib/purchases-types'

type Unit = { id: number; fleet_no: string; name: string }
type Doc = ComplianceDocRow & {
  unit?: Unit
  po?: { po_number: string; status: string }
  expense?: { expense_number: string; status: string }
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'ساري': { bg: '#ecfdf5', color: '#0ea77b' },
  'قريب الانتهاء': { bg: '#fffbeb', color: '#e6820a' },
  'منتهي': { bg: '#fef2f2', color: '#c81e1e' },
  'قيد التجديد': { bg: '#eff6ff', color: '#1a56db' },
  'مُجدَّد': { bg: '#f3f4f6', color: '#6b7280' },
}

function DocModal({ units, tenantId, onClose, onSave }: {
  units: Unit[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    unit_id: '', doc_type: 'استمارة', doc_number: '', issuer: '',
    issue_date: '', expiry_date: '', notes: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.unit_id || !form.doc_type) { toast.error('المعدة ونوع الوثيقة مطلوبان'); return }
    setSaving(true)
    try {
      const exists = await hasActiveComplianceDoc(tenantId, Number(form.unit_id), form.doc_type)
      if (exists) {
        toast.error('توجد وثيقة نشطة من نفس النوع لهذه المعدة — احذف المكررة أو استخدم «تجديد»')
        setSaving(false)
        return
      }
      const status = complianceStatusFromExpiry(form.expiry_date || null, form.doc_type)
      const { error } = await supabase.from('fleet_compliance_docs').insert({
        tenant_id: tenantId, unit_id: Number(form.unit_id),
        doc_type: form.doc_type, doc_number: form.doc_number || null,
        issuer: form.issuer || null,
        issue_date: form.issue_date || null, expiry_date: form.expiry_date || null,
        status, is_active: true, notes: form.notes || null,
      })
      if (error) throw error
      toast.success('✅ سُجّلت الوثيقة')
      onSave()
    } catch (err: unknown) {
      toast.error('خطأ: ' + (err as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>وثيقة امتثال</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={lbl}>المعدة *</label>
            <select value={form.unit_id} onChange={e => set('unit_id', e.target.value)} className="select">
              <option value="">— اختر —</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.fleet_no} — {u.name}</option>)}
            </select></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>نوع الوثيقة *</label>
              <select value={form.doc_type} onChange={e => set('doc_type', e.target.value)} className="select">
                {COMPLIANCE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <p style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '4px' }}>
                تنبيه قبل {complianceAlertDays(form.doc_type)} يوم
              </p></div>
            <div><label style={lbl}>رقم الوثيقة</label>
              <input value={form.doc_number} onChange={e => set('doc_number', e.target.value)} className="input" /></div>
          </div>
          <div><label style={lbl}>الجهة المصدرة</label>
            <input value={form.issuer} onChange={e => set('issuer', e.target.value)} className="input" placeholder="تأمين / المرور / طرف ثالث" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>تاريخ الإصدار</label><input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} className="input" /></div>
            <div><label style={lbl}>تاريخ الانتهاء</label><input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className="input" /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}><Save style={{ width: '15px' }} /> حفظ</button>
        </div>
      </div>
    </div>
  )
}

function RequestRenewModal({ doc, vendors, unitLabel, tenantId, createdBy, onClose, onDone }: {
  doc: Doc; vendors: Vendor[]; unitLabel: string; tenantId: string; createdBy?: string
  onClose: () => void; onDone: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const [path, setPath] = useState<RenewalPath>(suggestedRenewalPath(doc.doc_type))
  const [vendorId, setVendorId] = useState(String(doc.vendor_id || ''))
  const [payeeName, setPayeeName] = useState(doc.issuer || 'رسوم حكومية / مرور')
  const [amount, setAmount] = useState('')

  async function handleStart() {
    const vendor = vendors.find(v => v.id === Number(vendorId))
    setSaving(true)
    const result = await startComplianceRenewalRequest({
      tenantId,
      doc,
      path,
      unitLabel,
      createdBy,
      vendorId: vendor?.id,
      vendorName: vendor?.name,
      payeeName,
      estimatedAmount: Number(amount) || 0,
    })
    setSaving(false)
    if (!result.ok) { toast.error(result.error || 'فشل الطلب'); return }
    const dest = path === 'مشتريات' ? 'المشتريات' : 'المصروفات'
    toast.success(`تم إنشاء ${result.refNumber} — راجع ${dest} ثم أتمّ التجديد`)
    onDone()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '460px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList style={{ width: '18px', color: '#1a56db' }} /> طلب تجديد — {doc.doc_type}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.5 }}>
            طلب تجديد → اعتماد مالي (مشتريات أو مصروفات) → إتمام التجديد من الأسطول
          </p>
          <div><label style={lbl}>مسار التجديد *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['مصروفات', 'مشتريات'] as RenewalPath[]).map(p => (
                <button key={p} type="button" onClick={() => setPath(p)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                    border: path === p ? '2px solid #1a56db' : '1px solid var(--border)',
                    background: path === p ? '#eff6ff' : 'white',
                    color: path === p ? '#1a56db' : '#374151',
                  }}>
                  {p === 'مشتريات' ? <ShoppingCart style={{ width: '14px', display: 'inline', marginLeft: '4px' }} /> : <Receipt style={{ width: '14px', display: 'inline', marginLeft: '4px' }} />}
                  {p}
                  {suggestedRenewalPath(doc.doc_type) === p && <span style={{ fontSize: '0.65rem', display: 'block', color: '#6b7280', fontWeight: 400 }}>مقترح</span>}
                </button>
              ))}
            </div>
          </div>
          {path === 'مشتريات' ? (
            <>
              <div><label style={lbl}>المورد *</label>
                <select value={vendorId} onChange={e => setVendorId(e.target.value)} className="select">
                  <option value="">— اختر —</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select></div>
              <p style={{ fontSize: '0.72rem', color: '#9ca3af' }}>يُنشأ طلب شراء مسودة — يُعتمد في المشتريات ثم تُسجَّل الفاتورة</p>
            </>
          ) : (
            <>
              <div><label style={lbl}>الجهة / المستفيد</label>
                <input value={payeeName} onChange={e => setPayeeName(e.target.value)} className="input" placeholder="مرور / تأمينات / رسوم حكومية" /></div>
              <p style={{ fontSize: '0.72rem', color: '#9ca3af' }}>يُنشأ مصروف معلّق — يُعتمد ويُدفع في قسم المصروفات</p>
            </>
          )}
          <div><label style={lbl}>التكلفة التقديرية (ر.س)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input" dir="ltr" min="0" /></div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleStart} disabled={saving} className="btn btn-primary" style={{ background: '#1a56db' }}>
            <ClipboardList style={{ width: '14px' }} /> إرسال الطلب
          </button>
        </div>
      </div>
    </div>
  )
}

function CompleteRenewModal({ doc, tenantId, onClose, onDone }: {
  doc: Doc; tenantId: string; onClose: () => void; onDone: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' } as const
  const staticData = keepsStaticDataOnRenewal(doc.doc_type)
  const gate = canCompleteComplianceRenewal(doc, doc.po, doc.expense)
  const path = resolveRenewalPath(doc)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    doc_number: staticData ? (doc.doc_number || '') : '',
    issuer: doc.issuer || '',
    issue_date: '',
    expiry_date: '',
  })

  async function handleSave() {
    if (!form.expiry_date) { toast.error('تاريخ الانتهاء الجديد مطلوب'); return }
    if (!staticData && !form.doc_number) { toast.error('رقم الوثيقة الجديد مطلوب'); return }
    setSaving(true)
    const result = await completeComplianceRenewal({
      tenantId,
      oldDoc: doc,
      po: doc.po,
      expense: doc.expense,
      issueDate: form.issue_date || null,
      expiryDate: form.expiry_date,
      docNumber: form.doc_number || null,
      issuer: form.issuer || null,
    })
    setSaving(false)
    if (!result.ok) { toast.error(result.error || 'فشل'); return }
    toast.success('✅ تم التجديد — الوثيقة القديمة مُؤرشفة')
    onDone()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '440px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>إتمام التجديد — {doc.doc_type}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!gate.ok ? (
            <p style={{ fontSize: '0.78rem', color: '#c81e1e', background: '#fef2f2', padding: '10px', borderRadius: '8px' }}>
              {gate.message}
            </p>
          ) : (
            <p style={{ fontSize: '0.78rem', color: '#0ea77b', background: '#ecfdf5', padding: '10px', borderRadius: '8px' }}>
              {path === 'مشتريات'
                ? `طلب الشراء ${doc.po?.po_number} معتمد — أدخل بيانات الوثيقة الجديدة`
                : `المصروف ${doc.expense?.expense_number} مدفوع — أدخل بيانات الوثيقة الجديدة`}
            </p>
          )}
          {staticData && (
            <p style={{ fontSize: '0.78rem', color: '#0369a1', background: '#f0f9ff', padding: '8px 10px', borderRadius: '8px' }}>
              استمارة المعدة: يُحفظ رقم الوثيقة والجهة — يُحدَّث تاريخ الانتهاء فقط
            </p>
          )}
          {!staticData && (
            <div><label style={lbl}>رقم الوثيقة الجديد *</label>
              <input value={form.doc_number} onChange={e => setForm(f => ({ ...f, doc_number: e.target.value }))} className="input" /></div>
          )}
          {!staticData && (
            <div><label style={lbl}>الجهة المصدرة</label>
              <input value={form.issuer} onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))} className="input" /></div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>تاريخ الإصدار</label>
              <input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} className="input" /></div>
            <div><label style={lbl}>تاريخ الانتهاء *</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} className="input" /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving || !gate.ok} className="btn btn-primary" style={{ background: '#0ea77b' }}>
            <CheckCircle style={{ width: '14px' }} /> إتمام التجديد
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FleetCompliancePage() {
  const router = useRouter()
  const { tenant, currentUser } = useStore()
  const [docs, setDocs] = useState<Doc[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [renewDoc, setRenewDoc] = useState<Doc | null>(null)
  const [completeDoc, setCompleteDoc] = useState<Doc | null>(null)

  useEffect(() => { if (tenant) load() }, [tenant?.id, showArchived])

  async function load() {
    if (!tenant) return
    setLoading(true)

    let q = supabase.from('fleet_compliance_docs')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('expiry_date', { ascending: true })

    if (!showArchived) q = q.eq('is_active', true)

    const dRes = await q

    if (dRes.error) {
      console.error('fleet_compliance_docs load:', dRes.error)
      toast.error('تعذّر تحميل الوثائق: ' + dRes.error.message)
      setDocs([])
      setLoading(false)
      return
    }

    const rows = (dRes.data || []) as ComplianceDocRow[]
    const poIds = Array.from(new Set(rows.map(r => r.po_id).filter((id): id is number => id != null)))
    const expenseIds = Array.from(new Set(rows.map(r => r.expense_id).filter((id): id is number => id != null)))

    const [uRes, vRes, poRes, expRes] = await Promise.all([
      supabase.from('fleet_units').select('id,fleet_no,name').eq('tenant_id', tenant.id).eq('is_active', true),
      fetchActiveVendors(tenant.id),
      poIds.length > 0
        ? supabase.from('finance_purchase_orders').select('id,po_number,status').in('id', poIds)
        : Promise.resolve({ data: [] as { id: number; po_number: string; status: string }[], error: null }),
      expenseIds.length > 0
        ? supabase.from('finance_expenses').select('id,expense_number,status').in('id', expenseIds)
        : Promise.resolve({ data: [] as { id: number; expense_number: string; status: string }[], error: null }),
    ])

    const unitMap = new Map((uRes.data || []).map(u => [u.id, u as Unit]))
    const poMap = new Map((poRes.data || []).map(p => [p.id, { po_number: p.po_number, status: p.status }]))
    const expMap = new Map((expRes.data || []).map(e => [e.id, { expense_number: e.expense_number, status: e.status }]))

    const list: Doc[] = rows.map(row => {
      const liveStatus = row.is_active === false
        ? 'مُجدَّد'
        : row.status === 'قيد التجديد'
          ? 'قيد التجديد'
          : complianceStatusFromExpiry(row.expiry_date, row.doc_type)
      return {
        ...row,
        unit: unitMap.get(row.unit_id),
        po: row.po_id ? poMap.get(row.po_id) : undefined,
        expense: row.expense_id ? expMap.get(row.expense_id) : undefined,
        status: liveStatus,
      }
    })

    setDocs(list)
    setUnits(uRes.data || [])
    setVendors(vRes)
    setLoading(false)
  }

  const activeDocs = docs.filter(d => d.is_active !== false)
  const filtered = docs.filter(d => !filter || d.status === filter)
  const expired = activeDocs.filter(d => d.status === 'منتهي').length
  const soon = activeDocs.filter(d => d.status === 'قريب الانتهاء').length

  function canRenew(d: Doc) {
    return d.is_active !== false && d.status !== 'مُجدَّد' && d.status !== 'قيد التجديد'
      && (d.status === 'منتهي' || d.status === 'قريب الانتهاء')
  }

  async function handleDelete(d: Doc) {
    if (!confirm(`حذف وثيقة «${d.doc_type}» — ${d.unit?.name || 'المعدة'}؟`)) return
    const result = await deleteComplianceDoc(d)
    if (!result.ok) { toast.error(result.error || 'فشل الحذف'); return }
    toast.success('تم الحذف')
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <FleetPageHeader title="امتثال الأسطول" description="طلب تجديد → اعتماد مالي (مشتريات/مصروفات) → إتمام من الأسطول" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <div className="card" style={{ padding: '14px', background: '#fef2f2' }}>
          <FileWarning style={{ width: '18px', color: '#c81e1e' }} />
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c81e1e' }}>{expired}</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>منتهية — يمنع التخصيص</div>
        </div>
        <div className="card" style={{ padding: '14px', background: '#fffbeb' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e6820a' }}>{soon}</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>قريبة الانتهاء (حسب النوع)</div>
        </div>
        <div className="card" style={{ padding: '14px', background: '#ecfdf5' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0ea77b' }}>{activeDocs.length}</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>وثائق نشطة</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="select" style={{ width: '180px' }}>
            <option value="">كل الحالات</option>
            <option>منتهي</option><option>قريب الانتهاء</option><option>ساري</option>
            <option>قيد التجديد</option><option>مُجدَّد</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            عرض المؤرشف
          </label>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ background: '#e6820a' }}>
          <Plus style={{ width: '16px' }} /> وثيقة جديدة
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#e6820a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['المعدة', 'النوع', 'الرقم', 'الجهة', 'الانتهاء', 'الحالة', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد وثائق — أضف وثيقة جديدة</td></tr>
              )}
              {filtered.map(d => {
                const st = STATUS_COLORS[d.status] || STATUS_COLORS['ساري']
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--bg2)', opacity: d.is_active === false ? 0.65 : 1 }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.unit?.fleet_no} {d.unit?.name}</td>
                    <td style={{ padding: '10px 12px' }}>{d.doc_type}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem' }}>{d.doc_number || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{d.issuer || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{d.expiry_date || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: st.bg, color: st.color, fontWeight: 700 }}>{d.status}</span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {canRenew(d) && (
                          <button onClick={() => setRenewDoc(d)} className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '4px 8px', color: '#1a56db' }}>
                            <ClipboardList style={{ width: '12px' }} /> طلب تجديد
                          </button>
                        )}
                        {d.status === 'قيد التجديد' && (
                          <>
                            {d.po_id && d.po && (
                              <button onClick={() => router.push('/finance/purchases/orders')} style={{ fontSize: '0.7rem', padding: '4px 8px', border: '1px solid #fde68a', borderRadius: '6px', background: '#fffbeb', cursor: 'pointer' }}>
                                <ExternalLink style={{ width: '11px', display: 'inline' }} /> PO {d.po.po_number}
                                {d.po.status === 'مسودة' && <span style={{ color: '#e6820a' }}> (مسودة)</span>}
                              </button>
                            )}
                            {d.expense_id && d.expense && (
                              <button onClick={() => router.push('/finance/expenses/list')} style={{ fontSize: '0.7rem', padding: '4px 8px', border: '1px solid #bfdbfe', borderRadius: '6px', background: '#eff6ff', cursor: 'pointer' }}>
                                <ExternalLink style={{ width: '11px', display: 'inline' }} /> {d.expense.expense_number}
                                {d.expense.status === 'معلق' && <span style={{ color: '#e6820a' }}> (معلق)</span>}
                              </button>
                            )}
                            <button onClick={() => setCompleteDoc(d)} className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '4px 8px', background: '#0ea77b' }}>
                              إتمام
                            </button>
                          </>
                        )}
                        {d.status !== 'قيد التجديد' && (
                          <button onClick={() => handleDelete(d)} title="حذف"
                            style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer' }}>
                            <Trash2 style={{ width: '12px', height: '12px' }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && tenant && (
        <DocModal units={units} tenantId={tenant.id} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); void load() }} />
      )}
      {renewDoc && tenant && (
        <RequestRenewModal doc={renewDoc} vendors={vendors} unitLabel={`${renewDoc.unit?.fleet_no} ${renewDoc.unit?.name}`}
          tenantId={tenant.id} createdBy={currentUser?.name} onClose={() => setRenewDoc(null)} onDone={() => { setRenewDoc(null); load() }} />
      )}
      {completeDoc && tenant && (
        <CompleteRenewModal doc={completeDoc} tenantId={tenant.id} onClose={() => setCompleteDoc(null)} onDone={() => { setCompleteDoc(null); load() }} />
      )}
    </div>
  )
}
