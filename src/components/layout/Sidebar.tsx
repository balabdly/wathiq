'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'لوحة التحكم',    perm: 'dashboard',     module: null,        icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { href: '/projects',  label: 'المشاريع',        perm: 'projects_view', module: 'projects',  icon: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' },
  { href: '/visits',    label: 'الزيارات الفنية', perm: 'visits_quality',module: 'visits',    icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11' },
  { href: '/qhse',      label: 'السلامة والجودة', perm: 'qhse',          module: 'qhse',      icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { href: '/inventory', label: 'المخزون',         perm: 'inventory',     module: 'inventory', icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z' },
  { href: '/purchases', label: 'المشتريات',       perm: 'purchases',     module: 'purchases', icon: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0' },
  { href: '/employees', label: 'الموظفون',        perm: 'employees',     module: 'employees', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
  { href: '/reports',   label: 'التقارير',        perm: 'reports',       module: 'reports',   icon: 'M18 20V10M12 20V4M6 20v-6' },
  { href: '/settings',  label: 'الإعدادات',       perm: 'settings',      module: null,        icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUser, tenant, activeBranch, branches, setActiveBranch, reset } = useStore()
  const perms = currentUser?.permissions || []

  const tenantModules = (tenant as any)?.modules || {}
  const visibleNav = NAV_ITEMS.filter(item => {
    if (item.module && tenantModules[item.module] === false) return false
    if (item.perm === 'visits_quality') return perms.some((p: string) => p.startsWith('visits'))
    if (item.perm === 'settings') return currentUser?.role === 'مدير عام'
    return perms.includes(item.perm)
  })

  return (
    <div className="sidebar" style={{
      position: 'relative',
      width: '100%',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
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

        {/* Branch */}
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
            <Link key={item.href} href={item.href}
              className={`sidebar-item ${active ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d={item.icon}/>
              </svg>
              <span>{item.label}</span>
            </Link>
          )
        })}
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
