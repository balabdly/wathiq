// src/app/(dashboard)/finance/purchases/debitnotes/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Trash2, Search, FileText, Eye, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { createJournalEntry, nextDocNumber } from '@/lib/journal'
import { useStore } from '@/hooks/useStore'
import { usePurchases } from '../PurchasesContext'
import type { DebitNote, VendorInvoice, POItem, Vendor } from '@/lib/purchases-types'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }

function ItemsTable({ items, onChange }: { items: POItem[]; onChange: (items: POItem[]) => void }) {
  function update(idx: number, k: keyof POItem, v: any) {
    const next = [...items]
    next[idx] = { ...next[idx], [k]: v }
    if (k === 'quantity' || k === 'unit_price') next[idx].total = Number(next[idx].quantity) * Number(next[idx].unit_price)
    onChange(next)
  }
  function add()               { onChange([...items, { description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }]) }
  function remove(idx: number) { if (items.length > 1) onChange(items.filter((_, i) => i !== idx)) }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151' }}>البنود</label>
        <button type="button" onClick={add} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
          <Plus style={{ width: '13px', height: '13px' }} /> إضافة بند
        </button>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead><tr style={{ background: 'var(--bg2)' }}>{['الوصف', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي', ''].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 8px', minWidth: '180px' }}><input value={item.description} onChange={e => update(idx, 'description', e.target.value)} onMouseDown={e => e.stopPropagation()} style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }} placeholder="وصف المادة أو الخدمة" /></td>
                <td style={{ padding: '6px 8px' }}><input type="number" value={item.quantity} onChange={e => update(idx, 'quantity', e.target.value)} onMouseDown={e => e.stopPropagation()} style={{ width: '70px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" /></td>
                <td style={{ padding: '6px 8px' }}><select value={item.unit} onChange={e => update(idx, 'unit', e.target.value)} style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}>{['وحدة', 'م²', 'م طولي', 'طن', 'كجم', 'لتر', 'يوم', 'ساعة', 'مقطوعة'].map(u => <option key={u}>{u}</option>)}</select></td>
                <td style={{ padding: '6px 8px' }}><input type="number" value={item.unit_price} onChange={e => update(idx, 'unit_price', e.target.value)} onMouseDown={e => e.stopPropagation()} style={{ width: '100px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" /></td>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{Number(item.total).toLocaleString()} ر.س</td>
                <td style={{ padding: '6px 8px' }}><button type="button" onClick={() => remove(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}><Trash2 style={{ width: '14px', height: '14px' }} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TotalsBox({ subtotal, vatRate, vatAmount, total }: { subtotal: number; vatRate: number; vatAmount: number; total: number }) {
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>المجموع قبل الضريبة</span><span style={{ fontWeight: 600 }}>{subtotal.toLocaleString()} ر.س</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>ضريبة القيمة المضافة ({vatRate}%)</span><span style={{ fontWeight: 600, color: '#e6820a' }}>{vatAmount.toLocaleString()} ر.س</span></div>
        <div style={{ borderTop: '2px solid #fde68a', paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>الإجمالي</span><span style={{ fontWeight: 700, fontSize: '1.3rem', color: '#e6820a' }}>{total.toLocaleString()} ر.س</span>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// مودال: إنشاء/تعديل إشعار مدين
// ════════════════════════════════════════
function DebitNoteModal({ note, vendors, vendorInvoices, tenantId, onClose, onSave }: {
  note: DebitNote | null; vendors: Vendor[]; vendorInvoices: VendorInvoice[]; tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<POItem[]>([{ description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }])
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    note_number: note?.note_number || '', note_date: note?.note_date || today,
    original_invoice_id: note?.original_invoice_id ? String(note.original_invoice_id) : '',
    vendor_id: note?.vendor_id ? String(note.vendor_id) : '',
    vat_rate: note?.vat_rate ?? 15, reason: note?.reason || '', notes: note?.notes || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (note) {
      supabase.from('finance_debit_note_items').select('*').eq('note_id', note.id).order('id')
        .then(({ data }) => { if (data && data.length > 0) setItems(data.map((i: any) => ({ ...i, id: undefined }))) })
    } else {
      generateNumber()
    }
  }, [])

  async function generateNumber() {
    set('note_number', (await nextDocNumber(tenantId, 'DN', 'DN')) || `DN-${new Date().getFullYear()}-0001`)
  }

  function handleInvoiceSelect(invId: string) {
    set('original_invoice_id', invId)
    const inv = vendorInvoices.find(i => i.id === Number(invId))
    if (inv) { set('vendor_id', String(inv.vendor_id)); set('vat_rate', inv.vat_rate ?? 15) }
  }

  const selectedVendor  = vendors.find(v => v.id === Number(form.vendor_id))
  const selectedInvoice = vendorInvoices.find(i => i.id === Number(form.original_invoice_id))
  const subtotal  = items.reduce((s, i) => s + Number(i.total), 0)
  const vatAmount = Math.round(subtotal * (Number(form.vat_rate) / 100) * 100) / 100
  const total     = subtotal + vatAmount

  async function handleSave() {
    if (!form.note_number.trim()) { toast.error('رقم الإشعار مطلوب'); return }
    if (!form.vendor_id) { toast.error('اختر المورد'); return }
    if (!form.reason.trim()) { toast.error('سبب الإشعار مطلوب'); return }
    if (items.every(i => !i.description.trim())) { toast.error('أضف بنداً واحداً على الأقل'); return }
    setSaving(true)

    let finalNoteNumber = form.note_number.trim()
    if (!note && /^DN-\d{4}-\d{4}$/.test(finalNoteNumber)) {
      finalNoteNumber = (await nextDocNumber(tenantId, 'DN', 'DN')) || finalNoteNumber
    }

    if (form.original_invoice_id) {
      const invId = Number(form.original_invoice_id)
      const [{ data: origInv }, { data: prevNotes }] = await Promise.all([
        supabase.from('finance_vendor_invoices').select('total_amount').eq('id', invId).single(),
        supabase.from('finance_debit_notes').select('total_amount').eq('tenant_id', tenantId).eq('original_invoice_id', invId).eq('status', 'معتمد'),
      ])
      const origTotal = Number(origInv?.total_amount || 0)
      const prevTotal = (prevNotes || []).reduce((s: number, n: any) => s + Number(n.total_amount), 0)
      const available = origTotal - prevTotal
      if (origTotal > 0 && total > available + 0.01) {
        toast.error(
          prevTotal > 0
            ? `⛔ الفاتورة قيمتها ${origTotal.toLocaleString()} ر.س وعليها إشعارات معتمدة بـ ${prevTotal.toLocaleString()} ر.س — المتاح: ${Math.max(0, available).toLocaleString()} ر.س فقط`
            : `⛔ مبلغ الإشعار (${total.toLocaleString()} ر.س) يتجاوز قيمة الفاتورة (${origTotal.toLocaleString()} ر.س)`,
          { duration: 6000 })
        setSaving(false); return
      }
    }

    const payload = {
      tenant_id: tenantId, note_number: finalNoteNumber, note_date: form.note_date,
      original_invoice_id: form.original_invoice_id ? Number(form.original_invoice_id) : null,
      invoice_number: selectedInvoice?.invoice_number || null,
      vendor_id: Number(form.vendor_id), vendor_name: selectedVendor!.name, vendor_vat: selectedVendor!.vat_number || null,
      subtotal, vat_amount: vatAmount, total_amount: total, vat_rate: Number(form.vat_rate),
      reason: form.reason, notes: form.notes || null,
      ...(note ? {} : { created_by: useStore.getState().currentUser?.name || null }),
    }

    let noteId = note?.id
    if (note) {
      await supabase.from('finance_debit_notes').update(payload).eq('id', note.id)
      await supabase.from('finance_debit_note_items').delete().eq('note_id', note.id)
    } else {
      const { data, error } = await supabase.from('finance_debit_notes').insert({ ...payload, status: 'مسودة' }).select('id').single()
      if (error || !data) { toast.error('خطأ: ' + (error?.message || '')); setSaving(false); return }
      noteId = data.id
    }

    const validItems = items.filter(i => i.description.trim())
    if (validItems.length > 0 && noteId) {
      await supabase.from('finance_debit_note_items').insert(validItems.map(i => ({ note_id: noteId, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price), total: Number(i.total) })))
    }

    // لا ترحيل هنا — القيد فقط عند الاعتماد
    toast.success(note ? '✅ تم تعديل الإشعار' : '✅ تم حفظ الإشعار كمسودة — اعتمده من الجدول لترحيل القيد')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
            {note ? 'تعديل إشعار مدين' : 'إشعار مدين جديد'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px 14px', background: '#f5f3ff', borderRadius: '8px', fontSize: '0.78rem', color: '#5b21b6' }}>
            📑 الإشعار المدين: مستند رسمي نصححه للمورد لتخفيض المستحق (خطأ سعر/كمية، خصم متفق عليه) — دون التلاعب بالفاتورة الأصلية. متوافق مع اشتراط عدم إلغاء المستندات الضريبية الصادرة.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>رقم الإشعار</label><input value={form.note_number} onChange={e => set('note_number', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" dir="ltr" /></div>
            <div><label style={lbl}>التاريخ</label><input type="date" value={form.note_date} onChange={e => set('note_date', e.target.value)} className="input" /></div>
          </div>
          <div>
            <label style={lbl}>الفاتورة المرجعية (اختياري)</label>
            <select value={form.original_invoice_id} onChange={e => handleInvoiceSelect(e.target.value)} className="select">
              <option value="">— بدون ربط بفاتورة —</option>
              {vendorInvoices.map(i => <option key={i.id} value={i.id}>{i.invoice_number} — {i.vendor_name} ({Number(i.total_amount).toLocaleString()} ر.س)</option>)}
            </select>
          </div>
          <div><label style={lbl}>المورد *</label><select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} className="select" disabled={!!form.original_invoice_id}><option value="">— اختر المورد —</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
          <div><label style={lbl}>سبب الإشعار *</label><input value={form.reason} onChange={e => set('reason', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" placeholder="مثال: خطأ في سعر الوحدة بالفاتورة الأصلية..." /></div>
          <ItemsTable items={items} onChange={setItems} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
            <div><label style={lbl}>ملاحظات</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} onMouseDown={e => e.stopPropagation()} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
            <TotalsBox subtotal={subtotal} vatRate={Number(form.vat_rate)} vatAmount={vatAmount} total={total} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#7c3aed' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <FileText style={{ width: '15px', height: '15px' }} />}
            {note ? 'حفظ التعديل' : 'حفظ كمسودة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة
// ════════════════════════════════════════
export default function DebitNotesPage() {
  const { tenantId, vendors, reloadKpis } = usePurchases()
  const [debitNotes, setDebitNotes]   = useState<DebitNote[]>([])
  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoice[]>([]) // قائمة خفيفة للربط فقط
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showDebitModal, setShowDebitModal] = useState(false)
  const [editDebit, setEditDebit]           = useState<DebitNote | null>(null)
  const [viewDebit, setViewDebit]           = useState<{ note: any; items: any[]; loading: boolean } | null>(null)

  useEffect(() => { if (tenantId) { loadDebitNotes(); loadLightInvoices() } }, [tenantId])

  async function loadDebitNotes() {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('finance_debit_notes').select('*').eq('tenant_id', tenantId).order('note_date', { ascending: false }).limit(200)
    setDebitNotes(data || [])
    setLoading(false)
  }

  async function loadLightInvoices() {
    if (!tenantId) return
    const { data } = await supabase.from('finance_vendor_invoices').select('*').eq('tenant_id', tenantId).order('invoice_date', { ascending: false })
    setVendorInvoices(data || [])
  }

  async function openViewDebit(note: any) {
    setViewDebit({ note, items: [], loading: true })
    const { data } = await supabase.from('finance_debit_note_items').select('*').eq('note_id', note.id).order('id')
    setViewDebit({ note, items: data || [], loading: false })
  }

  async function approveDebitNote(note: any) {
    if (!confirm(`اعتماد الإشعار المدين ${note.note_number}؟\nسيُسجَّل القيد المحاسبي (تخفيض مستحق المورد) وينعكس على صافي الفاتورة.`)) return
    let origInv: any = null
    if (note.original_invoice_id) {
      const [{ data: inv }, { data: approved }] = await Promise.all([
        supabase.from('finance_vendor_invoices').select('id, total_amount, delivery_to, status').eq('id', note.original_invoice_id).single(),
        supabase.from('finance_debit_notes').select('total_amount').eq('tenant_id', tenantId).eq('original_invoice_id', note.original_invoice_id).eq('status', 'معتمد'),
      ])
      origInv = inv
      const prevApproved = (approved || []).reduce((s: number, n: any) => s + Number(n.total_amount), 0)
      const invTotal = Number(inv?.total_amount || 0)
      if (invTotal > 0 && prevApproved + Number(note.total_amount) > invTotal + 0.01) {
        toast.error(`⛔ الفاتورة ${invTotal.toLocaleString()} ر.س وعليها إشعارات معتمدة بـ ${prevApproved.toLocaleString()} ر.س — المتاح: ${Math.max(0, invTotal - prevApproved).toLocaleString()} ر.س فقط`, { duration: 7000 })
        return
      }
    }
    const creditCode = origInv?.delivery_to === 'مستودع' ? '1130' : origInv?.delivery_to === 'أصل ثابت' ? '1220' : '5120'
    const result = await createJournalEntry({
      tenantId: tenantId!, date: note.note_date, description: `إشعار مدين ${note.note_number} — ${note.vendor_name}`,
      referenceType: 'إشعار مدين', referenceId: note.id, source: 'آلي',
      lines: [
        { accountCode: '2110',     debit: Number(note.total_amount), credit: 0, description: `تخفيض مستحق ${note.vendor_name}` },
        { accountCode: creditCode, debit: 0, credit: Number(note.subtotal),     description: `إشعار مدين ${note.note_number}` },
        ...(Number(note.vat_amount) > 0 ? [{ accountCode: '2140', debit: 0, credit: Number(note.vat_amount), description: 'عكس ضريبة المدخلات' }] : []),
      ],
    })
    if (!result) { toast.error('تعذر ترحيل قيد الإشعار'); return }
    await supabase.from('finance_debit_notes').update({ status: 'معتمد' }).eq('id', note.id)
    if (origInv) {
      const { data: nowApproved } = await supabase.from('finance_debit_notes').select('total_amount').eq('tenant_id', tenantId).eq('original_invoice_id', origInv.id).eq('status', 'معتمد')
      const sumApproved = (nowApproved || []).reduce((s: number, n: any) => s + Number(n.total_amount), 0)
      if (sumApproved >= Number(origInv.total_amount) - 0.01) {
        await supabase.from('finance_vendor_invoices').update({ status: 'مرتجعة' }).eq('id', origInv.id)
      }
    }
    toast.success(`✅ اعتُمد الإشعار ${note.note_number} وسُجّل القيد ${result.entryNumber}`)
    loadDebitNotes(); reloadKpis()
  }

  async function deleteDebitNote(note: any) {
    if (!confirm(`حذف المسودة ${note.note_number}؟`)) return
    await supabase.from('finance_debit_note_items').delete().eq('note_id', note.id)
    await supabase.from('finance_debit_notes').delete().eq('id', note.id)
    toast.success('تم حذف المسودة')
    loadDebitNotes()
  }

  async function cancelDebitNote(note: any) {
    if (!confirm(`إلغاء الإشعار المعتمد ${note.note_number}؟\nسيُنشأ قيد عكسي يلغي أثره ويعيد مستحق المورد.`)) return
    const { data: entry } = await supabase.from('finance_journal_entries').select('id, total_debit').eq('tenant_id', tenantId).eq('reference_type', 'إشعار مدين').eq('reference_id', note.id).maybeSingle()
    if (entry) {
      const { data: lines } = await supabase.from('finance_journal_lines').select('account_id, debit, credit, description').eq('entry_id', entry.id)
      const jeNo = await nextDocNumber(tenantId!, 'JE', 'JE')
      if (!jeNo) { toast.error('فشل توليد رقم القيد'); return }
      const { data: rev } = await supabase.from('finance_journal_entries').insert({
        tenant_id: tenantId, entry_number: jeNo, entry_date: new Date().toISOString().split('T')[0],
        description: `قيد عكسي — إلغاء إشعار مدين ${note.note_number} — ${note.vendor_name}`,
        reference_type: 'إلغاء إشعار مدين', reference_id: note.id,
        total_debit: Number(entry.total_debit), total_credit: Number(entry.total_debit), status: 'معتمد', entry_source: 'آلي',
      }).select('id').single()
      if (rev) {
        await supabase.from('finance_journal_lines').insert((lines || []).map((l: any) => ({ entry_id: rev.id, account_id: l.account_id, debit: Number(l.credit), credit: Number(l.debit), description: `عكس: ${l.description || ''}` })))
      }
    }
    await supabase.from('finance_debit_notes').update({ status: 'ملغي' }).eq('id', note.id)
    if (note.original_invoice_id) {
      const [{ data: inv }, { data: stillApproved }] = await Promise.all([
        supabase.from('finance_vendor_invoices').select('id, total_amount, status').eq('id', note.original_invoice_id).single(),
        supabase.from('finance_debit_notes').select('total_amount').eq('tenant_id', tenantId).eq('original_invoice_id', note.original_invoice_id).eq('status', 'معتمد'),
      ])
      const sum = (stillApproved || []).reduce((s: number, n: any) => s + Number(n.total_amount), 0)
      if (inv?.status === 'مرتجعة' && sum < Number(inv.total_amount) - 0.01) {
        await supabase.from('finance_vendor_invoices').update({ status: 'معتمدة' }).eq('id', inv.id)
      }
    }
    toast.success(`✅ أُلغي الإشعار ${note.note_number}${entry ? ' وسُجّل القيد العكسي' : ''}`)
    loadDebitNotes(); reloadKpis()
  }

  const filtered = debitNotes.filter(n => !search || n.note_number.includes(search) || n.vendor_name.includes(search))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', maxWidth: '360px', flex: 1 }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الإشعار أو المورد..." className="input" style={{ paddingRight: '32px' }} />
        </div>
        <button onClick={() => { setEditDebit(null); setShowDebitModal(true) }} className="btn btn-primary" style={{ background: '#7c3aed' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> إشعار مدين
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
        : filtered.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد إشعارات مدينة</div>
        : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>{['رقم الإشعار', 'المورد', 'الفاتورة المرجعية', 'التاريخ', 'الإجمالي', 'السبب', 'الحالة', ''].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(n => (
                  <tr key={n.id} style={{ borderBottom: '1px solid var(--bg2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed' }}>{n.note_number}</div>
                      {n.created_by && <div style={{ fontSize: '0.62rem', color: '#9ca3af', marginTop: '1px' }}>👤 {n.created_by}</div>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{n.vendor_name}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{n.invoice_number || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{n.note_date}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#7c3aed' }}>{Number(n.total_amount).toLocaleString()} ر.س</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.reason || '—'}</td>
                    <td style={{ padding: '10px 14px' }}><span className={'badge ' + (n.status === 'معتمد' ? 'badge-green' : n.status === 'ملغي' ? 'badge-red' : 'badge-gray')}>{n.status}</span></td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => openViewDebit(n)} title="استعراض" style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}><Eye style={{ width: '13px', height: '13px' }} /></button>
                        {n.status === 'مسودة' && (
                          <>
                            <button onClick={() => { setEditDebit(n); setShowDebitModal(true) }} title="تعديل المسودة" style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280' }}><Pencil style={{ width: '13px', height: '13px' }} /></button>
                            <button onClick={() => approveDebitNote(n)} title="اعتماد وترحيل القيد" style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>✓ اعتماد</button>
                            <button onClick={() => deleteDebitNote(n)} title="حذف المسودة" style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer' }}><Trash2 style={{ width: '13px', height: '13px' }} /></button>
                          </>
                        )}
                        {n.status === 'معتمد' && <button onClick={() => cancelDebitNote(n)} title="إلغاء بقيد عكسي" style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#c81e1e', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>إلغاء</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>

      {showDebitModal && (
        <DebitNoteModal note={editDebit} vendors={vendors} vendorInvoices={vendorInvoices} tenantId={tenantId!}
          onClose={() => { setShowDebitModal(false); setEditDebit(null) }}
          onSave={() => { setShowDebitModal(false); setEditDebit(null); loadDebitNotes() }} />
      )}

      {viewDebit && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setViewDebit(null)}>
          <div className="modal-box" style={{ maxWidth: '620px', maxHeight: '85vh' }} onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>📑 إشعار مدين {viewDebit.note.note_number}</h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>
                  {viewDebit.note.vendor_name} · {viewDebit.note.note_date} · {viewDebit.note.status}
                  {viewDebit.note.invoice_number ? ` · مرجع: ${viewDebit.note.invoice_number}` : ''}
                  {viewDebit.note.reason ? ` · السبب: ${viewDebit.note.reason}` : ''}
                </p>
              </div>
              <button onClick={() => setViewDebit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
            </div>
            <div className="modal-body" style={{ padding: 0, overflowY: 'auto' }}>
              {viewDebit.loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem' }}>جاري التحميل...</div> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>{['البند', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي'].map(h => <th key={h} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {viewDebit.items.map((it: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg2)' }}>
                        <td style={{ padding: '8px 14px' }}>{it.description}</td>
                        <td style={{ padding: '8px 14px' }}>{Number(it.quantity).toLocaleString()}</td>
                        <td style={{ padding: '8px 14px', color: 'var(--text3)' }}>{it.unit}</td>
                        <td style={{ padding: '8px 14px', fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}>{Number(it.unit_price).toLocaleString()}</td>
                        <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontWeight: 600, direction: 'ltr', textAlign: 'left' }}>{Number(it.total).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ padding: '14px 16px', borderTop: '2px solid var(--border)', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>الإجمالي قبل الضريبة</span><span style={{ fontFamily: 'monospace' }}>{Number(viewDebit.note.subtotal).toLocaleString()} ر.س</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>الضريبة ({Number(viewDebit.note.vat_rate)}%)</span><span style={{ fontFamily: 'monospace' }}>{Number(viewDebit.note.vat_amount).toLocaleString()} ر.س</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.95rem', color: '#7c3aed' }}><span>الإجمالي</span><span style={{ fontFamily: 'monospace' }}>{Number(viewDebit.note.total_amount).toLocaleString()} ر.س</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
