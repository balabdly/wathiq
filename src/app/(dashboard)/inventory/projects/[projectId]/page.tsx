// src/app/(dashboard)/inventory/projects/[projectId]/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Download } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { fetchProjectCustodyPageData, type ProjectCustodyPageData } from '@/lib/project-custody-service'

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

const TH: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'right', fontWeight: 700,
  color: '#475569', fontSize: '0.75rem', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}

const TD: React.CSSProperties = {
  padding: '10px 14px', borderBottom: '1px solid #f1f5f9',
}

export default function ProjectCustodyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { tenant } = useStore()
  const projectId = Number(params.projectId)
  const [data, setData] = useState<ProjectCustodyPageData | null>(null)
  const [loading, setLoading] = useState(true)

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
      [`عهدة: ${data.project.name}`],
      [],
      ['المادة', 'الوحدة', 'مستلم', 'مصروف', 'إرجاع', 'متبقي'],
      ...data.received.map(m => [m.name, m.unit, String(m.qty_received), String(m.qty_issued), String(m.qty_returned_client), String(m.qty_balance)]),
    ]
    const blob = new Blob(['\uFEFF' + lines.map(r => r.join('\t')).join('\n')], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `عهدة_${data.project.name}.xls`
    a.click()
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* رأس */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <button onClick={() => router.push('/inventory/projects')} className="btn btn-ghost" style={{ fontSize: '0.78rem', marginBottom: '8px', padding: '4px 0' }}>
            <ArrowRight style={{ width: '14px', height: '14px' }} /> عهدة المشاريع
          </button>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>{data.project.name}</h1>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px', fontSize: '0.78rem', color: 'var(--text3)' }}>
            <span>رقم الحجز: <strong dir="ltr" style={{ color: 'var(--text)' }}>{booking}</strong></span>
            <span>إذن الخروج: <strong dir="ltr" style={{ color: 'var(--text)' }}>{exitPermit}</strong></span>
            {data.project.client_name && <span>العميل: <strong>{data.project.client_name}</strong></span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/inventory/movements" className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>
            سجل الحركات ←
          </Link>
          <button onClick={exportCsv} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>
            <Download style={{ width: '14px', height: '14px' }} /> Excel
          </button>
        </div>
      </div>

      {/* جدول المواد — مثل Excel */}
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

      {/* غير مستلمة من المقايسة — جدول ثانٍ بسيط إن وُجد */}
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

      <p style={{ fontSize: '0.72rem', color: 'var(--text3)', margin: 0 }}>
        التواريخ والتفاصيل → <Link href="/inventory/movements" style={{ color: '#1a56db' }}>حركات المخزون</Link>
      </p>
    </div>
  )
}
