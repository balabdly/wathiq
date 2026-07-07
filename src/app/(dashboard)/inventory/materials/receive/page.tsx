// src/app/(dashboard)/inventory/materials/receive/page.tsx
// تبويب: أذون الاستلام (RCV) — كل ما يدخل المستودع: استلام من SEC/مورد + مرتجع من الموقع
'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Printer, ChevronDown, ChevronUp, Paperclip, Filter } from 'lucide-react'
import { useMaterials } from '../MaterialsContext'
import { OperationModal, ReturnModal, printOperationReceipt } from '../opsShared'

const FETCH_LIMIT = 300
const ACCENT = '#0ea77b'

type LedgerRow = {
  id: number; txn_number?: string; type: string; movement_category?: string
  mat_name: string; mat_code?: string; unit: string
  qty: number; qty_before: number; qty_after: number
  wh_name: string; project_name?: string; vendor_name?: string; client_name?: string
  exit_permit_no?: string; doc_code?: string; booking_no?: string
  dispatch_note?: string; attachment_url?: string; created_at: string
}

type VoucherDoc = {
  no: string            // رقم الإذن (txn_number أو رقم مشتق للسجلات القديمة)
  legacy: boolean       // سجل قديم قبل توحيد الترقيم
  date: string
  wh_name: string
  party: string         // المشروع / المورد / العميل
  lines: LedgerRow[]
}

