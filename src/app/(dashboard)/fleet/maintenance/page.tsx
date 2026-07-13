'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Wrench, ShoppingCart, CheckCircle, FileText, ExternalLink, Pencil, RotateCcw, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { nextWorkOrderNo, fmt } from '@/lib/fleet-types'
import { FleetPageHeader } from '../FleetPageHeader'
import type { Vendor } from '@/lib/purchases-types'
import {
  fetchActiveVendors,
  createDraftPOFromWorkOrder,
  confirmWorkOrderService,
  postInternalWorkOrderJournal,
  calcWorkOrderTotal,
  calcInternalJournalAmount,
  workOrderNeedsPartsPo,
  workOrderNeedsServiceConfirm,
  FLEET_INTERNAL_LABOR_RATE,
} from '@/lib/fleet-procurement'

type MaintenanceTab = 'active' | 'completed'

const ACTIVE_STATUSES = ['مفتوح', 'قيد التنفيذ'] as const

function formatDate(d?: string | null): string {
  if (!d) return '—'
  return d.split('T')[0]
}

type Unit = { id: number; fleet_no: string; name: string }
type CashAccount = { id: number; name: string; account_type: string; account_id?: number }
type WorkOrder = {
  id: number; unit_id: number; wo_no: string; wo_type: string; source: string; status: string
  priority: string; description: string; opened_at: string; completed_at?: string | null; project_id?: number
  labor_hours: number; parts_cost: number; external_cost: number; total_cost: number
  vendor_id?: number; vendor_name?: string; po_id?: number; vendor_invoice_id?: number
  service_confirmed_at?: string | null; journal_posted_at?: string | null
  unit?: Unit
  vendor?: { id: number; name: string }
  po?: { id: number; po_number: string; status: string }
  vendor_invoice?: { id: number; invoice_number: string; status: string }
}

function WOModal({ units, vendors, tenantId, createdBy, onClose, onSave }: {
  units: Unit[]; vendors: Vendor[]; tenantId: string; createdBy?: string
  onClose: () => void; onSave: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    unit_id: '', wo_type: 'CM', source: 'داخلي', priority: 'عادي',
    description: '', vendor_id: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.unit_id || !form.description.trim()) { toast.error('المعدة والوصف مطلوبان'); return }
    if (form.source === 'خارجي' && !form.vendor_id) { toast.error('اختر المورد من قائمة المشتريات'); return }
    setSaving(true)
    try {
      const woNo = await nextWorkOrderNo(tenantId)
      const vendor = vendors.find(v => v.id === Number(form.vendor_id))
      const { error } = await supabase.from('fleet_work_orders').insert({
        tenant_id: tenantId, wo_no: woNo,
        unit_id: Number(form.unit_id), wo_type: form.wo_type, source: form.source,
        priority: form.priority, description: form.description.trim(),
        vendor_id: form.source === 'خارجي' ? Number(form.vendor_id) : null,
        vendor_name: vendor?.name || null,
        status: 'مفتوح',
      })
      if (error) throw error
      if (form.wo_type === 'CM') {
        await supabase.from('fleet_units').update({ operational_status: 'صيانة' }).eq('id', Number(form.unit_id))
      }
      toast.success(`أمر عمل ${woNo}`)
      onSave()
    } catch (err: unknown) {
      toast.error('خطأ: ' + (err as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>أمر عمل جديد</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={lbl}>المعدة *</label>
            <select value={form.unit_id} onChange={e => set('unit_id', e.target.value)} className="select">
              <option value="">— اختر —</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.fleet_no} — {u.name}</option>)}
            </select></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div><label style={lbl}>النوع</label>
              <select value={form.wo_type} onChange={e => set('wo_type', e.target.value)} className="select">
                <option value="PM">وقائية PM</option><option value="CM">تصحيحية CM</option>
              </select></div>
            <div><label style={lbl}>المسار</label>
              <select value={form.source} onChange={e => set('source', e.target.value)} className="select">
                <option>داخلي</option><option>خارجي</option>
              </select>
              {form.source === 'داخلي' && (
                <p style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '4px' }}>
                  يمكن طلب شراء قطع غيار من مورد لاحقاً دون تغيير المسار
                </p>
              )}
            </div>
            <div><label style={lbl}>الأولوية</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className="select">
                <option>عادي</option><option>عاجل</option>
              </select></div>
          </div>
          <div><label style={lbl}>الوصف *</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input" rows={3} /></div>
          {form.source === 'خارجي' && (
            <div><label style={lbl}>المورد * (من المشتريات)</label>
              <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} className="select">
                <option value="">— اختر المورد —</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select></div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#0d9488' }}><Save style={{ width: '15px' }} /> إنشاء</button>
        </div>
      </div>
    </div>
  )
}

