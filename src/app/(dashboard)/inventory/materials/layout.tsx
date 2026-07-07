// src/app/(dashboard)/inventory/materials/layout.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Package } from 'lucide-react'
import type { Warehouse } from './opsShared'
import { MaterialsContext, type ProjectLite } from './MaterialsContext'

// ملاحظة: useMaterials وتعريف Context في ملف MaterialsContext.tsx منفصل
// لأن ملفات layout.tsx في Next.js App Router تسمح فقط بصادرة المكوّن الافتراضي
// (تصدير named export من نفس layout.tsx يكسر البناء)

const TABS = [
  { href: '/inventory/materials/items',    label: 'الأصناف والأرصدة', emoji: '📦', color: '#1a56db' },
  { href: '/inventory/materials/receive',  label: 'أذون الاستلام',    emoji: '📥', color: '#0ea77b' },
  { href: '/inventory/materials/issue',    label: 'أذون الصرف',       emoji: '📤', color: '#c81e1e' },
  { href: '/inventory/materials/returns',  label: 'إرجاع للعميل',     emoji: '↩️', color: '#e6820a' },
  { href: '/inventory/materials/transfer', label: 'أذون التحويل',     emoji: '🔄', color: '#0891b2' },
]

export default function MaterialsLayout({ children }: { children: React.ReactNode }) {
  const { tenant, activeBranch } = useStore()
  const pathname = usePathname()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [projects, setProjects]     = useState<ProjectLite[]>([])
  const [loading, setLoading]       = useState(true)

  // ══ بطاقات KPI — عدّادات خفيفة (head:true لا تجلب صفوفاً) ══
  const [kpis, setKpis] = useState({ total: 0, out: 0, low: 0, sec: 0 })

  const reloadShared = useCallback(async () => {
    if (!tenant) return
    const [whRes, projRes] = await Promise.all([
      supabase.from('warehouses').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('projects').select('id, name, status').eq('tenant_id', tenant.id)
        .not('status', 'eq', 'مكتمل').order('name'),
    ])
    setWarehouses(whRes.data || [])
    setProjects(projRes.data || [])
  }, [tenant?.id])

  const reloadKpis = useCallback(async () => {
    if (!tenant) return
    const base = () => supabase.from('materials').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id)
    const [t, o, l, s] = await Promise.all([
      base(),
      base().lte('qty', 0),
      base().gt('qty', 0).lte('qty', 10),
      base().eq('source', 'SEC'),
    ])
    setKpis({ total: t.count || 0, out: o.count || 0, low: l.count || 0, sec: s.count || 0 })
  }, [tenant?.id])

  useEffect(() => {
    if (!tenant) return
    setLoading(true)
    Promise.all([reloadShared(), reloadKpis()]).finally(() => setLoading(false))
  }, [tenant?.id])

  // ══ تحديث العدّادات عند التنقل بين التبويبات (بعد أي عملية) ══
  useEffect(() => { reloadKpis() }, [pathname])

  const activeTab = TABS.find(t => pathname?.startsWith(t.href))

  return (
    <MaterialsContext.Provider value={{
      tenantId: tenant?.id || null, branchId: activeBranch?.id ?? null,
      warehouses, projects, loading, reloadShared, reloadKpis,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ══ الهيدر ══ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package style={{ width: '20px', height: '20px', color: '#1a56db' }} />
              المواد
            </h1>
            <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>الأصناف والأرصدة — أذون الاستلام والصرف والإرجاع والتحويل</p>
          </div>
        </div>

        {/* ══ بطاقات KPI ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'إجمالي المواد',   value: kpis.total, color: '#1a56db', bg: '#eff6ff' },
            { label: 'مواد نفدت',       value: kpis.out,   color: '#c81e1e', bg: '#fef2f2' },
            { label: 'كمية منخفضة (≤10)', value: kpis.low, color: '#e6820a', bg: '#fffbeb' },
            { label: 'مواد SEC',        value: kpis.sec,   color: '#0ea77b', bg: '#ecfdf5' },
          ].map(kpi => (
            <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.value.toLocaleString()}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '3px' }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* ══ شريط التبويبات — روابط حقيقية (زر الرجوع بالمتصفح يشتغل، وكل تبويب رابط مستقل) ══ */}
        <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const active = pathname?.startsWith(t.href)
            return (
              <Link key={t.href} href={t.href}
                style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s',
                  background: active ? t.color : 'transparent',
                  color: active ? 'white' : 'var(--text3)',
                  boxShadow: active ? '0 2px 8px ' + t.color + '44' : 'none' }}>
                {t.emoji} {t.label}
              </Link>
            )
          })}
        </div>

        {/* ══ محتوى التبويب الحالي ══ */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: (activeTab?.color || '#1a56db'), borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : children}

      </div>
    </MaterialsContext.Provider>
  )
}
