// src/app/(dashboard)/inventory/projects/[projectId]/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight, Package, Clock, Warehouse, Undo2, Download,
  User, MapPin, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import {
  fetchProjectCustodyPageData,
  type ProjectCustodyPageData,
  type CustodyMaterialRow,
  type CustodyMovementEvent,
} from '@/lib/project-custody-service'

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

const EVENT_STYLE: Record<string, { color: string; bg: string; dot: string }> = {
  receive: { color: '#0ea77b', bg: '#ecfdf5', dot: '#0ea77b' },
  issue: { color: '#c81e1e', bg: '#fef2f2', dot: '#c81e1e' },
  return_client: { color: '#e6820a', bg: '#fffbeb', dot: '#e6820a' },
  return_site: { color: '#1a56db', bg: '#eff6ff', dot: '#1a56db' },
  other: { color: '#6b7280', bg: '#f9fafb', dot: '#9ca3af' },
}

function formatDt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ar-SA') + ' — ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
}

function MetaChip({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text3)', marginBottom: '6px' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {values.map(v => (
          <span key={v} style={{ background: '#f0fdfa', color: '#0f766e', borderRadius: '8px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700, direction: 'ltr' }}>{v}</span>
        ))}
      </div>
    </div>
  )
}

function TimelineEvent({ ev }: { ev: CustodyMovementEvent }) {
  const s = EVENT_STYLE[ev.kind] || EVENT_STYLE.other
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ width: '10px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '4px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.dot }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: s.color }}>{ev.kind_label}</span>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: s.color }} dir="ltr">{fmt(ev.qty)} {ev.unit}</span>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>{formatDt(ev.date)}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {ev.txn_number && <span>إذن: <strong dir="ltr">{ev.txn_number}</strong></span>}
          {ev.booking_no && <span>حجز: <strong dir="ltr">{ev.booking_no}</strong></span>}
          {ev.exit_permit_no && <span>إذن خروج: <strong dir="ltr">{ev.exit_permit_no}</strong></span>}
          {ev.doc_code && <span>مستند: <strong dir="ltr">{ev.doc_code}</strong></span>}
          {ev.wh_name && <span>مستودع: {ev.wh_name}</span>}
        </div>
        {ev.note && <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>{ev.note}</div>}
      </div>
    </div>
  )
}