function PartsPOModal({ wo, vendors, tenantId, createdBy, onClose, onDone }: {
  wo: WorkOrder; vendors: Vendor[]; tenantId: string; createdBy?: string
  onClose: () => void; onDone: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const [vendorId, setVendorId] = useState(String(wo.vendor_id || ''))
  const [amount, setAmount] = useState(String(wo.external_cost || ''))

  async function handleCreate() {
    if (!vendorId) { toast.error('اختر مورد قطع الغيار'); return }
    const vendor = vendors.find(v => v.id === Number(vendorId))
    if (!vendor) return
    setSaving(true)
    const result = await createDraftPOFromWorkOrder({
      tenantId,
      workOrderId: wo.id,
      woNo: wo.wo_no,
      vendorId: vendor.id,
      vendorName: vendor.name,
      description: wo.source === 'داخلي' ? `قطع غيار — ${wo.description}` : wo.description,
      unitLabel: `${wo.unit?.fleet_no} ${wo.unit?.name}`,
      projectId: wo.project_id,
      estimatedAmount: Number(amount) || 0,
      createdBy,
    })
    setSaving(false)
    if (!result) { toast.error('فشل إنشاء طلب الشراء'); return }
    toast.success(`طلب شراء ${result.poNumber} — اعتمده في المشتريات`)
    onDone()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '420px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>طلب شراء قطع — {wo.wo_no}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '0.82rem', color: '#6b7280' }}>
            {wo.source === 'داخلي'
              ? 'صيانة داخلية مع قطع من مورد — يُعتمد PO ثم تُسجَّل الفاتورة في المشتريات'
              : 'طلب شراء خدمة/قطع من المورد'}
          </p>
          <div><label style={lbl}>المورد *</label>
            <select value={vendorId} onChange={e => setVendorId(e.target.value)} className="select">
              <option value="">— اختر —</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select></div>
          <div><label style={lbl}>التكلفة التقديرية (ر.س)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input" dir="ltr" min="0" /></div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleCreate} disabled={saving} className="btn btn-primary" style={{ background: '#e6820a' }}>
            <ShoppingCart style={{ width: '14px' }} /> إنشاء طلب شراء
          </button>
        </div>
      </div>
    </div>
  )
}

function EditWOModal({ wo, onClose, onDone }: {
  wo: WorkOrder; onClose: () => void; onDone: () => void
}) {
  const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' } as const
  const [saving, setSaving] = useState(false)
  const isClosed = wo.status === 'مكتمل'
  const [form, setForm] = useState({
    description: wo.description,
    priority: wo.priority,
    labor_hours: String(wo.labor_hours || 0),
    parts_cost: String(wo.parts_cost || 0),
    external_cost: String(wo.external_cost || 0),
  })

  async function handleSave() {
    if (!form.description.trim()) { toast.error('الوصف مطلوب'); return }
    setSaving(true)
    try {
      const labor = Number(form.labor_hours) || 0
      const parts = Number(form.parts_cost) || 0
      const external = Number(form.external_cost) || 0
      const total = labor * FLEET_INTERNAL_LABOR_RATE + parts + external
      const { error } = await supabase.from('fleet_work_orders').update({
        description: form.description.trim(),
        priority: form.priority,
        labor_hours: labor,
        parts_cost: parts,
        external_cost: external,
        total_cost: total,
      }).eq('id', wo.id)
      if (error) throw error
      toast.success('تم حفظ التعديلات')
      onDone()
    } catch (err: unknown) {
      toast.error('خطأ: ' + (err as Error).message)
    } finally { setSaving(false) }
  }

  async function handleReopen() {
    if (!confirm('إعادة فتح أمر العمل للتعديل؟')) return
    if (wo.journal_posted_at) {
      toast('⚠️ يوجد قيد محاسبي — راجع المحاسبة إن لزم عكس أو تعديل', { icon: '⚠️', duration: 6000 })
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('fleet_work_orders').update({
        status: 'قيد التنفيذ',
        completed_at: null,
      }).eq('id', wo.id)
      if (error) throw error
      if (wo.wo_type === 'CM') {
        await supabase.from('fleet_units').update({ operational_status: 'صيانة' }).eq('id', wo.unit_id)
      }
      toast.success('تمت إعادة فتح أمر العمل')
      onDone()
    } catch (err: unknown) {
      toast.error('خطأ: ' + (err as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '460px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pencil style={{ width: '16px' }} /> تعديل — {wo.wo_no}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isClosed && (
            <p style={{ fontSize: '0.78rem', color: '#0369a1', background: '#f0f9ff', padding: '8px 10px', borderRadius: '8px' }}>
              أمر مغلق — عدّل البيانات أو أعد الفتح للمتابعة
            </p>
          )}
          <div><label style={lbl}>الوصف *</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input" rows={3} /></div>
          <div><label style={lbl}>الأولوية</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="select">
              <option>عادي</option><option>عاجل</option>
            </select></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div><label style={lbl}>ساعات عمالة</label>
              <input type="number" value={form.labor_hours} onChange={e => setForm(f => ({ ...f, labor_hours: e.target.value }))} className="input" dir="ltr" /></div>
            <div><label style={lbl}>قطع (مخزون/يدوي)</label>
              <input type="number" value={form.parts_cost} onChange={e => setForm(f => ({ ...f, parts_cost: e.target.value }))} className="input" dir="ltr" /></div>
            <div><label style={lbl}>قطع من مورد (PO)</label>
              <input type="number" value={form.external_cost} onChange={e => setForm(f => ({ ...f, external_cost: e.target.value }))} className="input" dir="ltr" /></div>
          </div>
        </div>
        <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
          <div>
            {isClosed && (
              <button onClick={handleReopen} disabled={saving} className="btn btn-ghost" style={{ color: '#1a56db' }}>
                <RotateCcw style={{ width: '14px' }} /> إعادة فتح
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#0d9488' }}>
              <Save style={{ width: '14px' }} /> حفظ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompleteInternalModal({ wo, cashAccounts, tenantId, onClose, onDone }: {
  wo: WorkOrder; cashAccounts: CashAccount[]; tenantId: string
  onClose: () => void; onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [cashId, setCashId] = useState('')
  const journalAmount = calcInternalJournalAmount(wo)
  const displayTotal = calcWorkOrderTotal(wo)

  async function handleComplete() {
    if (journalAmount > 0 && !cashId) { toast.error('اختر حساب الدفع للقيد المحاسبي'); return }
    setSaving(true)
    try {
      if (journalAmount > 0) {
        const cash = cashAccounts.find(a => a.id === Number(cashId))
        if (!cash?.account_id) { toast.error('حساب الدفع غير مربوط بشجرة الحسابات'); setSaving(false); return }
        const { data: accRow } = await supabase.from('finance_accounts').select('code').eq('id', cash.account_id).single()
        if (!accRow?.code) { toast.error('لم يُعثر على كود الحساب'); setSaving(false); return }
        const ok = await postInternalWorkOrderJournal({
          tenantId,
          workOrderId: wo.id,
          woNo: wo.wo_no,
          unitName: wo.unit?.name || '',
          description: wo.description,
          amount: journalAmount,
          cashAccountId: Number(cashId),
          cashAccountCode: accRow.code,
        })
        if (!ok) { toast.error('⚠️ فشل القيد المحاسبي — راجع شجرة الحسابات'); setSaving(false); return }
      }
      await supabase.from('fleet_work_orders').update({
        status: 'مكتمل',
        completed_at: new Date().toISOString(),
        total_cost: displayTotal,
      }).eq('id', wo.id)
      await supabase.from('fleet_units').update({ operational_status: 'متاح' }).eq('id', wo.unit_id)
      toast.success(journalAmount > 0 ? '✅ أُغلق أمر العمل مع القيد المحاسبي' : '✅ أُغلق أمر العمل')
      onDone()
    } catch (err: unknown) {
      toast.error('خطأ: ' + (err as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '420px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>إغلاق — صيانة داخلية</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            الإجمالي: <strong>{fmt(displayTotal)} ر.س</strong>
            {wo.vendor_invoice_id && (
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#0ea77b', marginTop: '4px' }}>
                القيد الداخلي: {fmt(journalAmount)} ر.س (قطع المورد مُفوترة عبر المشتريات)
              </span>
            )}
            {!wo.vendor_invoice_id && (
              <span style={{ display: 'block', fontSize: '0.75rem', marginTop: '4px' }}>
                ساعات × {FLEET_INTERNAL_LABOR_RATE} + قطع + مورد
              </span>
            )}
          </p>
          {journalAmount > 0 && (
            <>
              <div><label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>حساب الدفع *</label>
                <select value={cashId} onChange={e => setCashId(e.target.value)} className="select">
                  <option value="">— اختر —</option>
                  {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.account_type})</option>)}
                </select></div>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af' }}>📋 مدين 5142 صيانة معدات ← دائن البنك/الصندوق</p>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleComplete} disabled={saving} className="btn btn-primary" style={{ background: '#0ea77b' }}>إغلاق وتسجيل</button>
        </div>
      </div>
    </div>
  )
}

export default function FleetMaintenancePage() {
  const router = useRouter()
  const { tenant, currentUser } = useStore()
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [completeWo, setCompleteWo] = useState<WorkOrder | null>(null)
  const [partsPoWo, setPartsPoWo] = useState<WorkOrder | null>(null)
  const [editWo, setEditWo] = useState<WorkOrder | null>(null)
  const [tab, setTab] = useState<MaintenanceTab>('active')
  const [activeStatusFilter, setActiveStatusFilter] = useState('')
  const [completedUnitFilter, setCompletedUnitFilter] = useState('')
  const [completedSearch, setCompletedSearch] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => { if (tenant) load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)

    const woRes = await supabase.from('fleet_work_orders')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('opened_at', { ascending: false })
      .limit(100)

    if (woRes.error) {
      console.error('fleet_work_orders load:', woRes.error)
      toast.error('تعذّر تحميل أوامر العمل: ' + woRes.error.message)
      setOrders([])
      setLoading(false)
      return
    }

    const rows = woRes.data || []
    const unitIds = Array.from(new Set(rows.map(r => r.unit_id).filter(Boolean)))
    const vendorIds = Array.from(new Set(rows.map(r => r.vendor_id).filter((id): id is number => id != null)))
    const poIds = Array.from(new Set(rows.map(r => r.po_id).filter((id): id is number => id != null)))
    const invoiceIds = Array.from(new Set(rows.map(r => r.vendor_invoice_id).filter((id): id is number => id != null)))

    const [uRes, vRes, cRes, unitsRes, vendorsRes, posRes, invRes] = await Promise.all([
      supabase.from('fleet_units').select('id,fleet_no,name').eq('tenant_id', tenant.id).eq('is_active', true),
      fetchActiveVendors(tenant.id),
      supabase.from('finance_cash_accounts').select('id,name,account_type,account_id')
        .eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
      unitIds.length > 0
        ? supabase.from('fleet_units').select('id,fleet_no,name').in('id', unitIds)
        : Promise.resolve({ data: [] as Unit[], error: null }),
      vendorIds.length > 0
        ? supabase.from('finance_vendors').select('id,name').in('id', vendorIds)
        : Promise.resolve({ data: [] as { id: number; name: string }[], error: null }),
      poIds.length > 0
        ? supabase.from('finance_purchase_orders').select('id,po_number,status').in('id', poIds)
        : Promise.resolve({ data: [] as { id: number; po_number: string; status: string }[], error: null }),
      invoiceIds.length > 0
        ? supabase.from('finance_vendor_invoices').select('id,invoice_number,status').in('id', invoiceIds)
        : Promise.resolve({ data: [] as { id: number; invoice_number: string; status: string }[], error: null }),
    ])

    const unitMap = new Map((unitsRes.data || []).map(u => [u.id, u as Unit]))
    const vendorMap = new Map((vendorsRes.data || []).map(v => [v.id, v]))
    const poMap = new Map((posRes.data || []).map(p => [p.id, { id: p.id, po_number: p.po_number, status: p.status }]))
    const invMap = new Map((invRes.data || []).map(i => [i.id, { id: i.id, invoice_number: i.invoice_number, status: i.status }]))

    const list: WorkOrder[] = rows.map(row => ({
      ...row,
      unit: unitMap.get(row.unit_id),
      vendor: row.vendor_id ? vendorMap.get(row.vendor_id) : undefined,
      po: row.po_id ? poMap.get(row.po_id) : undefined,
      vendor_invoice: row.vendor_invoice_id ? invMap.get(row.vendor_invoice_id) : undefined,
    })) as WorkOrder[]

    setOrders(list)
    setUnits(uRes.data || [])
    setVendors(vRes)
    setCashAccounts(cRes.data || [])
    setLoading(false)
  }

  async function updateStatus(wo: WorkOrder, status: string) {
    if (status === 'مكتمل' && wo.source === 'داخلي') {
      setCompleteWo(wo)
      return
    }
    if (status === 'مكتمل' && wo.source === 'خارجي') {
      if (!wo.service_confirmed_at) { toast.error('أكّد استلام الخدمة من المورد أولاً'); return }
      if (!wo.vendor_invoice_id) toast('⚠️ لا توجد فاتورة مورد مرتبطة — يُفضّل إنشاء الفاتورة من المشتريات', { icon: 'ℹ️' })
    }
    const total = calcWorkOrderTotal(wo)
    await supabase.from('fleet_work_orders').update({
      status: 'مكتمل',
      completed_at: new Date().toISOString(),
      total_cost: total,
    }).eq('id', wo.id)
    await supabase.from('fleet_units').update({ operational_status: 'متاح' }).eq('id', wo.unit_id)
    toast.success('تم إغلاق أمر العمل')
    load()
  }

  async function updateCosts(wo: WorkOrder, field: string, value: number) {
    const updated = { ...wo, [field]: value }
    const total = calcWorkOrderTotal(updated)
    await supabase.from('fleet_work_orders').update({ [field]: value, total_cost: total }).eq('id', wo.id)
    load()
  }

  async function handleCreatePO(wo: WorkOrder) {
    if (!tenant || wo.po_id) { toast.error('يوجد أمر شراء مرتبط'); return }
    if (wo.source === 'داخلي' || !wo.vendor_id) {
      setPartsPoWo(wo)
      return
    }
    setBusyId(wo.id)
    const result = await createDraftPOFromWorkOrder({
      tenantId: tenant.id,
      workOrderId: wo.id,
      woNo: wo.wo_no,
      vendorId: wo.vendor_id,
      vendorName: wo.vendor?.name || wo.vendor_name || '',
      description: wo.description,
      unitLabel: `${wo.unit?.fleet_no} ${wo.unit?.name}`,
      projectId: wo.project_id,
      estimatedAmount: Number(wo.external_cost) || 0,
      createdBy: currentUser?.name,
    })
    setBusyId(null)
    if (!result) { toast.error('فشل إنشاء طلب الشراء'); return }
    toast.success(`طلب شراء ${result.poNumber} — بانتظار الاعتماد في المشتريات`)
    load()
  }

  function canCreateInvoice(wo: WorkOrder): boolean {
    if (!wo.po || wo.po.status === 'مسودة' || wo.vendor_invoice_id) return false
    if (wo.source === 'خارجي') return !!wo.service_confirmed_at
    return true
  }

  async function handleConfirmService(wo: WorkOrder) {
    setBusyId(wo.id)
    const ok = await confirmWorkOrderService(wo.id)
    setBusyId(null)
    if (!ok) { toast.error('فشل التأكيد'); return }
    toast.success('✅ تم تأكيد استلام الخدمة')
    load()
  }

  const activeOrders = useMemo(() => {
    return orders
      .filter(o => (ACTIVE_STATUSES as readonly string[]).includes(o.status))
      .filter(o => {
        if (activeStatusFilter === '__urgent') return o.priority === 'عاجل'
        if (!activeStatusFilter) return true
        return o.status === activeStatusFilter
      })
      .sort((a, b) => {
        if (a.priority === 'عاجل' && b.priority !== 'عاجل') return -1
        if (b.priority === 'عاجل' && a.priority !== 'عاجل') return 1
        return new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
      })
  }, [orders, activeStatusFilter])

  const completedOrders = useMemo(() => {
    const q = completedSearch.trim().toLowerCase()
    return orders
      .filter(o => o.status === 'مكتمل')
      .filter(o => !completedUnitFilter || o.unit_id === Number(completedUnitFilter))
      .filter(o => {
        if (!q) return true
        const hay = `${o.wo_no} ${o.description} ${o.unit?.fleet_no || ''} ${o.unit?.name || ''}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => new Date(b.completed_at || b.opened_at).getTime() - new Date(a.completed_at || a.opened_at).getTime())
  }, [orders, completedUnitFilter, completedSearch])

  const filterUnits = useMemo(() => {
    const map = new Map<number, Unit>()
    units.forEach(u => map.set(u.id, u))
    orders.filter(o => o.status === 'مكتمل' && o.unit).forEach(o => {
      if (o.unit) map.set(o.unit_id, o.unit)
    })
    return Array.from(map.values()).sort((a, b) => a.fleet_no.localeCompare(b.fleet_no, 'ar'))
  }, [units, orders])

  const openCount = orders.filter(o => o.status === 'مفتوح').length
  const inProgressCount = orders.filter(o => o.status === 'قيد التنفيذ').length
  const completedCount = orders.filter(o => o.status === 'مكتمل').length
  const urgentCount = orders.filter(o => (ACTIVE_STATUSES as readonly string[]).includes(o.status) && o.priority === 'عاجل').length

  const tabBtn = (id: MaintenanceTab, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{
        padding: '10px 16px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
        borderBottom: tab === id ? '2px solid #0d9488' : '2px solid transparent',
        color: tab === id ? '#0d9488' : '#6b7280',
        background: tab === id ? '#f0fdfa' : 'transparent',
        borderRadius: '8px 8px 0 0',
      }}
    >
      {label}
      <span style={{
        marginRight: '6px', fontSize: '0.72rem', padding: '1px 7px', borderRadius: '10px',
        background: tab === id ? '#0d9488' : '#e5e7eb', color: tab === id ? 'white' : '#6b7280',
      }}>{count}</span>
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <FleetPageHeader title="صيانة الأسطول" description="أوامر نشطة ومتابعة — أرشيف الصيانات المنجزة" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        <div className="card" style={{ padding: '12px 14px', background: '#fffbeb' }}>
          <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>مفتوحة</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#e6820a' }}>{openCount}</div>
        </div>
        <div className="card" style={{ padding: '12px 14px', background: '#eff6ff' }}>
          <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>قيد التنفيذ</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1a56db' }}>{inProgressCount}</div>
        </div>
        <div className="card" style={{ padding: '12px 14px', background: '#fef2f2' }}>
          <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>عاجلة</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#c81e1e' }}>{urgentCount}</div>
        </div>
        <div className="card" style={{ padding: '12px 14px', background: '#ecfdf5' }}>
          <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>منجزة</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0ea77b' }}>{completedCount}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {tabBtn('active', 'نشطة / معلقة', openCount + inProgressCount)}
          {tabBtn('completed', 'منجزة', completedCount)}
        </div>
        {tab === 'active' && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ background: '#0d9488' }}>
            <Plus style={{ width: '16px' }} /> أمر عمل
          </button>
        )}
      </div>

      {tab === 'active' && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[{ v: '', l: 'الكل' }, { v: 'مفتوح', l: 'مفتوحة' }, { v: 'قيد التنفيذ', l: 'قيد التنفيذ' }, { v: '__urgent', l: 'عاجل فقط' }].map(p => (
            <button key={p.v || 'all'} type="button"
              onClick={() => setActiveStatusFilter(p.v === '__urgent' ? '__urgent' : p.v)}
              style={{
                padding: '5px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                border: (p.v === '__urgent' ? activeStatusFilter === '__urgent' : activeStatusFilter === p.v) ? '1px solid #0d9488' : '1px solid var(--border)',
                background: (p.v === '__urgent' ? activeStatusFilter === '__urgent' : activeStatusFilter === p.v) ? '#f0fdfa' : 'white',
                color: (p.v === '__urgent' ? activeStatusFilter === '__urgent' : activeStatusFilter === p.v) ? '#0d9488' : '#6b7280',
              }}>{p.l}</button>
          ))}
        </div>
      )}

      {tab === 'completed' && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={completedUnitFilter} onChange={e => setCompletedUnitFilter(e.target.value)} className="select" style={{ minWidth: '200px' }}>
            <option value="">كل المعدات</option>
            {filterUnits.map(u => (
              <option key={u.id} value={u.id}>{u.fleet_no} — {u.name}</option>
            ))}
          </select>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '360px' }}>
            <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', color: '#9ca3af' }} />
            <input
              value={completedSearch}
              onChange={e => setCompletedSearch(e.target.value)}
              placeholder="بحث برقم الأمر أو الوصف..."
              className="input"
              style={{ paddingRight: '32px', width: '100%' }}
            />
          </div>
          <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{completedOrders.length} سجل</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : tab === 'active' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {activeOrders.map(wo => (
            <div key={wo.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <Wrench style={{ width: '16px', color: '#e6820a' }} />
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488' }}>{wo.wo_no}</span>
                    <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: wo.wo_type === 'CM' ? '#fef2f2' : '#fffbeb', color: wo.wo_type === 'CM' ? '#c81e1e' : '#e6820a', fontWeight: 700 }}>{wo.wo_type}</span>
                    <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: wo.source === 'خارجي' ? '#eff6ff' : '#f3f4f6', color: wo.source === 'خارجي' ? '#1a56db' : '#6b7280', fontWeight: 600 }}>{wo.source}</span>
                    {wo.priority === 'عاجل' && (
                      <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '20px', background: '#fef2f2', color: '#c81e1e', fontWeight: 700 }}>عاجل</span>
                    )}
                    {wo.po_id && wo.source === 'داخلي' && (
                      <span style={{ fontSize: '0.68rem', color: '#e6820a', fontWeight: 600 }}>+ قطع مورد</span>
                    )}
                    {wo.journal_posted_at && <span style={{ fontSize: '0.68rem', color: '#0ea77b', fontWeight: 600 }}>✓ مُرحّل محاسبياً</span>}
                  </div>
                  <div style={{ fontWeight: 600, marginTop: '4px' }}>{wo.unit?.fleet_no} {wo.unit?.name} — {wo.description}</div>
                  {(wo.vendor?.name || wo.vendor_name) && (
                    <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>مورد: {wo.vendor?.name || wo.vendor_name}</div>
                  )}
                  {wo.po && (
                    <div style={{ fontSize: '0.78rem', color: '#e6820a', marginTop: '2px' }}>
                      طلب شراء: {wo.po.po_number} ({wo.po.status})
                    </div>
                  )}
                  {wo.vendor_invoice && (
                    <div style={{ fontSize: '0.78rem', color: '#c81e1e' }}>
                      فاتورة: {wo.vendor_invoice.invoice_number} ({wo.vendor_invoice.status})
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: wo.status === 'مكتمل' ? '#0ea77b' : '#1a56db' }}>{wo.status}</span>
              </div>

              {wo.status !== 'ملغي' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginTop: '12px' }}>
                  <div><label style={{ fontSize: '0.68rem', color: '#9ca3af' }}>ساعات عمالة</label>
                    <input type="number" defaultValue={wo.labor_hours} onBlur={e => updateCosts(wo, 'labor_hours', Number(e.target.value))} className="input" dir="ltr" style={{ padding: '6px' }} /></div>
                  <div><label style={{ fontSize: '0.68rem', color: '#9ca3af' }}>قطع (مخزون/يدوي)</label>
                    <input type="number" defaultValue={wo.parts_cost} onBlur={e => updateCosts(wo, 'parts_cost', Number(e.target.value))} className="input" dir="ltr" style={{ padding: '6px' }} /></div>
                  <div><label style={{ fontSize: '0.68rem', color: '#9ca3af' }}>قطع من مورد (PO)</label>
                    <input type="number" defaultValue={wo.external_cost} onBlur={e => updateCosts(wo, 'external_cost', Number(e.target.value))} className="input" dir="ltr" style={{ padding: '6px' }} /></div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>الإجمالي: {fmt(calcWorkOrderTotal(wo))} ر.س</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={() => setEditWo(wo)} className="btn btn-ghost" style={{ fontSize: '0.75rem' }}>
                    <Pencil style={{ width: '13px' }} /> تعديل
                  </button>
                  {workOrderNeedsPartsPo(wo) && (
                    <button onClick={() => handleCreatePO(wo)} disabled={busyId === wo.id}
                      className="btn btn-ghost" style={{ fontSize: '0.75rem', border: '1px solid #fde68a', color: '#e6820a' }}>
                      <ShoppingCart style={{ width: '13px' }} /> {wo.source === 'داخلي' ? 'طلب قطع' : 'طلب شراء'}
                    </button>
                  )}
                  {wo.po && (
                    <button onClick={() => router.push('/finance/purchases/orders')}
                      className="btn btn-ghost" style={{ fontSize: '0.75rem' }}>
                      <ExternalLink style={{ width: '13px' }} /> المشتريات
                    </button>
                  )}
                  {workOrderNeedsServiceConfirm(wo) && wo.status === 'قيد التنفيذ' && (
                    <button onClick={() => handleConfirmService(wo)} disabled={busyId === wo.id}
                      className="btn btn-primary" style={{ fontSize: '0.75rem', background: '#1a56db' }}>
                      <CheckCircle style={{ width: '13px' }} /> تأكيد استلام الخدمة
                    </button>
                  )}
                  {canCreateInvoice(wo) && (
                    <button onClick={() => router.push(`/finance/purchases/invoices?convertPoId=${wo.po!.id}`)}
                      className="btn btn-ghost" style={{ fontSize: '0.75rem', border: '1px solid #fecaca', color: '#c81e1e' }}>
                      <FileText style={{ width: '13px' }} /> {wo.source === 'داخلي' ? 'فاتورة قطع' : 'إنشاء فاتورة'}
                    </button>
                  )}
                  {wo.status === 'مفتوح' && (
                    <button onClick={() => supabase.from('fleet_work_orders').update({ status: 'قيد التنفيذ' }).eq('id', wo.id).then(load)}
                      className="btn btn-ghost" style={{ fontSize: '0.75rem' }}>بدء التنفيذ</button>
                  )}
                  {wo.status === 'قيد التنفيذ' && (
                    <button onClick={() => updateStatus(wo, 'مكتمل')} className="btn btn-primary" style={{ fontSize: '0.75rem', background: '#0ea77b' }}>إغلاق</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {activeOrders.length === 0 && (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>لا توجد أوامر نشطة — أنشئ أمر عمل جديد</p>
          )}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['رقم الأمر', 'المعدة', 'النوع', 'المسار', 'الوصف', 'الإغلاق', 'الإجمالي', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {completedOrders.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد صيانات منجزة</td></tr>
              )}
              {completedOrders.map(wo => (
                <tr key={wo.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0d9488' }}>{wo.wo_no}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{wo.unit?.fleet_no}<br /><span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{wo.unit?.name}</span></td>
                  <td style={{ padding: '10px 12px' }}>{wo.wo_type}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.78rem' }}>{wo.source}</td>
                  <td style={{ padding: '10px 12px', maxWidth: '220px' }}>{wo.description}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{formatDate(wo.completed_at)}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, direction: 'ltr', textAlign: 'right' }}>{fmt(wo.total_cost || calcWorkOrderTotal(wo))} ر.س</td>
                  <td style={{ padding: '10px 8px' }}>
                    <button onClick={() => setEditWo(wo)} className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '4px 8px' }}>
                      <Pencil style={{ width: '12px' }} /> تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && tenant && (
        <WOModal units={units} vendors={vendors} tenantId={tenant.id} createdBy={currentUser?.name}
          onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />
      )}
      {completeWo && tenant && (
        <CompleteInternalModal wo={completeWo} cashAccounts={cashAccounts} tenantId={tenant.id}
          onClose={() => setCompleteWo(null)} onDone={() => { setCompleteWo(null); load() }} />
      )}
      {partsPoWo && tenant && (
        <PartsPOModal wo={partsPoWo} vendors={vendors} tenantId={tenant.id} createdBy={currentUser?.name}
          onClose={() => setPartsPoWo(null)} onDone={() => { setPartsPoWo(null); load() }} />
      )}
      {editWo && (
        <EditWOModal wo={editWo} onClose={() => setEditWo(null)} onDone={() => { setEditWo(null); load() }} />
      )}
    </div>
  )
}
