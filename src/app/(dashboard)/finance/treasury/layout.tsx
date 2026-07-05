// src/app/(dashboard)/finance/treasury/layout.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Wallet } from 'lucide-react'
import type { CashAccount, Custody, Project, Employee } from '@/lib/treasury-types'
import { TreasuryContext } from './TreasuryContext'

const TABS = [
  { href: '/finance/treasury/accounts',  label: '🏦 الحسابات النقدية', color: '#1a56db' },
  { href: '/finance/treasury/custody',   label: '👤 عهد وسلف',          color: '#e6820a' },
  { href: '/finance/treasury/transfers', label: '🔄 التحويلات',          color: '#7c3aed' },
]

export default function TreasuryLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = useStore()
  const pathname = usePathname()

  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [custodies, setCustodies]       = useState<Custody[]>([])
  const [employees, setEmployees]       = useState<Employee[]>([])
  const [projects, setProjects]         = useState<Project[]>([])
  const [loading, setLoading]           = useState(true)

  const reloadAll = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    const [balRes, cusRes, caRes, projRes, empRes] = await Promise.all([
      supabase.rpc('get_cash_account_balances', { p_tenant_id: tenant.id }),
      supabase.from('finance_employee_custody').select('*, project:projects(name)').eq('tenant_id', tenant.id).order('custody_date', { ascending: false }),
      supabase.from('finance_cash_accounts').select('*').eq('tenant_id', tenant.id).order('is_active', { ascending: false }).order('name'),
      supabase.from('projects').select('id,name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('hr_employees').select('id, employee_id, employee:employees!hr_employees_employee_id_fkey(name)').eq('tenant_id', tenant.id).eq('is_active', true),
    ])
    setCustodies(cusRes.data || [])
    // ══ الرصيد من دفتر الأستاذ (القيود المعتمدة) — مصدر الحقيقة الوحيد ══
    // أي صرف/قبض من أي صفحة (مشتريات، مصروفات، تحصيل، تحويلات...) ينشئ قيداً
    // فينعكس تلقائياً على الرصيد هنا — بدون الاعتماد على سجلات finance_treasury
    const balMap = new Map<number, number>(
      ((balRes.data || []) as any[]).map(b => [Number(b.cash_account_id), Number(b.ledger_balance)])
    )
    const caData = (caRes.data || []).map((ca: CashAccount) => ({ ...ca, balance: balMap.get(ca.id) ?? 0 }))
    setCashAccounts(caData)
    setProjects(projRes.data || [])
    setEmployees((empRes.data || []).map((e: any) => ({
      id: e.id,
      name: Array.isArray(e.employee) ? e.employee[0]?.name : e.employee?.name || '—',
    })).filter((e: any) => e.name !== '—'))
    setLoading(false)
  }, [tenant?.id])

  useEffect(() => { reloadAll() }, [tenant?.id])

  const netBalance    = cashAccounts.reduce((s, a) => s + (a.balance || 0), 0)
  const openCustodies = custodies.filter(c => c.status === 'مفتوحة').reduce((s, c) => s + Number(c.amount) - Number(c.settled_amount), 0)
  const activeTab = TABS.find(t => pathname?.startsWith(t.href))

  return (
    <TreasuryContext.Provider value={{ tenantId: tenant?.id || null, cashAccounts, employees, projects, loading, reloadAll }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet style={{ width: '20px', height: '20px', color: '#1a56db' }} />
            الخزينة
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>الحسابات النقدية — العهد والسلف — التحويلات الداخلية</p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'الرصيد الإجمالي',     value: netBalance.toLocaleString(),   color: 'white',   bg: 'linear-gradient(135deg, #1a56db, #3b82f6)' },
            { label: 'عدد الحسابات',        value: String(cashAccounts.length),   color: '#1a56db', bg: '#eff6ff' },
            { label: 'عهد مفتوحة (ر.س)',   value: openCustodies.toLocaleString(), color: '#e6820a', bg: '#fffbeb' },
            { label: 'عدد العهد المفتوحة', value: String(custodies.filter(c => c.status === 'مفتوحة').length), color: '#e6820a', bg: '#fffbeb' },
          ].map(kpi => (
            <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* التابات */}
        <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const active = pathname?.startsWith(t.href)
            return (
              <Link key={t.href} href={t.href}
                style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s',
                  background: active ? t.color : 'transparent',
                  color: active ? 'white' : 'var(--text3)',
                  boxShadow: active ? '0 2px 8px ' + t.color + '44' : 'none' }}>
                {t.label}
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
    </TreasuryContext.Provider>
  )
}
