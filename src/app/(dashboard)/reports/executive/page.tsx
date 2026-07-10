'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  fetchProjectsProfitability,
  summarizeProfitability,
  fmtMoney,
} from '@/lib/projectProfitability'
import { BarChart3, TrendingUp, FolderOpen, AlertTriangle, ArrowLeft } from 'lucide-react'

export default function ExecutiveReportsPage() {
  const { tenant, activeBranch } = useStore()
  const [profitSummary, setProfitSummary] = useState(summarizeProfitability([]))
  const [delayedCount, setDelayedCount] = useState(0)
  const [openNcr, setOpenNcr] = useState(0)
  const [lowStock, setLowStock] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenant?.id) return
    const today = new Date().toISOString().split('T')[0]

    async function load() {
      setLoading(true)
      const [profitRows, projRes, visitRes, matRes] = await Promise.all([
        fetchProjectsProfitability(tenant!.id, activeBranch?.id),
        supabase.from('projects').select('id, end_date, status').eq('tenant_id', tenant!.id),
        supabase.from('visits').select('id, specs, resolved_report').eq('tenant_id', tenant!.id),
        supabase.from('materials').select('id, qty, reorder').eq('tenant_id', tenant!.id).eq('is_active', true),
      ])

      setProfitSummary(summarizeProfitability(profitRows))

      const projects = projRes.data || []
      setDelayedCount(projects.filter(p =>
        p.end_date && p.end_date < today && p.status !== 'مكتمل' && p.status !== 'ملغى'
      ).length)

      const visits = visitRes.data || []
      setOpenNcr(visits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length)

      const mats = matRes.data || []
      setLowStock(mats.filter(m => Number(m.reorder || 0) > 0 && Number(m.qty || 0) <= Number(m.reorder)).length)

      setLoading(false)
    }
    load()
  }, [tenant?.id, activeBranch?.id])

  const kpis = [
    { label: 'صافي ربح المشاريع', value: fmtMoney(profitSummary.totalProfit) + ' ر.س', icon: TrendingUp, color: profitSummary.totalProfit >= 0 ? '#0ea77b' : '#c81e1e', bg: profitSummary.totalProfit >= 0 ? '#ecfdf5' : '#fef2f2', href: '/reports/project-profitability' },
    { label: 'إجمالي الإيراد', value: fmtMoney(profitSummary.totalRevenue) + ' ر.س', icon: BarChart3, color: '#1a56db', bg: '#eff6ff', href: '/reports/project-profitability' },
    { label: 'مشاريع نشطة', value: String(profitSummary.activeCount), icon: FolderOpen, color: '#0891b2', bg: '#ecfeff', href: '/reports/projects' },
    { label: 'مشاريع متأخرة', value: String(delayedCount), icon: AlertTriangle, color: '#c81e1e', bg: '#fef2f2', href: '/reports/projects' },
    { label: 'NCR مفتوحة', value: String(openNcr), icon: AlertTriangle, color: '#e6820a', bg: '#fffbeb', href: '/reports/visits' },
    { label: 'مواد تحت حد الأمان', value: String(lowStock), icon: AlertTriangle, color: '#7c3aed', bg: '#f5f3ff', href: '/reports/inventory' },
  ]

  const quickLinks = [
    { label: 'ربحية المشاريع', href: '/reports/project-profitability', desc: 'إيراد − تكاليف لكل مشروع' },
    { label: 'تقارير المالية', href: '/reports/finance', desc: 'قوائم مالية وذمم' },
    { label: 'تقارير الزيارات', href: '/reports/visits', desc: 'NCR وأداء المهندسين' },
    { label: 'مركز التقارير', href: '/reports', desc: 'كل الأقسام' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">
      <div>
        <Link href="/reports" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#9ca3af', textDecoration: 'none', marginBottom: '8px' }}>
          <ArrowLeft style={{ width: '14px', height: '14px' }} /> مركز التقارير
        </Link>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 style={{ width: '22px', height: '22px', color: '#1a56db' }} />
          لوحة التقارير التنفيذية
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '4px' }}>
          مؤشرات سريعة للإدارة — {profitSummary.projectCount} مشروع · {profitSummary.profitProjects} رابح · {profitSummary.lossProjects} خاسر
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#9ca3af' }}>جاري التحميل...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
            {kpis.map(k => {
              const Icon = k.icon
              return (
                <Link key={k.label} href={k.href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '18px', borderRadius: '14px', background: k.bg, border: `1px solid ${k.color}22`,
                    transition: 'transform 0.15s', cursor: 'pointer',
                  }}>
                    <Icon style={{ width: '20px', height: '20px', color: k.color, marginBottom: '8px' }} />
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: '4px' }}>{k.label}</div>
                    <div style={{ fontWeight: 800, fontSize: '1.15rem', color: k.color }}>{k.value}</div>
                  </div>
                </Link>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {quickLinks.map(l => (
              <Link key={l.href} href={l.href} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', background: 'white' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1a56db', marginBottom: '4px' }}>{l.label}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{l.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
