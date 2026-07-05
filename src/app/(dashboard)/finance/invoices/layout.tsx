// src/app/(dashboard)/finance/invoices/layout.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { FileText } from 'lucide-react'
import type { Client, Project, Company, CatalogItem } from '@/lib/sales-types'
import { SalesContext } from './SalesContext'

// ملاحظة: SalesContext وuseSales في ملف منفصل — layout.tsx في Next.js App Router
// يسمح فقط بصادرة المكوّن الافتراضي (named export آخر يكسر البناء)

const TABS = [
  { href: '/finance/invoices/list',         label: 'الفواتير',       emoji: '🧾', color: '#1a56db' },
  { href: '/finance/invoices/credit-notes', label: 'الإشعارات',      emoji: '↩️', color: '#c81e1e' },
  { href: '/finance/invoices/quotations',   label: 'عروض الأسعار',   emoji: '📋', color: '#7c3aed' },
  { href: '/finance/invoices/clients',      label: 'العملاء',        emoji: '👥', color: '#e6820a' },
]

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = useStore()
  const pathname = usePathname()

  const [clients, setClients]         = useState<Client[]>([])
  const [projects, setProjects]       = useState<Project[]>([])
  const [company, setCompany]         = useState<Company>({} as Company)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [loading, setLoading]         = useState(true)

  // ══ بطاقات KPI — استعلام مجمّع خفيف مستقل عن ترقيم الفواتير (إجمالي حقيقي دائماً) ══
  const [kpis, setKpis] = useState({ totalInvoiced: 0, totalCollected: 0, totalPending: 0 })

  const reloadShared = useCallback(async () => {
    if (!tenant) return
    const [clRes, compRes, projRes, catRes] = await Promise.all([
      supabase.from('finance_clients').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('tenants').select('*').eq('id', tenant.id).single(),
      supabase.from('projects').select('id, name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('finance_catalog_items').select('*').eq('tenant_id', tenant.id).order('item_type').order('name'),
    ])
    setClients(clRes.data || [])
    if (compRes.data) setCompany(compRes.data)
    setProjects(projRes.data || [])
    setCatalogItems(catRes.data || [])
  }, [tenant?.id])

  const reloadKpis = useCallback(async () => {
    if (!tenant) return
    const { data } = await supabase.from('finance_invoices').select('total_amount, status').eq('tenant_id', tenant.id)
    const inv = data || []
    const totalInvoiced  = inv.reduce((s, i: any) => s + Number(i.total_amount), 0)
    const totalCollected = inv.filter((i: any) => i.status === 'مدفوعة').reduce((s, i: any) => s + Number(i.total_amount), 0)
    const totalPending   = inv.filter((i: any) => i.status === 'مرسلة' || i.status === 'مسودة').reduce((s, i: any) => s + Number(i.total_amount), 0)
    setKpis({ totalInvoiced, totalCollected, totalPending })
  }, [tenant?.id])

  useEffect(() => {
    if (!tenant) return
    setLoading(true)
    Promise.all([reloadShared(), reloadKpis()]).finally(() => setLoading(false))
  }, [tenant?.id])

  useEffect(() => { reloadKpis() }, [pathname])

  const activeTab = TABS.find(t => pathname?.startsWith(t.href))

  return (
    <SalesContext.Provider value={{ tenantId: tenant?.id || null, clients, projects, company, catalogItems, loading, reloadShared, reloadKpis }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText style={{ width: '20px', height: '20px', color: '#1a56db' }} />
              فواتير المبيعات
            </h1>
            <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>الفواتير — الإشعارات الدائنة — عروض الأسعار — العملاء</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { label: 'إجمالي الفواتير',  value: kpis.totalInvoiced,  color: '#1a56db', bg: '#eff6ff' },
            { label: 'إجمالي المحصّل',   value: kpis.totalCollected, color: '#0ea77b', bg: '#ecfdf5' },
            { label: 'قيد التحصيل',      value: kpis.totalPending,   color: '#e6820a', bg: '#fffbeb' },
          ].map(kpi => (
            <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.value.toLocaleString()} <span style={{ fontSize: '0.72rem', fontWeight: 400 }}>ر.س</span></div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{kpi.label}</div>
            </div>
          ))}
        </div>

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

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: (activeTab?.color || '#1a56db'), borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : children}
      </div>
    </SalesContext.Provider>
  )
}
