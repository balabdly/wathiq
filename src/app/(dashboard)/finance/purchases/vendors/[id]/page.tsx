'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { ArrowRight, TrendingUp } from 'lucide-react'

type Vendor = {
  id: number; name: string; name_en?: string
  vat_number?: string; cr_number?: string; vendor_type: string
  city?: string; district?: string; street?: string; postal_code?: string
  country?: string; phone?: string; email?: string
  contact_person?: string; iban?: string; is_active: boolean; notes?: string
}

type VendorInvoice = {
  id: number; invoice_number: string; invoice_date: string
  due_date?: string; subtotal: number; vat_amount: number
  total_amount: number; status: string; delivery_to?: string
}

type PurchaseReturn = {
  id: number; return_number: string; return_date: string
  return_type: string; total_amount: number; reason?: string; status: string
  original_invoice_id?: number
}

type Statement = {
  date: string; type: string; reference: string
  debit: number; credit: number; balance: number; description: string
}

export default function VendorProfilePage() {
  const { tenant } = useStore()
  const router   = useRouter()
  const params   = useParams()
  const vendorId = Number(params.id)

  const [vendor,    setVendor]    = useState<Vendor | null>(null)
  const [invoices,  setInvoices]  = useState<VendorInvoice[]>([])
  const [returns,   setReturns]   = useState<PurchaseReturn[]>([])
  const [payments,  setPayments]  = useState<any[]>([])
  const [statement, setStatement] = useState<Statement[]>([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'statement' | 'invoices' | 'returns' | 'stats'>('statement')

  useEffect(() => { if (tenant && vendorId) loadAll() }, [tenant?.id, vendorId])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)

    const [venRes, invRes, retRes] = await Promise.all([
      supabase.from('finance_vendors').select('*').eq('id', vendorId).single(),
      supabase.from('finance_vendor_invoices').select('*').eq('tenant_id', tenant.id).eq('vendor_id', vendorId).order('invoice_date', { ascending: false }),
      supabase.from('finance_purchase_returns').select('*').eq('tenant_id', tenant.id).eq('vendor_id', vendorId).order('return_date', { ascending: false }),
    ])

    setVendor(venRes.data)
    const invData = invRes.data || []
    const retData = retRes.data || []
    setInvoices(invData)
    setReturns(retData)

    // الدفعات: من قيود دفع المورد المرتبطة بفواتيره (يلتقط الدفع الجزئي بدقة)
    const invIds = invData.map((i: any) => i.id)
    let payData: any[] = []
    if (invIds.length) {
      const { data } = await supabase.from('finance_journal_entries')
        .select('entry_number, entry_date, total_debit, reference_id')
        .eq('tenant_id', tenant.id).eq('reference_type', 'دفع مورد').in('reference_id', invIds)
      payData = data || []
    }
    setPayments(payData)

    // ══ كشف الحساب: فاتورة (له) — مرتجع معتمد / دفعة (عليه) ══
    const invMap: Record<number, string> = {}
    invData.forEach((i: any) => { invMap[i.id] = i.invoice_number })

    const allEntries = [
      ...invData
        .filter((i: any) => i.status !== 'مسودة')
        .map((i: any) => ({ date: i.invoice_date, type: 'فاتورة', ref: i.invoice_number, amount: Number(i.total_amount), isCredit: true, desc: `فاتورة ${i.invoice_number}` })),
      ...retData
        .filter((r: any) => r.status === 'معتمد')
        .map((r: any) => ({ date: r.return_date, type: 'مرتجع', ref: r.return_number, amount: Number(r.total_amount), isCredit: false, desc: r.original_invoice_id ? `مرتجع على ${invMap[r.original_invoice_id] || ''}` : `مرتجع ${r.return_number}` })),
      ...payData
        .map((p: any) => ({ date: p.entry_date, type: 'دفعة', ref: p.entry_number, amount: Number(p.total_debit), isCredit: false, desc: p.reference_id ? `سداد ${invMap[p.reference_id] || ''}` : 'دفعة' })),
    ].sort((a, b) => a.date.localeCompare(b.date))

    let runningBalance = 0
    const entries: Statement[] = []
    for (const e of allEntries) {
      if (e.isCredit) runningBalance += e.amount
      else            runningBalance -= e.amount
      entries.push({
        date: e.date, type: e.type, reference: e.ref,
        credit: e.isCredit ? e.amount : 0,
        debit:  e.isCredit ? 0 : e.amount,
        balance: runningBalance,
        description: e.desc,
      })
    }
    setStatement(entries)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!vendor) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p style={{ color: '#9ca3af' }}>المورد غير موجود</p>
      <button onClick={() => router.back()} className="btn btn-primary" style={{ marginTop: '16px' }}>رجوع</button>
    </div>
  )

  // ══ الإحصائيات ══
  const activeInvoices = invoices.filter(i => i.status !== 'مسودة')
  const totalInvoiced  = activeInvoices.reduce((s, i) => s + Number(i.total_amount), 0)
  const totalPaid      = payments.reduce((s, p) => s + Number(p.total_debit), 0)
  const totalReturned  = returns.filter(r => r.status === 'معتمد').reduce((s, r) => s + Number(r.total_amount), 0)
  const balance        = totalInvoiced - totalPaid - totalReturned
  const paymentRate    = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0
  const avgInvoice     = activeInvoices.length > 0 ? Math.round(totalInvoiced / activeInvoices.length) : 0
  const maxInvoice     = activeInvoices.length > 0 ? Math.max(...activeInvoices.map(i => Number(i.total_amount))) : 0
  const lastInvoice    = invoices[0]?.invoice_date || '—'
  const today          = new Date().toISOString().split('T')[0]
  const overdueCount   = invoices.filter(i => !['مدفوعة', 'مرتجعة', 'مسودة'].includes(i.status) && i.due_date && i.due_date < today).length

  const TABS = [
    { id: 'statement', label: '📊 كشف الحساب',   color: '#1a56db' },
    { id: 'invoices',  label: '🧾 الفواتير',      color: '#c81e1e' },
    { id: 'returns',   label: '↩️ المرتجعات',    color: '#6b7280' },
    { id: 'stats',     label: '📈 الإحصائيات',   color: '#e6820a' },
    { id: 'info',      label: '🏭 بيانات المورد', color: '#374151' },
  ]

  const INV_BADGE: Record<string, string> = { 'مدفوعة': 'badge-green', 'معتمدة': 'badge-blue', 'مدفوعة جزئياً': 'badge-amber', 'مرتجعة': 'badge-red', 'مسودة': 'badge-gray' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => router.back()}
          style={{ padding: '8px', borderRadius: '10px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text3)', fontSize: '0.82rem' }}>
          <ArrowRight style={{ width: '16px', height: '16px' }} /> رجوع
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#1a56db', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.3rem', fontWeight: 800 }}>
              {vendor.name.charAt(0)}
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a2e' }}>{vendor.name}</h1>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{vendor.vendor_type}</span>
                {vendor.vat_number && <span style={{ fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'monospace' }}>ض.ق.م: {vendor.vat_number}</span>}
                {vendor.city && <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>📍 {vendor.city}</span>}
                {vendor.phone && <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>📞 {vendor.phone}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي الفواتير',       value: totalInvoiced, color: '#c81e1e', bg: '#fef2f2' },
          { label: 'إجمالي المدفوع',        value: totalPaid,     color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'المرتجعات المعتمدة',    value: totalReturned, color: '#6b7280', bg: '#f3f4f6' },
          { label: 'الرصيد المستحق له',     value: balance,       color: balance > 0 ? '#c81e1e' : '#0ea77b', bg: balance > 0 ? '#fef2f2' : '#ecfdf5' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px 16px', background: kpi.bg }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.value.toLocaleString()} <span style={{ fontSize: '0.72rem', fontWeight: 400 }}>ر.س</span></div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* التابات */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            style={{ padding: '7px 14px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === t.id ? t.color : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: activeTab === t.id ? '0 2px 8px ' + t.color + '44' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ كشف الحساب ══ */}
      {activeTab === 'statement' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>كشف حساب — {vendor.name}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>{statement.length} حركة</div>
          </div>
          {statement.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد حركات بعد</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['التاريخ', 'النوع', 'المرجع', 'البيان', 'له (فواتير)', 'عليه (دفع/مرتجع)', 'الرصيد'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statement.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{s.date}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px', fontWeight: 600,
                          background: s.type === 'فاتورة' ? '#fef2f2' : s.type === 'دفعة' ? '#ecfdf5' : '#fffbeb',
                          color:      s.type === 'فاتورة' ? '#c81e1e' : s.type === 'دفعة' ? '#0ea77b' : '#e6820a' }}>
                          {s.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text3)' }}>{s.reference}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{s.description}</td>
                      <td style={{ padding: '10px 14px', color: '#c81e1e', fontWeight: s.credit > 0 ? 700 : 400, direction: 'ltr', textAlign: 'left' }}>
                        {s.credit > 0 ? s.credit.toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#0ea77b', fontWeight: s.debit > 0 ? 700 : 400, direction: 'ltr', textAlign: 'left' }}>
                        {s.debit > 0 ? s.debit.toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, direction: 'ltr', textAlign: 'left', color: s.balance > 0 ? '#c81e1e' : '#0ea77b' }}>
                        {s.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '3px solid #1a56db', background: '#eff6ff', fontWeight: 800 }}>
                    <td colSpan={4} style={{ padding: '12px 14px', color: '#1a56db' }}>الرصيد المستحق للمورد</td>
                    <td style={{ padding: '12px 14px', color: '#c81e1e', direction: 'ltr', textAlign: 'left' }}>{statement.reduce((s, e) => s + e.credit, 0).toLocaleString()}</td>
                    <td style={{ padding: '12px 14px', color: '#0ea77b', direction: 'ltr', textAlign: 'left' }}>{statement.reduce((s, e) => s + e.debit, 0).toLocaleString()}</td>
                    <td style={{ padding: '12px 14px', direction: 'ltr', textAlign: 'left', color: balance > 0 ? '#c81e1e' : '#0ea77b', fontSize: '1.1rem' }}>{balance.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ الفواتير ══ */}
      {activeTab === 'invoices' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {invoices.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد فواتير</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['رقم الفاتورة', 'التاريخ', 'الاستحقاق', 'الوجهة', 'المجموع', 'ض.ق.م', 'الإجمالي', 'الحالة'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const isOverdue = !['مدفوعة', 'مرتجعة', 'مسودة'].includes(inv.status) && inv.due_date && inv.due_date < today
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#c81e1e' }}>{inv.invoice_number}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{inv.invoice_date}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: isOverdue ? '#c81e1e' : 'inherit' }}>{inv.due_date || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{inv.delivery_to || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{Number(inv.subtotal).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px', color: '#e6820a' }}>{Number(inv.vat_amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#c81e1e' }}>{Number(inv.total_amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={'badge ' + (isOverdue ? 'badge-red' : INV_BADGE[inv.status] || 'badge-gray')}>{isOverdue ? 'متأخرة' : inv.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '10px 14px' }}>الإجمالي ({invoices.length})</td>
                  <td style={{ padding: '10px 14px' }}>{invoices.reduce((s, i) => s + Number(i.subtotal), 0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px', color: '#e6820a' }}>{invoices.reduce((s, i) => s + Number(i.vat_amount), 0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px', color: '#c81e1e' }}>{invoices.reduce((s, i) => s + Number(i.total_amount), 0).toLocaleString()} ر.س</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* ══ المرتجعات ══ */}
      {activeTab === 'returns' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {returns.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد مرتجعات</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['رقم المرتجع', 'النوع', 'التاريخ', 'السبب', 'الإجمالي', 'الحالة'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returns.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#6b7280' }}>{r.return_number}</td>
                    <td style={{ padding: '10px 14px' }}><span className="badge badge-gray" style={{ fontSize: '0.72rem' }}>{r.return_type}</span></td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{r.return_date}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{r.reason || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#6b7280' }}>{Number(r.total_amount).toLocaleString()} ر.س</td>
                    <td style={{ padding: '10px 14px' }}><span className={'badge ' + (r.status === 'معتمد' ? 'badge-green' : r.status === 'ملغي' ? 'badge-red' : 'badge-gray')}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ الإحصائيات ══ */}
      {activeTab === 'stats' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp style={{ width: '18px', height: '18px', color: '#e6820a' }} />
              إحصائيات التعامل
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'إجمالي الفواتير',     value: totalInvoiced.toLocaleString() + ' ر.س' },
                { label: 'إجمالي المدفوع',      value: totalPaid.toLocaleString() + ' ر.س' },
                { label: 'المرتجعات المعتمدة',  value: totalReturned.toLocaleString() + ' ر.س' },
                { label: 'الرصيد المستحق له',   value: balance.toLocaleString() + ' ر.س' },
                { label: 'نسبة السداد',          value: paymentRate + '%' },
                { label: 'عدد الفواتير',        value: invoices.length + ' فاتورة' },
                { label: 'متوسط قيمة الفاتورة', value: avgInvoice.toLocaleString() + ' ر.س' },
                { label: 'أكبر فاتورة',         value: maxInvoice.toLocaleString() + ' ر.س' },
                { label: 'فواتير متأخرة',       value: overdueCount + ' فاتورة' },
                { label: 'آخر فاتورة',          value: lastInvoice },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg2)', borderRadius: '8px', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text3)' }}>{s.label}</span>
                  <span style={{ fontWeight: 700 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontWeight: 700, marginBottom: '16px' }}>توزيع الفواتير حسب الحالة</div>
            {['مسودة', 'معتمدة', 'مدفوعة جزئياً', 'مدفوعة', 'مرتجعة'].map(status => {
              const count = invoices.filter(i => i.status === status).length
              const pct   = invoices.length > 0 ? Math.round((count / invoices.length) * 100) : 0
              const colors: Record<string, string> = { 'مدفوعة': '#0ea77b', 'معتمدة': '#1a56db', 'مسودة': '#9ca3af', 'مدفوعة جزئياً': '#e6820a', 'مرتجعة': '#c81e1e' }
              return (
                <div key={status} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span>{status}</span>
                    <span style={{ fontWeight: 600 }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: colors[status] || '#9ca3af', borderRadius: '4px', transition: 'width 0.3s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ بيانات المورد ══ */}
      {activeTab === 'info' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'اسم المورد (عربي)',     value: vendor.name },
              { label: 'اسم المورد (إنجليزي)',  value: vendor.name_en || '—' },
              { label: 'النوع',                  value: vendor.vendor_type },
              { label: 'الرقم الضريبي',          value: vendor.vat_number || '—' },
              { label: 'السجل التجاري',          value: vendor.cr_number || '—' },
              { label: 'رقم IBAN',               value: vendor.iban || '—' },
              { label: 'الهاتف',                 value: vendor.phone || '—' },
              { label: 'البريد الإلكتروني',      value: vendor.email || '—' },
              { label: 'شخص التواصل',            value: vendor.contact_person || '—' },
              { label: 'المدينة',                value: vendor.city || '—' },
              { label: 'الحي',                   value: vendor.district || '—' },
              { label: 'الشارع',                 value: vendor.street || '—' },
              { label: 'الرمز البريدي',          value: vendor.postal_code || '—' },
              { label: 'الحالة',                 value: vendor.is_active ? 'نشط' : 'موقوف' },
            ].map(f => (
              <div key={f.label} style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '3px' }}>{f.label}</div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }} dir={f.label === 'رقم IBAN' ? 'ltr' : undefined}>{f.value}</div>
              </div>
            ))}
          </div>
          {vendor.notes && (
            <div style={{ marginTop: '14px', padding: '12px 16px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.875rem' }}>
              <strong>ملاحظات:</strong> {vendor.notes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
