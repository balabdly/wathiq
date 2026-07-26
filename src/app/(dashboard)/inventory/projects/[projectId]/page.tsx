// src/app/(dashboard)/inventory/projects/[projectId]/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Download, Eye, Printer, X } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { printOperationReceipt } from '@/app/(dashboard)/inventory/materials/opsShared'
import {
  fetchProjectCustodyPageData,
  type CustodyVoucherDoc,
  type CustodyVoucherKind,
  type ProjectCustodyPageData,
} from '@/lib/project-custody-service'

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' })

const TH: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'right', fontWeight: 700,
  color: '#475569', fontSize: '0.75rem', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}

const TD: React.CSSProperties = {
  padding: '10px 14px', borderBottom: '1px solid #f1f5f9',
}

const VOUCHER_KIND_UI: Record<CustodyVoucherKind, { label: string; short: string; color: string; bg: string; printType: string }> = {
  receive: { label: 'أذون الاستلام', short: 'استلام', color: '#0ea77b', bg: '#ecfdf5', printType: 'استلام' },
  issue: { label: 'أذون الصرف', short: 'صرف', color: '#c81e1e', bg: '#fef2f2', printType: 'صرف' },
  return_client: { label: 'أذون الإرجاع', short: 'إرجاع', color: '#e6820a', bg: '#fffbeb', printType: 'إرجاع للعميل' },
  return_site: { label: 'مرتجع من الموقع', short: 'مرتجع', color: '#1a56db', bg: '#eff6ff', printType: 'مرتجع موقع' },
}

function printCustodyVoucher(doc: CustodyVoucherDoc, projectName: string) {
  const ui = VOUCHER_KIND_UI[doc.kind]
  printOperationReceipt({
    type: ui.printType,
    warehouseName: doc.wh_name,
    projectName,
    date: doc.date.split('T')[0],
    rows: doc.lines.map(l => ({ name: l.mat_name, unit: l.unit, qty: l.qty, note: '' })),
    bookingNo: doc.booking_no || '',
    exitPermitNo: doc.exit_permit_no || '',
    txnNumber: doc.legacy ? '' : doc.no,
  })
}

function VoucherCountChip({
  kind, count, active, onClick,
}: { kind: CustodyVoucherKind; count: number; active: boolean; onClick: () => void }) {
  const ui = VOUCHER_KIND_UI[kind]
  return (
    <button type="button" onClick={onClick} disabled={count === 0}
      style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
        padding: '8px 14px', borderRadius: '10px', cursor: count > 0 ? 'pointer' : 'default',
        border: `1px solid ${active ? ui.color : '#e2e8f0'}`,
        background: active ? ui.bg : 'white',
        opacity: count > 0 ? 1 : 0.45,
        minWidth: '80px',
      }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--text3)', fontWeight: 600 }}>{ui.short}</span>
      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: ui.color }} dir="ltr">{count}</span>
    </button>
  )
}

