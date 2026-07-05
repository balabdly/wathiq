// src/app/(dashboard)/finance/expenses/layout.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Receipt } from 'lucide-react'
import type { Account, CostCenter, Project, Vendor, Client, CashAccount } from '@/lib/expenses-types'
import { ExpensesContext } from './ExpensesContext'

const TABS = [
  { href: '/finance/expenses/list',     label: '💸 المصروفات',      color: '#e6820a' },
  { href: '/finance/expenses/receipts', label: '💵 سندات القبض',   color: '#0ea77b' },
  { href: '/finance/expenses/payments', label: '💸 سندات الصرف',   color: '#c81e1e' },
  { href: '/finance/expenses/analysis', label: '📊 تحليل المشاريع', color: '#7c3aed' },
]

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = useStore()
  const pathname = usePathname()

  const [accounts, setAccounts]         = useState<Account[]>([])
  const [costCenters, setCostCenters]   = useState<CostCenter[]>([])
  const [projects, setProjects]         = useState<Project[]>([])
  const [vendors, setVendors]           = useState<Vendor[]>([])
  const [clients, setClients]           = useState<Client[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [loading, setLoading]           = useState(true)

  const reloadShared = useCallback(async () => {
    if (!tenant) return
    const [accRes, ccRes, projRes, venRes, cliRes, cashRes] = await Promise.all([
      supabase.from('finance_accounts').select('id,code,name,account_type,is_parent').eq('tenant_id', tenant.id).eq('is_active', true).order('code'),
      supabase.from('finance_cost_centers').select('id,code,name').eq('tenant_id', tenant.id).eq('is_active', true),
      supabase.from('projects').select('id,name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('finance_vendors').select('id,name').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
      supabase.from('finance_clients').select('id,name').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
      supabase.from('finance_cash_accounts').select('id,name,account_type,account_id').eq('tenant_id', tenant.id).eq('is_active', true),
    ])
    setAccounts(accRes.data || [])
    setCostCenters(ccRes.data || [])
    setProjects(projRes.data || [])
    setVendors(venRes.data || [])
    setClients(cliRes.data || [])
    setCashAccounts(cashRes.data || [])
  }, [tenant?.id])

  useEffect(() => {
    if (!tenant) return
    setLoading(true)
    reloadShared().finally(() => setLoading(false))
  }, [tenant?.id])

  const activeTab = TABS.find(t => pathname?.startsWith(t.href))

  return (
    <ExpensesContext.Provider value={{ tenantId: tenant?.id || null, accounts, costCenters, projects, vendors, clients, cashAccounts, loading, reloadShared }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt style={{ width: '20px', height: '20px', color: '#e6820a' }} />
            المصروفات
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>مصروفات المشاريع والتشغيل — سندات القبض والصرف — تحليل المشاريع</p>
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
                {t.label}
              </Link>
            )
          })}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: (activeTab?.color || '#e6820a'), borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : children}
      </div>
    </ExpensesContext.Provider>
  )
}