export default function ReceiveVouchersPage() {
  const { tenantId, branchId, warehouses, projects, loading: ctxLoading, reloadKpis } = useMaterials()
  const [rows,    setRows]    = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [modal,   setModal]   = useState<'استلام' | 'مرتجع' | null>(null)
  const [openDoc, setOpenDoc] = useState<string | null>(null)

  // فلاتر
  const [search,   setSearch]   = useState('')
  const [filterWh, setFilterWh] = useState('')

  useEffect(() => { if (tenantId && !ctxLoading) load() }, [tenantId, ctxLoading])

  async function load() {
    if (!tenantId) return
    setLoading(true)
    let q = supabase.from('stock_ledger').select('*')
      .eq('tenant_id', tenantId)
      .order('id', { ascending: false }).limit(FETCH_LIMIT)
    q = q.eq('type', 'استلام')
      .not('movement_category', 'eq', 'تحويل')
    if (filterWh) q = q.eq('wh_name', filterWh)
    const { data } = await q
    setRows((data || []) as LedgerRow[])
    setLoading(false)
  }

  // ── تجميع السطور إلى أذون: txn_number موحد = إذن واحد، والسجلات القديمة كل سطر إذن مستقل ──
  const docs = useMemo<VoucherDoc[]>(() => {
    const map = new Map<string, VoucherDoc>()
    for (const r of rows) {
      const key = r.txn_number || `قيد قديم #${r.id}`
      const existing = map.get(key)
      if (existing) { existing.lines.push(r); continue }
      map.set(key, {
        no: key, legacy: !r.txn_number,
        date: r.created_at,
        wh_name: r.wh_name,
        party: r.project_name || r.vendor_name || r.client_name || '—',
        lines: [r],
      })
    }
    let list = Array.from(map.values())
    if (search.trim()) {
      const s = search.trim()
      list = list.filter(d =>
        d.no.includes(s) || d.party.includes(s) || d.wh_name.includes(s) ||
        d.lines.some(l => l.mat_name.includes(s) || (l.doc_code || '').includes(s) || (l.booking_no || '').includes(s))
      )
    }
    return list
  }, [rows, search])

  function reprint(doc: VoucherDoc) {
    const first = doc.lines[0]
    printOperationReceipt({
      type: first.movement_category === 'مرتجع_موقع' ? 'مرتجع موقع' : 'استلام',
      warehouseName: doc.wh_name,
      projectName:   first.project_name || '',
      date:          doc.date.split('T')[0],
      rows:          doc.lines.map(l => ({ name: l.mat_name, unit: l.unit, qty: Number(l.qty), note: l.dispatch_note || '' })),
      vendorName:    first.vendor_name    || '',
      docCode:       first.doc_code       || '',
      bookingNo:     first.booking_no     || '',
      clientName:    first.client_name    || '',
      exitPermitNo:  first.exit_permit_no || '',
      txnNumber:     doc.legacy ? (first.txn_number || '') : doc.no,
    })
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* شريط الإجراءات */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>
          {docs.length.toLocaleString()} إذن — آخر {FETCH_LIMIT} حركة
        </span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setModal('استلام')} className="btn btn-primary" style={{ fontSize: '0.82rem', background: '#0ea77b' }}>
            <Plus style={{ width: '15px', height: '15px' }} /> إذن استلام جديد
          </button>
          <button onClick={() => setModal('مرتجع')} className="btn btn-primary" style={{ fontSize: '0.82rem', background: '#1a56db' }}>
            <Plus style={{ width: '15px', height: '15px' }} /> مرتجع من الموقع
          </button>
        </div>
      </div>

      {/* الفلاتر */}
      <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="رقم إذن / مادة / مشروع / مستند..." className="input" style={{ paddingRight: '32px', width: '240px', fontSize: '0.82rem' }} />
        </div>
        <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
          <option value="">كل المستودعات</option>
          {warehouses.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
        </select>
        <button onClick={load} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 16px', background: ACCENT }}>
          <Filter style={{ width: '13px', height: '13px' }} /> عرض
        </button>
      </div>

      {/* قائمة الأذون */}
      <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid var(--border)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : docs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📥</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{search || filterWh ? 'لا توجد أذون بهذه الفلاتر' : 'لا توجد أذون بعد — أنشئ أول إذن'}</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2, #f8fafc)' }}>
                  {['رقم الإذن', 'التاريخ', 'المستودع', 'الجهة', 'الأصناف', 'الكمية', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => {
                  const open = openDoc === doc.no
                  const totalQty = doc.lines.reduce((s, l) => s + Number(l.qty), 0)
                  const hasAttach = doc.lines.some(l => l.attachment_url)
                  return (<FragmentRow key={doc.no}>
                    <tr style={{ borderBottom: open ? 'none' : '1px solid var(--bg2, #f8fafc)', cursor: 'pointer', background: open ? ACCENT + '08' : 'transparent' }}
                      onClick={() => setOpenDoc(open ? null : doc.no)}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap' }}>
                        {doc.no}
                        {doc.legacy && <span style={{ marginRight: '6px', fontSize: '0.62rem', color: 'var(--text3)', fontFamily: 'inherit', fontWeight: 400 }}>(قديم)</span>}
                        {hasAttach && <Paperclip style={{ width: '11px', height: '11px', marginRight: '5px', verticalAlign: '-1px', color: 'var(--text3)' }} />}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmtDate(doc.date)}</td>
                      <td style={{ padding: '10px 12px' }}>{doc.wh_name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.party}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{doc.lines.length}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: ACCENT }}>{totalQty}</td>
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                        <button onClick={e => { e.stopPropagation(); reprint(doc) }} title="طباعة الإذن"
                          style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280', marginLeft: '4px' }}>
                          <Printer style={{ width: '13px', height: '13px' }} />
                        </button>
                        {open ? <ChevronUp style={{ width: '14px', height: '14px', color: 'var(--text3)', verticalAlign: 'middle' }} />
                              : <ChevronDown style={{ width: '14px', height: '14px', color: 'var(--text3)', verticalAlign: 'middle' }} />}
                      </td>
                    </tr>
                    {open && (
                      <tr style={{ borderBottom: '1px solid var(--bg2, #f8fafc)' }}>
                        <td colSpan={7} style={{ padding: '0 24px 14px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', background: 'var(--bg2, #f8fafc)', borderRadius: '10px', overflow: 'hidden' }}>
                            <thead>
                              <tr>
                                {['المادة', 'الوحدة', 'الكمية', 'قبل', 'بعد', 'ملاحظة', 'مرفق'].map(h => (
                                  <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: '0.7rem' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {doc.lines.map(l => (
                                <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{l.mat_name}</td>
                                  <td style={{ padding: '8px 12px', color: 'var(--text3)' }}>{l.unit}</td>
                                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: ACCENT }}>{l.qty}</td>
                                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text3)' }}>{l.qty_before}</td>
                                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text3)' }}>{l.qty_after}</td>
                                  <td style={{ padding: '8px 12px', color: 'var(--text3)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.dispatch_note || '—'}</td>
                                  <td style={{ padding: '8px 12px' }}>
                                    {l.attachment_url
                                      ? <a href={l.attachment_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#1a56db' }}><Paperclip style={{ width: '13px', height: '13px' }} /></a>
                                      : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>)
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* المودالات */}
      {modal === 'استلام' && tenantId && branchId != null && (
        <OperationModal type="استلام"
          tenantId={tenantId} branchId={branchId}
          warehouses={warehouses} projects={projects}
          onClose={() => setModal(null)} onSave={() => { setModal(null); load(); reloadKpis() }} />
      )}
      {modal === 'مرتجع' && tenantId && branchId != null && (
        <ReturnModal
          tenantId={tenantId} branchId={branchId}
          warehouses={warehouses} projects={projects}
          onClose={() => setModal(null)} onSave={() => { setModal(null); load(); reloadKpis() }} />
      )}
    </div>
  )
}

// غلاف شفاف لصفّي الجدول (الرئيسي + المنبسط) داخل map واحدة
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
