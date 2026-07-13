'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Wrench, ShoppingCart, CheckCircle, FileText, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { nextWorkOrderNo, fmt, unwrapJoin } from '@/lib/fleet-types'
import { FleetPageHeader } from '../FleetPageHeader'
import type { Vendor } from '@/lib/purchases-types'
import {
  fetchActiveVendors,
  createDraftPOFromWorkOrder,
  confirmWorkOrderService,
  postInternalWorkOrderJournal,
  calcWorkOrderTotal,
  FLEET_INTERNAL_LABOR_RATE,
} from '@/lib/fleet-procurement'

type Unit = { id: number; fleet_no: string; name: string }
type CashAccount = { id: number; name: string; account_type: string; account_id?: number }
type WorkOrder = {
  id: number; unit_id: number; wo_no: string; wo_type: string; source: string; status: string
  priority: string; description: string; opened_at: string; project_id?: number
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
              </select></div>
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

function CompleteInternalModal({ wo, cashAccounts, tenantId, onClose, onDone }: {
  wo: WorkOrder; cashAccounts: CashAccount[]; tenantId: string
  onClose: () => void; onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [cashId, setCashId] = useState('')
  const total = calcWorkOrderTotal(wo)

  async function handleComplete() {
    if (total > 0 && !cashId) { toast.error('اختر حساب الدفع للقيد المحاسبي'); return }
    setSaving(true)
    try {
      if (total > 0) {
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
          amount: total,
          cashAccountId: Number(cashId),
          cashAccountCode: accRow.code,
        })
        if (!ok) { toast.error('⚠️ فشل القيد المحاسبي — راجع شجرة الحسابات'); setSaving(false); return }
      }
      await supabase.from('fleet_work_orders').update({
        status: 'مكتمل',
        completed_at: new Date().toISOString(),
        total_cost: total,
      }).eq('id', wo.id)
      await supabase.from('fleet_units').update({ operational_status: 'متاح' }).eq('id', wo.unit_id)
      toast.success(total > 0 ? '✅ أُغلق أمر العمل مع القيد المحاسبي' : '✅ أُغلق أمر العمل')
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
            الإجمالي: <strong>{fmt(total)} ر.س</strong> (ساعات × {FLEET_INTERNAL_LABOR_RATE} + قطع + خارجي)
          </p>
          {total > 0 && (
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
  const [filter, setFilter] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => { if (tenant) load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [woRes, uRes, vRes, cRes] = await Promise.all([
      supabase.from('fleet_work_orders').select(`
        *,
        unit:fleet_units(fleet_no,name),
        vendor:finance_vendors(id,name),
        po:finance_purchase_orders(id,po_number,status),
        vendor_invoice:finance_vendor_invoices(id,invoice_number,status)
      `).eq('tenant_id', tenant.id).order('opened_at', { ascending: false }).limit(100),
      supabase.from('fleet_units').select('id,fleet_no,name').eq('tenant_id', tenant.id).eq('is_active', true),
      fetchActiveVendors(tenant.id),
      supabase.from('finance_cash_accounts').select('id,name,account_type,account_id')
        .eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
    ])
    setOrders((woRes.data || []).map(row => ({
      ...row,
      unit: unwrapJoin((row as { unit?: Unit | Unit[] }).unit),
      vendor: unwrapJoin((row as { vendor?: { id: number; name: string } | { id: number; name: string }[] }).vendor),
      po: unwrapJoin((row as { po?: WorkOrder['po'] | WorkOrder['po'][] }).po),
      vendor_invoice: unwrapJoin((row as { vendor_invoice?: WorkOrder['vendor_invoice'] | WorkOrder['vendor_invoice'][] }).vendor_invoice),
    })) as WorkOrder[])
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
    if (!tenant || !wo.vendor_id) { toast.error('المورد مطلوب'); return }
    if (wo.po_id) { toast.error('يوجد أمر شراء مرتبط'); return }
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

  async function handleConfirmService(wo: WorkOrder) {
    setBusyId(wo.id)
    const ok = await confirmWorkOrderService(wo.id)
    setBusyId(null)
    if (!ok) { toast.error('فشل التأكيد'); return }
    toast.success('✅ تم تأكيد استلام الخدمة')
    load()
  }

  const filtered = orders.filter(o => !filter || o.status === filter)
  const openCount = orders.filter(o => ['مفتوح', 'قيد التنفيذ'].includes(o.status)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <FleetPageHeader title="صيانة الأسطول" description="أوامر عمل — داخلي (قيد مباشر) | خارجي (طلب شراء → فاتورة)" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <span style={{ fontSize: '0.82rem', color: '#9ca3af' }}>{openCount} أمر مفتوح</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="select" style={{ width: '140px' }}>
            <option value="">الكل</option>
            <option>مفتوح</option><option>قيد التنفيذ</option><option>مكتمل</option>
          </select>
          <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ background: '#0d9488' }}>
            <Plus style={{ width: '16px' }} /> أمر عمل
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(wo => (
            <div key={wo.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <Wrench style={{ width: '16px', color: '#e6820a' }} />
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488' }}>{wo.wo_no}</span>
                    <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: wo.wo_type === 'CM' ? '#fef2f2' : '#fffbeb', color: wo.wo_type === 'CM' ? '#c81e1e' : '#e6820a', fontWeight: 700 }}>{wo.wo_type}</span>
                    <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: wo.source === 'خارجي' ? '#eff6ff' : '#f3f4f6', color: wo.source === 'خارجي' ? '#1a56db' : '#6b7280', fontWeight: 600 }}>{wo.source}</span>
                    {wo.journal_posted_at && <span style={{ fontSize: '0.68rem', color: '#0ea77b', fontWeight: 600 }}>✓ مُرحّل محاسبياً</span>}
                  </div>
                  <div style={{ fontWeight: 600, marginTop: '4px' }}>{wo.unit?.name} — {wo.description}</div>
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

              {wo.status !== 'مكتمل' && wo.status !== 'ملغي' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginTop: '12px' }}>
                  <div><label style={{ fontSize: '0.68rem', color: '#9ca3af' }}>ساعات عمالة</label>
                    <input type="number" defaultValue={wo.labor_hours} onBlur={e => updateCosts(wo, 'labor_hours', Number(e.target.value))} className="input" dir="ltr" style={{ padding: '6px' }} /></div>
                  <div><label style={{ fontSize: '0.68rem', color: '#9ca3af' }}>قطع غيار</label>
                    <input type="number" defaultValue={wo.parts_cost} onBlur={e => updateCosts(wo, 'parts_cost', Number(e.target.value))} className="input" dir="ltr" style={{ padding: '6px' }} /></div>
                  <div><label style={{ fontSize: '0.68rem', color: '#9ca3af' }}>تكلفة خارجي (تقدير PO)</label>
                    <input type="number" defaultValue={wo.external_cost} onBlur={e => updateCosts(wo, 'external_cost', Number(e.target.value))} className="input" dir="ltr" style={{ padding: '6px' }} disabled={wo.source === 'داخلي'} /></div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>الإجمالي: {fmt(calcWorkOrderTotal(wo))} ر.س</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {wo.source === 'خارجي' && !wo.po_id && wo.status !== 'مكتمل' && (
                    <button onClick={() => handleCreatePO(wo)} disabled={busyId === wo.id}
                      className="btn btn-ghost" style={{ fontSize: '0.75rem', border: '1px solid #fde68a', color: '#e6820a' }}>
                      <ShoppingCart style={{ width: '13px' }} /> طلب شراء
                    </button>
                  )}
                  {wo.po && (
                    <button onClick={() => router.push('/finance/purchases/orders')}
                      className="btn btn-ghost" style={{ fontSize: '0.75rem' }}>
                      <ExternalLink style={{ width: '13px' }} /> المشتريات
                    </button>
                  )}
                  {wo.source === 'خارجي' && wo.po && !wo.service_confirmed_at && wo.status === 'قيد التنفيذ' && (
                    <button onClick={() => handleConfirmService(wo)} disabled={busyId === wo.id}
                      className="btn btn-primary" style={{ fontSize: '0.75rem', background: '#1a56db' }}>
                      <CheckCircle style={{ width: '13px' }} /> تأكيد استلام الخدمة
                    </button>
                  )}
                  {wo.source === 'خارجي' && wo.po && wo.service_confirmed_at && wo.po.status !== 'مسودة' && !wo.vendor_invoice_id && (
                    <button onClick={() => router.push(`/finance/purchases/invoices?convertPoId=${wo.po!.id}`)}
                      className="btn btn-ghost" style={{ fontSize: '0.75rem', border: '1px solid #fecaca', color: '#c81e1e' }}>
                      <FileText style={{ width: '13px' }} /> إنشاء فاتورة
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
          {filtered.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>لا توجد أوامر عمل</p>}
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
    </div>
  )
}