function MaterialCard({ mat }: { mat: CustodyMaterialRow }) {
  const [open, setOpen] = useState(true)
  const clientReturns = mat.events.filter(e => e.kind === 'return_client')
  const receives = mat.events.filter(e => e.kind === 'receive')
  const issues = mat.events.filter(e => e.kind === 'issue')

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '14px 16px', background: '#f8fafc', border: 'none', cursor: 'pointer', textAlign: 'right' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{mat.name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '3px' }}>
              {mat.catalog_no && <span style={{ marginLeft: '8px' }}>SEC: {mat.catalog_no}</span>}
              {mat.warehouse_name && <span> · {mat.warehouse_name}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <StatPill label="مستلم" value={mat.qty_received} color="#0ea77b" />
            <StatPill label="مصروف" value={mat.qty_issued} color="#c81e1e" />
            {mat.qty_returned_client > 0 && <StatPill label="مرجع للعميل" value={mat.qty_returned_client} color="#e6820a" />}
            <StatPill label="متبقي بالمخزن" value={mat.qty_balance} color="#1a56db" highlight={mat.qty_balance > 0} />
            {open ? <ChevronUp style={{ width: '16px', color: 'var(--text3)' }} /> : <ChevronDown style={{ width: '16px', color: 'var(--text3)' }} />}
          </div>
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {mat.events.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>لا توجد حركات مسجّلة — الرصيد من العهدة فقط</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', margin: '12px 0' }}>
                <MiniStat icon="📥" label="مرات الاستلام" value={receives.length} />
                <MiniStat icon="📤" label="مرات الصرف" value={issues.length} />
                <MiniStat icon="↩️" label="إرجاع للعميل" value={clientReturns.length} />
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text3)', marginBottom: '6px' }}>سجل الحركات (من الأقدم للأحدث)</div>
              {mat.events.map(ev => <TimelineEvent key={ev.id} ev={ev} />)}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function StatPill({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <span style={{
      background: highlight ? color + '18' : '#f1f5f9', color,
      borderRadius: '999px', padding: '3px 10px', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {label}: <span dir="ltr">{fmt(value)}</span>
    </span>
  )
}

function MiniStat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
      <div style={{ fontSize: '1rem' }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{value}</div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{label}</div>
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
  const [tab, setTab] = useState<'materials' | 'pending' | 'warehouse'>('materials')

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
      [`عهدة المشروع: ${data.project.name}`],
      [`رقم الحجز: ${data.meta.reservation_number || data.meta.booking_numbers.join(' / ') || '—'}`],
      [],
      ['المادة', 'مستلم', 'مصروف', 'مرجع للعميل', 'متبقي بالمخزن'],
      ...data.received.map(m => [m.name, String(m.qty_received), String(m.qty_issued), String(m.qty_returned_client), String(m.qty_balance)]),
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

  const TABS = [
    { id: 'materials' as const, label: 'المواد والحركات', count: data.received.length, icon: Package },
    { id: 'pending' as const, label: 'غير مستلمة (المقايسة)', count: data.notYetReceived.length, icon: Clock },
    { id: 'warehouse' as const, label: 'متبقي بالمخزن', count: data.pendingInWarehouse.length, icon: Warehouse },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', margin: '0 auto' }}>
      {/* رأس الصفحة */}
      <div>
        <button onClick={() => router.push('/inventory/projects')} className="btn btn-ghost" style={{ fontSize: '0.78rem', marginBottom: '10px', padding: '4px 0' }}>
          <ArrowRight style={{ width: '14px', height: '14px' }} /> عهدة المشاريع
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>{data.project.name}</h1>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text3)' }}>
              {data.project.status && <span>{data.project.status}</span>}
              {data.project.client_name && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User style={{ width: '12px' }} /> {data.project.client_name}</span>}
              {data.project.location && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin style={{ width: '12px' }} /> {data.project.location}</span>}
            </div>
          </div>
          <button onClick={exportCsv} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>
            <Download style={{ width: '14px', height: '14px' }} /> تصدير
          </button>
        </div>
      </div>

      {/* بطاقات المعلومات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        <MetaChip label="رقم الحجز (SEC)" values={data.meta.reservation_number ? [data.meta.reservation_number, ...data.meta.booking_numbers.filter(b => b !== data.meta.reservation_number)] : data.meta.booking_numbers} />
        <MetaChip label="أرقام إذن الخروج" values={data.meta.exit_permits} />
        <MetaChip label="أرقام المستندات" values={data.meta.doc_codes} />
        <MetaChip label="أسماء العملاء" values={data.meta.client_names.length ? data.meta.client_names : (data.project.client_name ? [data.project.client_name] : [])} />
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
        {[
          { label: 'إجمالي المستلم', value: data.totals.received, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'إجمالي المصروف', value: data.totals.issued, color: '#c81e1e', bg: '#fef2f2' },
          { label: 'مرجع للعميل', value: data.totals.returned_client, color: '#e6820a', bg: '#fffbeb' },
          { label: 'متبقي بالمخزن', value: data.totals.in_warehouse, color: '#1a56db', bg: '#eff6ff' },
          { label: 'بانتظار الاستلام', value: data.totals.pending_receive, color: '#7c3aed', bg: '#f5f3ff' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: k.color }} dir="ltr">{fmt(k.value)}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* تبويبات */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px',
              border: `1px solid ${active ? '#0f766e' : 'var(--border)'}`, background: active ? '#f0fdfa' : 'white',
              color: active ? '#0f766e' : 'var(--text3)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
            }}>
              <Icon style={{ width: '14px', height: '14px' }} /> {t.label}
              {t.count > 0 && <span style={{ background: active ? '#0f766e' : '#e5e7eb', color: active ? 'white' : '#6b7280', borderRadius: '999px', padding: '1px 7px', fontSize: '0.65rem' }}>{t.count}</span>}
            </button>
          )
        })}
      </div>

      {/* المحتوى */}
      {tab === 'materials' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.received.length === 0 ? (
            <EmptyBox text="لم تُسجَّل مواد بعد" />
          ) : data.received.map(m => <MaterialCard key={m.key} mat={m} />)}
        </div>
      )}

      {tab === 'pending' && (
        !data.has_boq ? (
          <EmptyBox text="لا توجد مقايسة — أضف بنود المواد في التخطيط" warn />
        ) : data.notYetReceived.length === 0 ? (
          <EmptyBox text="✅ كل بنود المقايسة مستلمة" />
        ) : (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead><tr style={{ background: '#fffbeb' }}>
                {['المادة', 'الوحدة', 'مخطط', 'مستلم', 'متبقي'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#92400e', fontSize: '0.72rem' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.notYetReceived.map(r => (
                  <tr key={r.key} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.description}</td>
                    <td style={{ padding: '10px 14px' }}>{r.unit}</td>
                    <td style={{ padding: '10px 14px' }} dir="ltr">{fmt(r.qty_planned)}</td>
                    <td style={{ padding: '10px 14px' }} dir="ltr">{fmt(r.qty_received)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#e6820a' }} dir="ltr">{fmt(r.qty_pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'warehouse' && (
        data.pendingInWarehouse.length === 0 ? (
          <EmptyBox text="لا يوجد رصيد متبقٍ في المخزون" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text3)', margin: 0 }}>
              <Undo2 style={{ width: '13px', display: 'inline', verticalAlign: 'middle' }} /> مواد باقية في العهدة — يُفترض إرجاعها للعميل عند إغلاق المشروع
            </p>
            {data.pendingInWarehouse.map(m => (
              <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'white', border: '1px solid #fecaca', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>مستلم {fmt(m.qty_received)} · مصروف {fmt(m.qty_issued)}</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#c81e1e' }} dir="ltr">{fmt(m.qty_balance)} {m.unit}</div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function EmptyBox({ text, warn }: { text: string; warn?: boolean }) {
  return (
    <div style={{
      padding: '40px', textAlign: 'center', borderRadius: '14px', fontSize: '0.85rem',
      background: warn ? '#fffbeb' : '#f8fafc', color: warn ? '#92400e' : 'var(--text3)',
      border: `1px solid ${warn ? '#fde68a' : 'var(--border)'}`,
    }}>{text}</div>
  )
}
