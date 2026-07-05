// src/app/(dashboard)/finance/expenses/analysis/page.tsx
// ⚠️ ملاحظة: هذا التبويب مؤقت هنا — القرار المتفق عليه نقله لاحقاً إلى
// /reports/project-profitability لأنه تقرير تحليلي (إيراد + مصروف) لا إجراء تشغيلي
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart2 } from 'lucide-react'
import { useExpenses } from '../ExpensesContext'
import type { Project } from '@/lib/expenses-types'
import { TYPE_COLOR, fmt } from '@/lib/expenses-types'

// ════════════════════════════════════════
// تاب: تحليل المشاريع
// ════════════════════════════════════════
function ProjectAnalysisTab({ tenantId, projects }: { tenantId: string; projects: Project[] }) {
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function loadAnalysis(projectId: string) {
    if (!projectId) { setAnalysis(null); return }
    setLoading(true)
    const pid = Number(projectId)

    const [invRes, expRes, poRes, rcvRes, payRes] = await Promise.all([
      // فواتير البيع
      supabase.from('finance_invoices').select('total_amount, vat_amount, status')
        .eq('tenant_id', tenantId).eq('project_id', pid),
      // المصروفات
      supabase.from('finance_expenses').select('total_amount, expense_type, category, status')
        .eq('tenant_id', tenantId).eq('project_id', pid),
      // أوامر الشراء
      supabase.from('finance_purchase_orders').select('total_amount, status')
        .eq('tenant_id', tenantId).eq('project_id', pid),
      // سندات القبض
      supabase.from('finance_treasury').select('amount, type')
        .eq('tenant_id', tenantId).eq('project_id', pid).eq('type', 'قبض'),
      // سندات الصرف
      supabase.from('finance_treasury').select('amount, type')
        .eq('tenant_id', tenantId).eq('project_id', pid).eq('type', 'صرف'),
    ])

    const invoices  = invRes.data  || []
    const expenses  = expRes.data  || []
    const purchases = poRes.data   || []
    const receipts  = rcvRes.data  || []
    const payments  = payRes.data  || []

    const totalInvoices    = invoices.filter(i => i.status !== 'ملغاة').reduce((s, i) => s + Number(i.total_amount), 0)
    const totalCollected   = receipts.reduce((s, r) => s + Number(r.amount), 0)
    const totalExpenses    = expenses.filter(e => e.status !== 'ملغي').reduce((s, e) => s + Number(e.total_amount), 0)
    const totalPurchases   = purchases.filter(p => p.status !== 'ملغي').reduce((s, p) => s + Number(p.total_amount), 0)
    const totalPaid        = payments.reduce((s, p) => s + Number(p.amount), 0)
    const totalCosts       = totalExpenses + totalPurchases
    const netProfit        = totalInvoices - totalCosts
    const profitMargin     = totalInvoices > 0 ? (netProfit / totalInvoices * 100) : 0
    const uncollected      = totalInvoices - totalCollected

    // تفصيل المصروفات
    const expByType: Record<string, number> = {}
    expenses.filter(e => e.status !== 'ملغي').forEach(e => {
      expByType[e.expense_type] = (expByType[e.expense_type] || 0) + Number(e.total_amount)
    })

    setAnalysis({ totalInvoices, totalCollected, uncollected, totalExpenses, totalPurchases, totalCosts, totalPaid, netProfit, profitMargin, expByType, invoiceCount: invoices.length, expenseCount: expenses.length, purchaseCount: purchases.length })
    setLoading(false)
  }

  const project = projects.find(p => p.id === Number(selectedProject))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* اختيار المشروع */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <BarChart2 style={{ width: '22px', height: '22px', color: '#7c3aed' }} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>اختر مشروعاً لعرض تحليله المالي:</span>
          <select value={selectedProject}
            onChange={e => { setSelectedProject(e.target.value); loadAnalysis(e.target.value) }}
            className="select" style={{ minWidth: '280px', flex: 1 }}>
            <option value="">— اختر مشروع —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {!loading && !analysis && (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <BarChart2 style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)', fontSize: '0.9rem' }}>اختر مشروعاً لعرض التحليل المالي</p>
        </div>
      )}

      {!loading && analysis && project && (
        <>
          {/* عنوان */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '4px', height: '28px', background: '#7c3aed', borderRadius: '2px' }} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1a1a2e' }}>التحليل المالي — {project.name}</h2>
            <span style={{
              padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
              background: analysis.netProfit >= 0 ? '#ecfdf5' : '#fef2f2',
              color: analysis.netProfit >= 0 ? '#0ea77b' : '#c81e1e'
            }}>
              {analysis.netProfit >= 0 ? '▲ ربح' : '▼ خسارة'}
            </span>
          </div>

          {/* KPIs الرئيسية */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'إجمالي الإيرادات', value: analysis.totalInvoices, color: '#0ea77b', bg: '#ecfdf5', icon: '📄', sub: `${analysis.invoiceCount} فاتورة` },
              { label: 'إجمالي التكاليف',  value: analysis.totalCosts,    color: '#c81e1e', bg: '#fef2f2', icon: '💸', sub: `مصروفات + مشتريات` },
              { label: analysis.netProfit >= 0 ? 'صافي الربح' : 'صافي الخسارة', value: Math.abs(analysis.netProfit), color: analysis.netProfit >= 0 ? '#0ea77b' : '#c81e1e', bg: analysis.netProfit >= 0 ? '#ecfdf5' : '#fef2f2', icon: analysis.netProfit >= 0 ? '✅' : '⚠️', sub: `هامش ${analysis.profitMargin.toFixed(1)}%` },
              { label: 'نسبة الهامش',      value: analysis.profitMargin.toFixed(1) + '%', color: '#7c3aed', bg: '#f5f3ff', icon: '📊', sub: 'من الإيرادات', isText: true },
            ].map(kpi => (
              <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: '6px' }}>{kpi.icon} {kpi.label}</div>
                <div style={{ fontSize: (kpi as any).isText ? '1.6rem' : '1.2rem', fontWeight: 800, color: kpi.color }}>
                  {(kpi as any).isText ? kpi.value : fmt(Number(kpi.value)) + ' ر.س'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* تفصيل الإيرادات والتحصيل */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontWeight: 700, marginBottom: '14px', fontSize: '0.9rem', color: '#0ea77b' }}>💰 الإيرادات والتحصيل</div>
              {[
                { label: 'إجمالي الفواتير',    value: analysis.totalInvoices,  color: '#0ea77b' },
                { label: 'المحصّل (سندات قبض)', value: analysis.totalCollected,  color: '#1a56db' },
                { label: 'غير المحصّل',          value: analysis.uncollected,    color: '#e6820a' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bg2)' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: row.color, fontSize: '0.9rem' }}>{fmt(row.value)} ر.س</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontWeight: 700, marginBottom: '14px', fontSize: '0.9rem', color: '#c81e1e' }}>💸 التكاليف والمدفوعات</div>
              {[
                { label: 'مصروفات المشروع',      value: analysis.totalExpenses,  color: '#e6820a' },
                { label: 'مشتريات المشروع',       value: analysis.totalPurchases, color: '#c81e1e' },
                { label: 'المدفوع (سندات صرف)',   value: analysis.totalPaid,      color: '#1a56db' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bg2)' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: row.color, fontSize: '0.9rem' }}>{fmt(row.value)} ر.س</span>
                </div>
              ))}
            </div>
          </div>

          {/* تفصيل المصروفات حسب النوع */}
          {Object.keys(analysis.expByType).length > 0 && (
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontWeight: 700, marginBottom: '14px', fontSize: '0.9rem' }}>📋 تفصيل المصروفات حسب النوع</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {Object.entries(analysis.expByType).map(([type, amount]) => (
                  <div key={type} style={{ padding: '12px', background: TYPE_COLOR[type]?.bg || '#f3f4f6', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: TYPE_COLOR[type]?.color || '#374151', fontWeight: 700, marginBottom: '4px' }}>{type}</div>
                    <div style={{ fontWeight: 800, color: TYPE_COLOR[type]?.color || '#374151', fontSize: '0.95rem' }}>{fmt(Number(amount))} ر.س</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}


// ════════════════════════════════════════
// الصفحة
// ════════════════════════════════════════
export default function ProjectAnalysisPage() {
  const { tenantId, projects } = useExpenses()
  if (!tenantId) return null
  return <ProjectAnalysisTab tenantId={tenantId} projects={projects} />
}
