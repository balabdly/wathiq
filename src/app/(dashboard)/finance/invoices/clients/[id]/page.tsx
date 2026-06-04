'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { ArrowRight, Users, FileText, RotateCcw, ClipboardList, TrendingUp, Eye, Printer } from 'lucide-react'

type Client = {
  id: number; name: string; name_en?: string
  vat_number?: string; cr_number?: string; client_type: string
  city?: string; district?: string; street?: string; postal_code?: string
  country?: string; phone?: string; email?: string
  contact_person?: string; is_active: boolean; notes?: string
}

type Invoice = {
  id: number; invoice_number: string; invoice_date: string
  due_date?: string; subtotal: number; vat_amount: number
  total_amount: number; status: string; extract_ref?: string
  project?: { name: string }
}

type CreditNote = {
  id: number; note_number: string; note_date: string
  note_type: string; total_amount: number; reason?: string; status: string
}

type Quotation = {
  id: number; quote_number: string; quote_date: string
  valid_until?: string; total_amount: number; status: string
}

type Statement = {
  date: string; type: string; reference: string
  debit: number; credit: number; balance: number; description: string
}

export default function ClientProfilePage() {
  const { tenant } = useStore()
  const router  = useRouter()
  const params  = useParams()
  const clientId = Number(params.id)

  const [client,     setClient]     = useState<Client | null>(null)
  const [invoices,   setInvoices]   = useState<Invoice[]>([])
  const [credits,    setCredits]    = useState<CreditNote[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [statement,  setStatement]  = useState<Statement[]>([])
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState<'info' | 'statement' | 'invoices' | 'credits' | 'quotes' | 'stats'>('statement')

  useEffect(() => { if (tenant && clientId) loadAll() }, [tenant?.id, clientId])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)

    const [clRes, invRes, cnRes, qtRes] = await Promise.all([
      supabase.from('finance_clients').select('*').eq('id', clientId).single(),
      supabase.from('finance_invoices').select('*, project:projects(name)').eq('tenant_id', tenant.id).eq('client_id', clientId).order('invoice_date', { ascending: false }),
      supabase.from('finance_credit_notes').select('*').eq('tenant_id', tenant.id).eq('client_id', clientId).order('note_date', { ascending: false }),
      supabase.from('finance_quotations').select('*').eq('tenant_id', tenant.id).eq('client_id', clientId).order('quote_date', { ascending: false }),
    ])

    setClient(clRes.data)
    const invData = invRes.data || []
    const cnData  = cnRes.data  || []
    setInvoices(invData)
    setCredits(cnData)
    setQuotations(qtRes.data || [])

    // بناء كشف الحساب
    const entries: Statement[] = []
    let runningBalance = 0

    // دمج الفواتير والإشعارات وترتيبها بالتاريخ
    const allEntries = [
      ...invData.map(i => ({ date: i.invoice_date, type: 'فاتورة', ref: i.invoice_number, amount: Number(i.total_amount), isDebit: true, desc: `فاتورة ${i.invoice_number}` })),
      ...invData.filter(i => i.status === 'مدفوعة').map(i => ({ date: i.invoice_date, type: 'دفعة', ref: i.invoice_number, amount: Number(i.total_amount), isDebit: false, desc: `تحصيل فاتورة ${i.invoice_number}` })),
      ...cnData.map(c => ({ date: c.note_date, type: 'إشعار دائن', ref: c.note_number, amount: Number(c.total_amount), isDebit: false, desc: `${c.note_type} ${c.note_number}` })),
    ].sort((a, b) => a.date.localeCompare(b.date))

    for (const e of allEntries) {
      if (e.isDebit) runningBalance += e.amount
      else           runningBalance -= e.amount
      entries.push({
        date: e.date, type: e.type, reference: e.ref,
        debit:   e.isDebit ? e.amount : 0,
        credit:  e.isDebit ? 0 : e.amount,
        balance: runningBalance,
        description: e.desc,
      })
    }

    setStatement(entries)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  if (!client) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p style={{ color: '#9ca3af' }}>العميل غير موجود</p>
      <button onClick={() => router.back()} className="btn btn-primary" style={{ marginTop: '16px' }}>رجوع</button>
    </div>
  )

  // إحصائيات
  const totalInvoiced  = invoices.reduce((s, i) => s + Number(i.total_amount), 0)
  const totalCollected = invoices.filter(i => i.status === 'مدفوعة').reduce((s, i) => s + Number(i.total_amount), 0)
  const totalCredited  = credits.reduce((s, c) => s + Number(c.total_amount), 0)
  const balance        = totalInvoiced - totalCollected - totalCredited
  const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0
  const avgInvoice     = invoices.length > 0 ? Math.round(totalInvoiced / invoices.length) : 0
  const maxInvoice     = invoices.length > 0 ? Math.max(...invoices.map(i => Number(i.total_amount))) : 0
  const lastInvoice    = invoices[0]?.invoice_date || '—'
  const today          = new Date().toISOString().split('T')[0]
  const overdueCount   = invoices.filter(i => i.status !== 'مدفوعة' && i.status !== 'ملغاة' && i.due_date && i.due_date < today).length

  const TABS = [
    { id: 'statement', label: '📊 كشف الحساب',    color: '#1a56db' },
    { id: 'invoices',  label: '🧾 الفواتير',       color: '#0ea77b' },
    { id: 'credits',   label: '↩️ الإشعارات',     color: '#c81e1e' },
    { id: 'quotes',    label: '📋 عروض الأسعار',  color: '#6b7280' },
    { id: 'stats',     label: '📈 الإحصائيات',    color: '#e6820a' },
    { id: 'info',      label: '👤 بيانات العميل', color: '#374151' },
  ]

  return (
    <div className="space-y-5 fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => router.back()}
          style={{ padding: '8px', borderRadius: '10px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text3)', fontSize: '0.82rem' }}>
          <ArrowRight style={{ width: '16px', height: '16px' }} /> رجوع
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#e6820a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.3rem', fontWeight: 800 }}>
              {client.name.charAt(0)}
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a2e' }}>{client.name}</h1>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{client.client_type}</span>
                {client.vat_number && <span style={{ fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'monospace' }}>ض.ق.م: {client.vat_number}</span>}
                {client.city && <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>📍 {client.city}</span>}
                {client.phone && <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>📞 {client.phone}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي الفواتير',  value: totalInvoiced,  color: '#1a56db', bg: '#eff6ff' },
          { label: 'إجمالي المحصّل',   value: totalCollected, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'إجمالي الإشعارات', value: totalCredited,  color: '#6b7280', bg: '#f3f4f6' },
          { label: 'الرصيد المستحق',   value: balance,        color: balance > 0 ? '#c81e1e' : '#0ea77b', bg: balance > 0 ? '#fef2f2' : '#ecfdf5' },
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
            <div style={{ fontWeight: 700 }}>كشف حساب — {client.name}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>{statement.length} حركة</div>
          </div>
          {statement.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد حركات بعد</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['التاريخ', 'النوع', 'المرجع', 'البيان', 'مدين', 'دائن', 'الرصيد'].map(h => (
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
                          background: s.type === 'فاتورة' ? '#eff6ff' : s.type === 'دفعة' ? '#ecfdf5' : '#fef2f2',
                          color:      s.type === 'فاتورة' ? '#1a56db' : s.type === 'دفعة' ? '#0ea77b' : '#c81e1e' }}>
                          {s.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text3)' }}>{s.reference}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{s.description}</td>
                      <td style={{ padding: '10px 14px', color: '#1a56db', fontWeight: s.debit > 0 ? 700 : 400, direction: 'ltr', textAlign: 'left' }}>
                        {s.debit > 0 ? s.debit.toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#0ea77b', fontWeight: s.credit > 0 ? 700 : 400, direction: 'ltr', textAlign: 'left' }}>
                        {s.credit > 0 ? s.credit.toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, direction: 'ltr', textAlign: 'left', color: s.balance > 0 ? '#c81e1e' : '#0ea77b' }}>
                        {s.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '3px solid var(--primary)', background: '#eff6ff', fontWeight: 800 }}>
                    <td colSpan={4} style={{ padding: '12px 14px', color: 'var(--primary)' }}>الرصيد الختامي</td>
                    <td style={{ padding: '12px 14px', color: '#1a56db', direction: 'ltr', textAlign: 'left' }}>{statement.reduce((s,e)=>s+e.debit,0).toLocaleString()}</td>
                    <td style={{ padding: '12px 14px', color: '#0ea77b', direction: 'ltr', textAlign: 'left' }}>{statement.reduce((s,e)=>s+e.credit,0).toLocaleString()}</td>
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
                  {['رقم الفاتورة', 'التاريخ', 'الاستحقاق', 'المشروع', 'المجموع', 'ض.ق.م', 'الإجمالي', 'الحالة'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const isOverdue = inv.status !== 'مدفوعة' && inv.status !== 'ملغاة' && inv.due_date && inv.due_date < today
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#1a56db' }}>{inv.invoice_number}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{inv.invoice_date}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: isOverdue ? '#c81e1e' : 'inherit' }}>{inv.due_date || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{inv.project?.name || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{Number(inv.subtotal).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px', color: '#e6820a' }}>{Number(inv.vat_amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1a56db' }}>{Number(inv.total_amount).toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={'badge ' + (inv.status === 'مدفوعة' ? 'badge-green' : isOverdue ? 'badge-red' : inv.status === 'مرسلة' ? 'badge-blue' : 'badge-gray')}>{isOverdue ? 'متأخرة' : inv.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '10px 14px' }}>الإجمالي ({invoices.length})</td>
                  <td style={{ padding: '10px 14px' }}>{invoices.reduce((s,i)=>s+Number(i.subtotal),0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px', color: '#e6820a' }}>{invoices.reduce((s,i)=>s+Number(i.vat_amount),0).toLocaleString()} ر.س</td>
                  <td style={{ padding: '10px 14px', color: '#1a56db' }}>{totalInvoiced.toLocaleString()} ر.س</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* ══ الإشعارات الدائنة ══ */}
      {activeTab === 'credits' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {credits.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد إشعارات دائنة</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['رقم الإشعار', 'النوع', 'التاريخ', 'السبب', 'الإجمالي', 'الحالة'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {credits.map(cn => (
                  <tr key={cn.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#c81e1e' }}>{cn.note_number}</td>
                    <td style={{ padding: '10px 14px' }}><span className="badge badge-red" style={{ fontSize: '0.72rem' }}>{cn.note_type}</span></td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{cn.note_date}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{cn.reason || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#c81e1e' }}>{Number(cn.total_amount).toLocaleString()} ر.س</td>
                    <td style={{ padding: '10px 14px' }}><span className="badge badge-gray">{cn.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ عروض الأسعار ══ */}
      {activeTab === 'quotes' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {quotations.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد عروض أسعار</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['رقم العرض', 'التاريخ', 'صالح حتى', 'الإجمالي', 'الحالة'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotations.map(q => (
                  <tr key={q.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0ea77b' }}>{q.quote_number}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{q.quote_date}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: q.valid_until && q.valid_until < today ? '#c81e1e' : 'inherit' }}>{q.valid_until || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0ea77b' }}>{Number(q.total_amount).toLocaleString()} ر.س</td>
                    <td style={{ padding: '10px 14px' }}><span className={'badge ' + (q.status === 'مقبولة' ? 'badge-green' : q.status === 'مرفوضة' ? 'badge-red' : 'badge-gray')}>{q.status}</span></td>
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
              إحصائيات المبيعات
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'إجمالي الفواتير',     value: totalInvoiced.toLocaleString() + ' ر.س' },
                { label: 'إجمالي المحصّل',      value: totalCollected.toLocaleString() + ' ر.س' },
                { label: 'الرصيد المستحق',      value: balance.toLocaleString() + ' ر.س' },
                { label: 'معدل التحصيل',        value: collectionRate + '%' },
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
            {['مسودة', 'مرسلة', 'مدفوعة', 'إشعار جزئي', 'ملغاة'].map(status => {
              const count = invoices.filter(i => i.status === status).length
              const pct   = invoices.length > 0 ? Math.round((count / invoices.length) * 100) : 0
              const colors: Record<string, string> = { 'مدفوعة': '#0ea77b', 'مرسلة': '#1a56db', 'مسودة': '#9ca3af', 'إشعار جزئي': '#e6820a', 'ملغاة': '#c81e1e' }
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

      {/* ══ بيانات العميل ══ */}
      {activeTab === 'info' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'اسم العميل (عربي)',     value: client.name },
              { label: 'اسم العميل (إنجليزي)',  value: client.name_en || '—' },
              { label: 'النوع',                  value: client.client_type },
              { label: 'الرقم الضريبي',          value: client.vat_number || '—' },
              { label: 'السجل التجاري',          value: client.cr_number || '—' },
              { label: 'الهاتف',                 value: client.phone || '—' },
              { label: 'البريد الإلكتروني',      value: client.email || '—' },
              { label: 'شخص التواصل',            value: client.contact_person || '—' },
              { label: 'المدينة',                value: client.city || '—' },
              { label: 'الحي',                   value: client.district || '—' },
              { label: 'الشارع',                 value: client.street || '—' },
              { label: 'الرمز البريدي',          value: client.postal_code || '—' },
              { label: 'الدولة',                 value: client.country || '—' },
              { label: 'الحالة',                 value: client.is_active ? 'نشط' : 'موقوف' },
            ].map(f => (
              <div key={f.label} style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '3px' }}>{f.label}</div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{f.value}</div>
              </div>
            ))}
          </div>
          {client.notes && (
            <div style={{ marginTop: '14px', padding: '12px 16px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.875rem' }}>
              <strong>ملاحظات:</strong> {client.notes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
