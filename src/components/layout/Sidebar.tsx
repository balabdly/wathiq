'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'لوحة التحكم',    perm: 'dashboard',     module: null,        icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { href: '/projects',  label: 'المشاريع',        perm: 'projects_view', module: 'projects',  icon: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' },
  { href: '/visits',    label: 'الزيارات الفنية', perm: 'visits_quality',module: 'visits',    icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11' },
  { href: '/qhse',      label: 'السلامة والجودة', perm: 'qhse',          module: 'qhse',      icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { href: '/inventory', label: 'المخزون',         perm: 'inventory',     module: 'inventory', icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z' },
  { href: '/purchases', label: 'المشتريات',       perm: 'purchases',     module: 'purchases', icon: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0' },
  { href: '/employees', label: 'المستخدمون والصلاحيات', perm: 'employees', module: 'employees', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
  { href: '/reports',   label: 'التقارير',        perm: 'reports',       module: 'reports',   icon: 'M18 20V10M12 20V4M6 20v-6' },
  { href: '/settings',  label: 'الإعدادات',       perm: 'settings',      module: null,        icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' },
]

const HR_ITEMS = [
  { tab: 'employees',  label: 'ملفات الموظفين',  icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
  { tab: 'attendance', label: 'الحضور والغياب',  icon: 'M12 22V12M12 12V2M12 12H2M12 12h10' },
  { tab: 'leaves',     label: 'الإجازات',         icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { tab: 'payroll',    label: 'الرواتب',          icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { tab: 'documents',  label: 'الوثائق',          icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { tab: 'jobs',       label: 'عروض الوظائف',    icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUser, tenant, activeBranch, branches, setActiveBranch, reset, setActiveHRTab, activeHRTab } = useStore()
  const perms = currentUser?.permissions || []
  const [hrOpen, setHrOpen] = useState(pathname.startsWith('/hr'))

  const tenantModules = (tenant as any)?.modules || {}
  const visibleNav = NAV_ITEMS.filter(item => {
    if (item.module && tenantModules[item.module] === false) return false
    if (item.perm === 'visits_quality') return perms.some((p: string) => p.startsWith('visits'))
    if (item.perm === 'settings') return currentUser?.role === 'مدير عام'
    return perms.includes(item.perm)
  })

  const showHR = perms.includes('employees')
  const isHRActive = pathname.startsWith('/hr')

  function handleHRItemClick(tab: string) {
    setActiveHRTab(tab)
    if (tab === 'jobs') {
      router.push('/hr/jobs')
    } else {
      router.push('/hr')
    }
  }

  return (
    <div className="sidebar">
      {/* Header */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '38px', height: '38px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2 }}>
              {tenant?.name || 'وثيق ERP'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>مقاول كهرباء معتمد</div>
          </div>
        </div>
        {branches.length > 1 ? (
          <select value={activeBranch?.id || ''} onChange={e => {
            const b = branches.find(b => b.id === Number(e.target.value))
            if (b) setActiveBranch(b)
          }} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', borderRadius: '8px', padding: '6px 10px', fontSize: '0.8rem', width: '100%' }}>
            {branches.map(b => <option key={b.id} value={b.id} style={{ color: '#1a1a1a', background: 'white' }}>{b.name}</option>)}
          </select>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 10px',
            color: 'white', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
            </svg>
            {activeBranch?.name || 'الفرع الرئيسي'}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {visibleNav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} className={`sidebar-item ${active ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d={item.icon}/>
              </svg>
              <span>{item.label}</span>
            </Link>
          )
        })}

        {/* ── الموارد البشرية Dropdown ── */}
        {showHR && (
          <div>
            <button onClick={() => setHrOpen(!hrOpen)}
              className={`sidebar-item ${isHRActive ? 'active' : ''}`}
              style={{ width: '100%', justifyContent: 'space-between',
                background: isHRActive ? 'rgba(255,255,255,0.2)' : hrOpen ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="18" height="18">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M12 7a4 4 0 110 8 4 4 0 010-8z"/>
                </svg>
                <span>الموارد البشرية</span>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"
                style={{ transform: hrOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {hrOpen && (
              <div style={{ marginTop: '2px', marginRight: '8px', borderRight: '2px solid rgba(255,255,255,0.15)', paddingRight: '8px' }}>
                {HR_ITEMS.map(item => {
                  const isActive = isHRActive && activeHRTab === item.tab
                  return (
                    <button key={item.tab}
                      onClick={() => handleHRItemClick(item.tab)}
                      className={`sidebar-item ${isActive ? 'active' : ''}`}
                      style={{ width: '100%', fontSize: '0.825rem', padding: '8px 10px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="15" height="15">
                        <path d={item.icon}/>
                      </svg>
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>{currentUser?.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>{currentUser?.role}</div>
        </div>
        <button onClick={() => { reset(); router.push('/login') }}
          style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
          تسجيل الخروج
        </button>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: '8px' }}>وثيق v1.0</div>
      </div>
    </div>
  )
}
