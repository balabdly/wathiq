'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Search, Eye, Pencil, Plus, Users, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

type Client = {
  id: number; name: string; name_en?: string
  vat_number?: string; cr_number?: string; client_type: string
  city?: string; phone?: string; email?: string
  contact_person?: string; is_active: boolean
  total_invoiced?: number; total_collected?: number; balance?: number
  invoice_count?: number
}

export default function ClientsPage() {
  const { tenant } = useStore()
  const router = useRouter()
  const [clients,  setClients]  = useState<Client[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filterType,   setFilterType]   = useState('الكل')
  const [filterStatus, setFilterStatus] = useState('الكل')
  const [page, setPage] = useState(1)
  const PER_PAGE = 10

  useEffect(() => { loadClients() }, [tenant?.id])

  async function loadClients() {
    if (!tenant) return
    setLoading(true)

    const { data: clientsData } = await supabase
      .from('finance_clients')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('name')

    if (!clientsData) { setLoading(false); return }

    // نجلب إحصائيات كل عميل من الفواتير
    const { data: invoicesData } = await supabase
      .from('finance_invoices')
      .select('client_id, total_amount, status')
      .eq('tenant_id', tenant.id)

    const invoices = invoicesData || []

    const enriched = clientsData.map(c => {
      const clientInvs    = invoices.filter(i => i.client_id === c.id)
      const totalInvoiced = clientInvs.reduce((s, i) => s + Number(i.total_amount), 0)
      const totalCollected = clientInvs.filter(i => i.status === 'مدفوعة').reduce((s, i) => s + Number(i.total_amount), 0)
      return {
        ...c,
        total_invoiced:  totalInvoiced,
        total_collected: totalCollected,
        balance:         totalInvoiced - totalCollected,
        invoice_count:   clientInvs.length,
      }
    })

    setClients(enriched)
    setLoading(false)
  }

  // فلترة
  const filtered = clients.filter(c => {
    const matchSearch = !search || c.name.includes(search) || (c.vat_number || '').includes(search) || (c.phone || '').includes(search)
    const matchType   = filterType === 'الكل' || c.client_type === filterType
    const matchStatus = filterStatus === 'الكل' || (filterStatus === 'نشط' ? c.is_active : !c.is_active)
    return matchSearch && matchType && matchStatus
  })

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  // إحصائيات إجمالية
  const totalInvoiced  = clients.reduce((s, c) => s + (c.total_invoiced  || 0), 0)
  const totalCollected = clients.reduce((s, c) => s + (c.total_collected || 0), 0)
  const totalBalance   = clients.reduce((s, c) => s + (c.balance         || 0), 0)

  return (
    <div className="space-y-5 fade-in">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '20px', height: '20px', color: '#e6820a' }} />
            العملاء
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>
            إدارة العملاء — كشوف الحسابات — الفواتير
          </p>
        </div>
        <button onClick={() => router.push('/finance/invoices?tab=clients')} className="btn btn-primary" style={{ background: '#e6820a' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> عميل جديد
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي العملاء',   value: clients.length,                    color: '#374151', bg: '#f3f4f6', isCount: true },
          { label: 'إجمالي الفواتير',  value: totalInvoiced,                     color: '#1a56db', bg: '#eff6ff', isCount: false },
          { label: 'إجمالي المحصّل',   value: totalCollected,                    color: '#0ea77b', bg: '#ecfdf5', isCount: false },
          { label: 'الرصيد المستحق',   value: totalBalance,                      color: '#c81e1e', bg: '#fef2f2', isCount: false },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px 16px', background: kpi.bg }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>
              {kpi.isCount ? kpi.value : kpi.value.toLocaleString()}
              {!kpi.isCount && <span style={{ fontSize: '0.75rem', fontWeight: 400, marginRight: '4px' }}>ر.س</span>}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* نوع العميل */}
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }} className="select" style={{ width: 'auto' }}>
            <option value="الكل">كل الأنواع</option>
            {['شركة', 'مؤسسة', 'جهة حكومية', 'فرد'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {/* الحالة */}
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} className="select" style={{ width: 'auto' }}>
            <option value="الكل">كل الحالات</option>
            <option value="نشط">نشط</option>
            <option value="موقوف">موقوف</option>
          </select>
        </div>
        {/* بحث */}
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '15px', height: '15px', color: '#9ca3af', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className="input"
            style={{ paddingRight: '34px', width: '240px' }} placeholder="بحث بالاسم أو الرقم الضريبي..." />
        </div>
      </div>

      {/* الجدول */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Users style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af' }}>لا يوجد عملاء</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['العميل', 'النوع', 'الرقم الضريبي', 'الهاتف', 'المدينة', 'الفواتير', 'الإجمالي', 'المحصّل', 'الرصيد', 'الحالة', ''].map(h => (
                      <th key={h} style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(c => (
                    <tr key={c.id}
                      style={{ borderBottom: '1px solid var(--bg2)', cursor: 'pointer' }}
                      onClick={() => router.push(`/finance/invoices/clients/${c.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ fontWeight: 700 }}>{c.name}</div>
                        {c.contact_person && <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{c.contact_person}</div>}
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{c.client_type}</span>
                      </td>
                      <td style={{ padding: '12px 12px', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                        {c.vat_number
                          ? <span style={{ color: '#0ea77b' }}><CheckCircle style={{ width: '12px', height: '12px', display: 'inline', marginLeft: '4px' }} />{c.vat_number}</span>
                          : <span style={{ color: '#e6820a' }}><AlertCircle style={{ width: '12px', height: '12px', display: 'inline', marginLeft: '4px' }} />غير مُدخل</span>}
                      </td>
                      <td style={{ padding: '12px 12px', fontSize: '0.82rem' }}>{c.phone || '—'}</td>
                      <td style={{ padding: '12px 12px', fontSize: '0.82rem', color: 'var(--text3)' }}>{c.city || '—'}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 600, color: '#1a56db' }}>{c.invoice_count || 0}</td>
                      <td style={{ padding: '12px 12px', fontWeight: 600 }}>{(c.total_invoiced || 0).toLocaleString()} ر.س</td>
                      <td style={{ padding: '12px 12px', color: '#0ea77b', fontWeight: 600 }}>{(c.total_collected || 0).toLocaleString()} ر.س</td>
                      <td style={{ padding: '12px 12px', fontWeight: 700, color: (c.balance || 0) > 0 ? '#c81e1e' : '#0ea77b' }}>
                        {(c.balance || 0).toLocaleString()} ر.س
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span className={'badge ' + (c.is_active ? 'badge-green' : 'badge-gray')}>{c.is_active ? 'نشط' : 'موقوف'}</span>
                      </td>
                      <td style={{ padding: '12px 8px' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => router.push(`/finance/invoices/clients/${c.id}`)}
                          style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}>
                          <Eye style={{ width: '13px', height: '13px' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>
                ‹ السابق
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: page === p ? 700 : 400,
                    background: page === p ? 'var(--primary)' : 'white',
                    color: page === p ? 'white' : 'var(--text3)' }}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}>
                التالي ›
              </button>
              <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>
                {filtered.length} عميل — صفحة {page} من {totalPages}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
