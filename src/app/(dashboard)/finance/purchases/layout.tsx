// src/app/(dashboard)/finance/purchases/layout.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { ShoppingCart } from 'lucide-react'
import type { Vendor, Project, Warehouse } from '@/lib/purchases-types'
import { PurchasesContext } from './PurchasesContext'

// ملاحظة: usePurchases وتعريف Context انتقلا لملف PurchasesContext.tsx منفصل
// لأن ملفات layout.tsx في Next.js App Router تسمح فقط بصادرة المكوّن الافتراضي
// (تصدير named export مثل usePurchases من نفس layout.tsx يكسر البناء)

const TABS = [
  { href: '/finance/purchases/orders',     label: 'أوامر الشراء',      emoji: '📋', color: '#e6820a' },
  { href: '/finance/purchases/invoices',   label: 'فواتير الموردين',   emoji: '🧾', color: '#c81e1e' },
  { href: '/finance/purchases/returns',    label: 'المرتجعات',         emoji: '↩️', color: '#6b7280' },
  { href: '/finance/purchases/debitnotes', label: 'الإشعارات المدينة', emoji: '📑', color: '#7c3aed' },
  { href: '/finance/purchases/vendors',    label: 'الموردون',          emoji: '🏭', color: '#1a56db' },
]

export default function PurchasesLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = useStore()
  const pathname = usePathname()

  const [vendors, setVendors]       = useState<Vendor[]>([])
  const [projects, setProjects]     = useState<Project[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading]       = useState(true)

  // ══ بطاقات KPI — استعلام مجمّع خفيف مستقل عن ترقيم الجداول (يعطي الإجمالي الحقيقي دائماً) ══
  const [kpis, setKpis] = useState({ totalPO: 0, totalInv: 0, totalPaid: 0, totalDue: 0 })

  const reloadShared = useCallback(async () => {
    if (!tenant) return
    const [venRes, projRes, whRes] = await Promise.all([
      supabase.from('finance_vendors').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('projects').select('id, name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('warehouses').select('id, name, wh_type').eq('tenant_id', tenant.id),
    ])
    setVendors(venRes.data || [])
    setProjects(projRes.data || [])
    setWarehouses(whRes.data || [])
  }, [tenant?.id])

  const reloadKpis = useCallback(async () => {
    if (!tenant) return
    const [poRes, invRes] = await Promise.all([
      supabase.from('finance_purchase_orders').select('total_amount').eq('tenant_id', tenant.id),
      supabase.from('finance_vendor_invoices').select('total_amount, status').eq('tenant_id', tenant.id),
    ])
    const totalPO  = (poRes.data || []).reduce((s, p: any) => s + Number(p.total_amount), 0)
    const invData  = invRes.data || []
    const totalInv = invData.reduce((s, i: any) => s + Number(i.total_amount), 0)
    const totalPaid= invData.filter((i: any) => i.status === 'مدفوعة').reduce((s, i: any) => s + Number(i.total_amount), 0)
    const totalDue = invData.filter((i: any) => i.status !== 'مدفوعة' && i.status !== 'ملغاة' && i.status !== 'مرتجعة').reduce((s, i: any) => s + Number(i.total_amount), 0)
    setKpis({ totalPO, totalInv, totalPaid, totalDue })
  }, [tenant?.id])

  useEffect(() => {
    if (!tenant) return
    setLoading(true)
    Promise.all([reloadShared(), reloadKpis()]).finally(() => setLoading(false))
  }, [tenant?.id])

  // ══ إعادة تحميل KPIs عند العودة لصفحة أوامر الشراء أو الفواتير (بعد أي إضافة/تعديل) ══
  useEffect(() => { reloadKpis() }, [pathname])

  const activeTab = TABS.find(t => pathname?.startsWith(t.href))

  return (
    <PurchasesContext.Provider value={{ tenantId: tenant?.id || null, vendors, projects, warehouses, loading, reloadShared, reloadKpis }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ══ الهيدر ══ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart style={{ width: '20px', height: '20px', color: '#e6820a' }} />
              المشتريات
            </h1>
            <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>أوامر الشراء — فواتير الموردين — المرتجعات — الإشعارات المدينة</p>
          </div>
        </div>

        {/* ══ بطاقات KPI — إجمالي حقيقي بغض النظر عن الترقيم ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'إجمالي أوامر الشراء', value: kpis.totalPO,   color: '#e6820a', bg: '#fffbeb' },
            { label: 'إجمالي الفواتير',     value: kpis.totalInv,  color: '#c81e1e', bg: '#fef2f2' },
            { label: 'إجمالي المدفوع',      value: kpis.totalPaid, color: '#0ea77b', bg: '#ecfdf5' },
            { label: 'المستحق للموردين',    value: kpis.totalDue,  color: '#374151', bg: '#f3f4f6' },
          ].map(kpi => (
            <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.value.toLocaleString()} <span style={{ fontSize: '0.72rem', fontWeight: 400 }}>ر.س</span></div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{kpi.label}</div>
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
    </PurchasesContext.Provider>
  )
}