function VouchersPanel({
  title, docs, color, projectName, onClose,
}: { title: string; docs: CustodyVoucherDoc[]; color: string; projectName: string; onClose: () => void }) {
  const [viewDoc, setViewDoc] = useState<string | null>(null)

  return (
    <div style={{
      background: 'white', border: '1px solid var(--border)', borderRadius: '12px',
      overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontWeight: 800, fontSize: '0.88rem', color }}>{title} ({docs.length})</div>
        <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: '4px 8px' }}>
          <X style={{ width: '16px', height: '16px' }} />
        </button>
      </div>
      {docs.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>لا توجد أذون</div>
      ) : (
        <div style={{ maxHeight: '420px', overflow: 'auto' }}>
          {docs.map(doc => {
            const viewing = viewDoc === doc.no
            return (
              <div key={doc.no} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 16px', background: viewing ? '#fafbff' : 'white', gap: '10px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem' }} dir="ltr">{doc.no}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '3px' }}>
                      {fmtDate(doc.date)} · {doc.wh_name} · {doc.lines.length} مادة
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button type="button" title="عرض" onClick={() => setViewDoc(viewing ? null : doc.no)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '32px', height: '32px', borderRadius: '8px',
                        border: `1px solid ${viewing ? color : '#e2e8f0'}`,
                        background: viewing ? `${color}11` : 'white',
                        color: viewing ? color : 'var(--text3)', cursor: 'pointer',
                      }}>
                      <Eye style={{ width: '15px', height: '15px' }} />
                    </button>
                    <button type="button" title="طباعة" onClick={() => printCustodyVoucher(doc, projectName)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '32px', height: '32px', borderRadius: '8px',
                        border: '1px solid #e2e8f0', background: 'white',
                        color: 'var(--text3)', cursor: 'pointer',
                      }}>
                      <Printer style={{ width: '15px', height: '15px' }} />
                    </button>
                  </div>
                </div>
                {viewing && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', background: '#fafbff' }}>
                    <thead>
                      <tr>
                        {['المادة', 'الوحدة', 'الكمية'].map(h => (
                          <th key={h} style={{ ...TH, padding: '8px 16px', fontSize: '0.68rem' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {doc.lines.map((line, i) => (
                        <tr key={i}>
                          <td style={{ ...TD, padding: '8px 16px' }}>{line.mat_name}</td>
                          <td style={{ ...TD, padding: '8px 16px', color: 'var(--text3)' }}>{line.unit}</td>
                          <td style={{ ...TD, padding: '8px 16px', fontWeight: 700, textAlign: 'center' }} dir="ltr">{fmt(line.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ProjectCustodyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { tenant } = useStore()
  const projectId = Number(params.projectId)
  const [data, setData] = useState<ProjectCustodyPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [openVoucherKind, setOpenVoucherKind] = useState<CustodyVoucherKind | null>(null)

  useEffect(() => {
    if (!tenant || !projectId) return
    setLoading(true)
    fetchProjectCustodyPageData(tenant.id, projectId).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [tenant?.id, projectId])

  function exportCsv() {
    if (!data) return
    const lines: string[][] = [
      [`عهدة: ${data.project.code || data.project.name}`],
      [],
      ['المادة', 'الوحدة', 'مستلم', 'مصروف', 'إرجاع', 'متبقي'],
      ...data.received.map(m => [m.name, m.unit, String(m.qty_received), String(m.qty_issued), String(m.qty_returned_client), String(m.qty_balance)]),
    ]
    const blob = new Blob(['\uFEFF' + lines.map(r => r.join('\t')).join('\n')], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `عهدة_${data.project.code || data.project.name}.xls`
    a.click()
  }

  function toggleVouchers(kind: CustodyVoucherKind) {
    const count = data?.vouchers.counts[kind] ?? 0
    if (count === 0) return
    setOpenVoucherKind(prev => (prev === kind ? null : kind))
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>المشروع غير موجود</p>
        <Link href="/inventory/projects" className="btn btn-ghost" style={{ marginTop: '12px' }}>← العودة</Link>
      </div>
    )
  }

  const booking = data.meta.reservation_number || data.meta.booking_numbers[0] || '—'
  const exitPermit = data.meta.exit_permits[0] || '—'
  const rows = data.received
  const projectLabel = data.project.code || data.project.name

  const openDocs = openVoucherKind ? data.vouchers[openVoucherKind] : []
  const openTitle = openVoucherKind ? VOUCHER_KIND_UI[openVoucherKind].label : ''
  const openColor = openVoucherKind ? VOUCHER_KIND_UI[openVoucherKind].color : '#334155'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <button onClick={() => router.push('/inventory/projects')} className="btn btn-ghost" style={{ fontSize: '0.78rem', marginBottom: '8px', padding: '4px 0' }}>
            <ArrowRight style={{ width: '14px', height: '14px' }} /> عهدة المشاريع
          </button>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
            <span dir="ltr" style={{ fontFamily: 'monospace', color: '#1a56db' }}>{projectLabel}</span>
            {data.project.code && <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text3)', marginRight: '8px' }}>{data.project.name}</span>}
          </h1>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px', fontSize: '0.78rem', color: 'var(--text3)' }}>
            <span>رقم الحجز: <strong dir="ltr" style={{ color: 'var(--text)' }}>{booking}</strong></span>
            <span>إذن الخروج: <strong dir="ltr" style={{ color: 'var(--text)' }}>{exitPermit}</strong></span>
            {data.project.client_name && <span>العميل: <strong>{data.project.client_name}</strong></span>}
          </div>
        </div>
        <button onClick={exportCsv} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>
          <Download style={{ width: '14px', height: '14px' }} /> Excel
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'stretch' }}>
        {(['receive', 'issue', 'return_client', 'return_site'] as CustodyVoucherKind[]).map(kind => (
          <VoucherCountChip
            key={kind}
            kind={kind}
            count={data.vouchers.counts[kind]}
            active={openVoucherKind === kind}
            onClick={() => toggleVouchers(kind)}
          />
        ))}
      </div>

      {openVoucherKind && (
        <VouchersPanel
          title={openTitle}
          docs={openDocs}
          color={openColor}
          projectName={data.project.name}
          onClose={() => setOpenVoucherKind(null)}
        />
      )}

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'auto' }}>
        {rows.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem' }}>
            لا توجد مواد مسجّلة لهذا المشروع
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '560px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={TH}>المادة</th>
                <th style={TH}>الوحدة</th>
                <th style={{ ...TH, textAlign: 'center' }}>مستلم</th>
                <th style={{ ...TH, textAlign: 'center' }}>مصروف</th>
                <th style={{ ...TH, textAlign: 'center' }}>إرجاع</th>
                <th style={{ ...TH, textAlign: 'center' }}>متبقي</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(m => (
                <tr key={m.key} style={{ background: m.qty_balance > 0 ? '#fafbff' : 'white' }}>
                  <td style={{ ...TD, fontWeight: 600 }}>{m.name}</td>
                  <td style={{ ...TD, color: 'var(--text3)' }}>{m.unit}</td>
                  <td style={{ ...TD, textAlign: 'center', fontWeight: 700, color: '#0ea77b' }} dir="ltr">{fmt(m.qty_received)}</td>
                  <td style={{ ...TD, textAlign: 'center', fontWeight: 700, color: '#c81e1e' }} dir="ltr">{fmt(m.qty_issued)}</td>
                  <td style={{ ...TD, textAlign: 'center', fontWeight: 700, color: m.qty_returned_client > 0 ? '#e6820a' : 'var(--text3)' }} dir="ltr">
                    {m.qty_returned_client > 0 ? fmt(m.qty_returned_client) : '—'}
                  </td>
                  <td style={{ ...TD, textAlign: 'center', fontWeight: 800, color: m.qty_balance > 0 ? '#1a56db' : 'var(--text3)' }} dir="ltr">
                    {fmt(m.qty_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f0fdfa', fontWeight: 800 }}>
                <td style={TD} colSpan={2}>الإجمالي</td>
                <td style={{ ...TD, textAlign: 'center', color: '#0ea77b' }} dir="ltr">{fmt(data.totals.received)}</td>
                <td style={{ ...TD, textAlign: 'center', color: '#c81e1e' }} dir="ltr">{fmt(data.totals.issued)}</td>
                <td style={{ ...TD, textAlign: 'center', color: '#e6820a' }} dir="ltr">{fmt(data.totals.returned_client)}</td>
                <td style={{ ...TD, textAlign: 'center', color: '#1a56db' }} dir="ltr">{fmt(data.totals.in_warehouse)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {data.notYetReceived.length > 0 && (
        <>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e', marginTop: '8px' }}>
            غير مستلمة بعد (حسب المقايسة)
          </div>
          <div style={{ background: 'white', border: '1px solid #fde68a', borderRadius: '12px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#fffbeb' }}>
                  {['المادة', 'الوحدة', 'مخطط', 'مستلم', 'متبقي'].map(h => (
                    <th key={h} style={{ ...TH, color: '#92400e', borderColor: '#fde68a' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.notYetReceived.map(r => (
                  <tr key={r.key}>
                    <td style={{ ...TD, fontWeight: 600 }}>{r.description}</td>
                    <td style={TD}>{r.unit}</td>
                    <td style={{ ...TD, textAlign: 'center' }} dir="ltr">{fmt(r.qty_planned)}</td>
                    <td style={{ ...TD, textAlign: 'center' }} dir="ltr">{fmt(r.qty_received)}</td>
                    <td style={{ ...TD, textAlign: 'center', fontWeight: 800, color: '#e6820a' }} dir="ltr">{fmt(r.qty_pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
