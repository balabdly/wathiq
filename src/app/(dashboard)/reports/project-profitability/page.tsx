'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import {
  fetchProjectsProfitability,
  summarizeProfitability,
  fmtMoney,
  type ProjectProfitRow,
} from '@/lib/projectProfitability'
import { TrendingUp, Search, Download, X, ArrowRight, BarChart3 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProjectProfitabilityPage() {
  const { tenant, activeBranch } = useStore()
  const [rows, setRows] = useState<ProjectProfitRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [selected, setSelected] = useState<ProjectProfitRow | null>(null)

  useEffect(() => {
    if (!tenant?.id) return
    setLoading(true)
    fetchProjectsProfitability(tenant.id, activeBranch?.id)
      .then(setRows)
      .catch(() => toast.error('تعذّر تحميل بيانات الربحية'))
      .finally(() => setLoading(false))
  }, [tenant?.id, activeBranch?.id])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchSearch = !search || r.projectName.includes(search) || r.type.includes(search)
      const matchStatus = !fStatus || r.status === fStatus
      return matchSearch && matchStatus
    })
  }, [rows, search, fStatus])

  const summary = useMemo(() => summarizeProfitability(filtered), [filtered])

  const statuses = useMemo(() => Array.from(new Set(rows.map(r => r.status))).sort(), [rows])

  function exportCSV() {
    if (!filtered.length) return
    const headers = ['المشروع', 'الحالة', 'النوع', 'القيمة التقديرية', 'الإيراد', 'التكاليف', 'صافي الربح', 'الهامش%', 'المحصّل', 'غير المحصّل']
    const lines = filtered.map(r => [
      r.projectName, r.status, r.type, r.estimatedValue, r.netRevenue, r.totalCosts,
      r.netProfit, r.profitMargin.toFixed(1), r.collected, r.uncollected,
    ].join(','))
    const blob = new Blob(['\uFEFF' + [headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'ربحية-المشاريع.csv'
    a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp style={{ width: '22px', height: '22px', color: '#0ea77b' }} />
            ربحية المشاريع
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '4px' }}>
            إيراد (فواتير − إشعارات دائن) − تكاليف (فواتير موردين + مصروفات المشروع)
          </p>
        </div>
        <Link href="/reports/executive" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#1a56db', fontWeight: 600, textDecoration: 'none' }}>
          <BarChart3 style={{ width: '15px', height: '15px' }} /> لوحة تنفيذية
          <ArrowRight style={{ width: '14px', height: '14px' }} />
        </Link>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          { label: 'المشاريع', value: summary.projectCount, sub: `${summary.activeCount} نشط`, color: '#1a56db', bg: '#eff6ff' },
          { label: 'إجمالي الإيراد', value: fmtMoney(summary.totalRevenue) + ' ر.س', color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'إجمالي التكاليف', value: fmtMoney(summary.totalCosts) + ' ر.س', color: '#c81e1e', bg: '#fef2f2' },
          { label: 'صافي الربح', value: fmtMoney(summary.totalProfit) + ' ر.س', color: summary.totalProfit >= 0 ? '#0ea77b' : '#c81e1e', bg: summary.totalProfit >= 0 ? '#ecfdf5' : '#fef2f2' },
          { label: 'مشاريع رابحة', value: summary.profitProjects, sub: `${summary.lossProjects} خاسرة`, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'متوسط الهامش', value: summary.avgMargin.toFixed(1) + '%', color: '#0891b2', bg: '#ecfeff' },
        ].map(k => (
          <div key={k.label} style={{ padding: '14px 16px', borderRadius: '12px', background: k.bg, border: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: '4px' }}>{k.label}</div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: k.color }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '2px' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '280px' }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="input" style={{ paddingRight: '32px', fontSize: '0.85rem' }} />
        </div>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="select" style={{ fontSize: '0.85rem', minWidth: '140px' }}>
          <option value="">كل الحالات</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={exportCSV} disabled={!filtered.length} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
          <Download style={{ width: '14px', height: '14px' }} /> CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: '16px', alignItems: 'start' }}>
        {/* جدول */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>لا توجد مشاريع</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['المشروع', 'الحالة', 'الإيراد', 'التكاليف', 'صافي الربح', 'الهامش', ''].map(h => (
                      <th key={h || 'x'} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.projectId}
                      onClick={() => setSelected(r)}
                      style={{
                        borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                        background: selected?.projectId === r.projectId ? '#eff6ff' : 'white',
                      }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.projectName}</td>
                      <td style={{ padding: '10px 12px' }}><span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>{r.status}</span></td>
                      <td style={{ padding: '10px 12px', color: '#0ea77b', fontWeight: 600 }}>{fmtMoney(r.netRevenue)}</td>
                      <td style={{ padding: '10px 12px', color: '#c81e1e' }}>{fmtMoney(r.totalCosts)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: r.netProfit >= 0 ? '#0ea77b' : '#c81e1e' }}>{fmtMoney(r.netProfit)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.profitMargin.toFixed(1)}%</td>
                      <td style={{ padding: '10px 12px', color: '#9ca3af' }}>←</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* تفاصيل */}
        {selected && (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', padding: '16px', position: 'sticky', top: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{selected.projectName}</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '2px' }}>{selected.type} · {selected.progress}% تقدم</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X style={{ width: '16px', height: '16px' }} /></button>
            </div>
            <span style={{
              display: 'inline-block', marginBottom: '14px', padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
              background: selected.netProfit >= 0 ? '#ecfdf5' : '#fef2f2',
              color: selected.netProfit >= 0 ? '#0ea77b' : '#c81e1e',
            }}>
              {selected.netProfit >= 0 ? '▲ ربح' : '▼ خسارة'} · {selected.profitMargin.toFixed(1)}%
            </span>

            <Section title="💰 الإيرادات" rows={[
              ['فواتير البيع', selected.revenue, '#0ea77b'],
              ['إشعارات دائن', -selected.creditNotes, '#c81e1e'],
              ['صافي الإيراد', selected.netRevenue, '#1a56db'],
              ['المحصّل', selected.collected, '#0891b2'],
              ['غير المحصّل', selected.uncollected, '#e6820a'],
            ]} />
            <Section title="💸 التكاليف" rows={[
              ['فواتير الموردين', selected.vendorPurchases, '#c81e1e'],
              ['مواد (مصروفات)', selected.expenseMaterials, '#e6820a'],
              ['عمالة مباشرة', selected.expenseLabor, '#7c3aed'],
              ['مقاولون فرعيون', selected.expenseSubcontractors, '#6366f1'],
              ['مصروفات أخرى', selected.expenseOther, '#6b7280'],
              ['إجمالي التكاليف', selected.totalCosts, '#c81e1e'],
            ]} />
            <div style={{ marginTop: '12px', padding: '12px', borderRadius: '10px', background: selected.netProfit >= 0 ? '#ecfdf5' : '#fef2f2', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>صافي الربح</span>
              <span style={{ fontWeight: 800, color: selected.netProfit >= 0 ? '#0ea77b' : '#c81e1e' }}>{fmtMoney(selected.netProfit)} ر.س</span>
            </div>
            {selected.estimatedValue > 0 && (
              <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#9ca3af' }}>
                القيمة التقديرية للعقد: {fmtMoney(selected.estimatedValue)} ر.س
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, rows }: { title: string; rows: [string, number, string][] }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontWeight: 700, fontSize: '0.78rem', marginBottom: '8px', color: '#374151' }}>{title}</div>
      {rows.map(([label, value, color]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.78rem' }}>
          <span style={{ color: '#6b7280' }}>{label}</span>
          <span style={{ fontWeight: 600, color }}>{fmtMoney(Math.abs(value))}{value < 0 ? ' −' : ''}</span>
        </div>
      ))}
    </div>
  )
}
