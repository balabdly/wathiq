'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { useState } from 'react'

const IC = {
  dashboard:   'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  projects:    'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  visits:      'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  inventory:   'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  shield:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  safety:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01',
  quality:     'M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  environment: 'M12 2a10 10 0 100 20A10 10 0 0012 2zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z',
  org:         'M3 3h6v6H3zM15 3h6v6h-6zM9 6h6M12 6v6M3 15h6v6H3zM15 15h6v6h-6zM6 15v-3M18 15v-3',
  hr:          'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M12 7a4 4 0 110 8 4 4 0 010-8z',
  attendance:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  leaves:      'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  payroll:     'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  documents:   'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  jobs:        'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  purchases:   'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
  reports:     'M18 20V10M12 20V4M6 20v-6',
  settings:    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  employees:   'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  logout:      'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  chevron:     'M6 9l6 6 6-6',
  branch:      'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
}

// ── ألوان الثيم ──
const C = {
  // الخلفيات
  sidebarBg:    '#0f2544',   // أزرق غامق جداً
  groupBg:      '#162d52',   // أزرق أغمق قليلاً للقسم
  subBg:        '#1a3660',   // خلفية العناصر الفرعية (فاتح نسبياً)
  activeBg:     '#1e4080',   // الخلفية عند التفعيل
  hoverBg:      '#1a3a6b',   // hover
  // النصوص
  textPrimary:  '#e8f0fe',   // نص أساسي أبيض مزرق
  textSecondary:'#7ea8d8',   // نص ثانوي أزرق فاتح
  textMuted:    '#4a7ab5',   // نص خافت
  // الاكسنت
  accent:       '#4d9fff',   // أزرق فاتح مضيء للعناصر النشطة
  accentLight:  '#93c5fd',   // أزرق فاتح جداً
  // الفواصل
  border:       '#1e3a6a',
}

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  )
}

// ── عنصر فرعي ──
function SubLink({ href, label, icon, active }: {
  href: string; label: string; icon: string; active: boolean
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '9px',
        padding: '8px 12px 8px 10px', borderRadius: '7px', marginBottom: '2px',
        background: active ? C.activeBg : 'transparent',
        borderRight: active ? `3px solid ${C.accent}` : '3px solid transparent',
        color: active ? C.textPrimary : C.textSecondary,
        fontSize: '0.83rem', fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.12s',
      }}
        onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = C.hoverBg; el.style.color = C.textPrimary } }}
        onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = C.textSecondary } }}
      >
        <span style={{ color: active ? C.accent : C.textMuted, display: 'flex' }}>
          <Icon d={icon} size={14} />
        </span>
        <span>{label}</span>
        {active && (
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.accent, marginRight: 'auto' }} />
        )}
      </div>
    </Link>
  )
}

// ── قسم رئيسي قابل للطي ──
function NavSection({ label, icon, isActive, isOpen, onToggle, children }: {
  label: string; icon: string
  isActive: boolean; isOpen: boolean
  onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: '3px' }}>
      {/* زر القسم */}
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 12px', border: 'none', borderRadius: '9px', cursor: 'pointer',
        background: isOpen ? C.groupBg : 'transparent',
        transition: 'background 0.15s',
        borderBottom: isOpen ? `1px solid ${C.border}` : '1px solid transparent',
      }}>
        {/* أيقونة */}
        <div style={{
          width: '30px', height: '30px', borderRadius: '7px', flexShrink: 0,
          background: isOpen || isActive ? C.activeBg : 'rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isOpen || isActive ? C.accent : C.textMuted,
          transition: 'all 0.15s',
        }}>
          <Icon d={icon} size={15} />
        </div>

        {/* النص */}
        <span style={{
          flex: 1, textAlign: 'right', fontSize: '0.875rem', fontWeight: 600,
          color: isOpen || isActive ? C.textPrimary : C.textSecondary,
        }}>
          {label}
        </span>

        {/* سهم */}
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{
            color: isOpen ? C.accentLight : C.textMuted,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s, color 0.2s', flexShrink: 0,
          }}>
          <path d={IC.chevron} />
        </svg>
      </button>

      {/* العناصر الفرعية */}
      {isOpen && (
        <div style={{
          background: C.subBg, borderRadius: '0 0 9px 9px',
          padding: '6px 8px 8px 8px',
          borderTop: 'none',
          marginBottom: '2px',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── عنصر مستقل ──
function StandaloneLink({ href, label, icon, active }: {
  href: string; label: string; icon: string; active: boolean
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 12px', borderRadius: '9px', marginBottom: '3px',
        background: active ? C.activeBg : 'transparent',
        color: active ? C.textPrimary : C.textSecondary,
        fontSize: '0.875rem', fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.12s',
        borderRight: active ? `3px solid ${C.accent}` : '3px solid transparent',
      }}
        onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = C.hoverBg; el.style.color = C.textPrimary } }}
        onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = C.textSecondary } }}
      >
        <div style={{
          width: '30px', height: '30px', borderRadius: '7px', flexShrink: 0,
          background: active ? C.activeBg : 'rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: active ? C.accent : C.textMuted,
        }}>
          <Icon d={icon} size={15} />
        </div>
        <span>{label}</span>
      </div>
    </Link>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: C.border, margin: '6px 0' }} />
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const { currentUser, tenant, activeBranch, branches, setActiveBranch, reset } = useStore()
  const perms: string[] = currentUser?.permissions || []
  const tenantModules   = (tenant as any)?.modules || {}
  const isAdmin         = currentUser?.role === 'مدير عام'

  const hasProjects  = perms.includes('projects_view')              && tenantModules.projects  !== false
  const hasVisits    = perms.some((p: string) => p.startsWith('visits')) && tenantModules.visits !== false
  const hasInventory = perms.includes('inventory')                  && tenantModules.inventory !== false
  const hasQHSE      = perms.includes('qhse')                      && tenantModules.qhse      !== false
  const hasPurchases = perms.includes('purchases')                  && tenantModules.purchases !== false
  const hasReports   = perms.includes('reports')
  const hasHR        = perms.includes('employees')
  const hasDashboard = perms.includes('dashboard')

  const inProjects = pathname === '/dashboard' || ['/projects','/visits','/inventory'].some(p => pathname === p || pathname.startsWith(p+'/'))
  const inQHSE     = pathname.startsWith('/qhse')
  const inHR       = pathname.startsWith('/hr')
  const inSettings = pathname.startsWith('/settings') || pathname.startsWith('/employees')

  const [projectsOpen, setProjectsOpen] = useState(inProjects)
  const [qhseOpen,     setQhseOpen]     = useState(inQHSE)
  const [hrOpen,       setHrOpen]       = useState(inHR)
  const [settingsOpen, setSettingsOpen] = useState(inSettings)

  return (
    <div className="sidebar" style={{
      background: C.sidebarBg, display: 'flex', flexDirection: 'column', height: '100%',
    }}>

      {/* ════ Header ════ */}
      <div style={{ padding: '16px 14px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {/* الشعار */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
            background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon d={IC.shield} size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.textPrimary, fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tenant?.name || 'وثيق ERP'}
            </div>
            <div style={{ color: C.textMuted, fontSize: '0.7rem', marginTop: '1px' }}>مقاول كهرباء معتمد</div>
          </div>
        </div>

        {/* الفرع */}
        {branches.length > 1 ? (
          <select
            value={activeBranch?.id || ''}
            onChange={e => { const b = branches.find(b => b.id === Number(e.target.value)); if (b) setActiveBranch(b) }}
            style={{
              width: '100%', background: C.groupBg, border: `1px solid ${C.border}`,
              color: C.textPrimary, borderRadius: '8px', padding: '7px 10px', fontSize: '0.8rem', cursor: 'pointer',
            }}>
            {branches.map(b => <option key={b.id} value={b.id} style={{ background: '#1a2744', color: C.textPrimary }}>{b.name}</option>)}
          </select>
        ) : (
          <div style={{
            background: C.groupBg, border: `1px solid ${C.border}`,
            borderRadius: '8px', padding: '7px 10px',
            color: C.textSecondary, fontSize: '0.8rem',
            display: 'flex', alignItems: 'center', gap: '7px',
          }}>
            <Icon d={IC.branch} size={13} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeBranch?.name || 'الفرع الرئيسي'}
            </span>
          </div>
        )}
      </div>

      {/* ════ Nav ════ */}
      <nav style={{ flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* إدارة المشاريع */}
        {(hasDashboard || hasProjects || hasVisits || hasInventory) && (
          <NavSection label="إدارة المشاريع" icon={IC.projects}
            isActive={inProjects} isOpen={projectsOpen} onToggle={() => setProjectsOpen(o => !o)}>
            {hasDashboard  && <SubLink href="/dashboard"  label="لوحة التحكم"    icon={IC.dashboard}  active={pathname === '/dashboard'} />}
            {hasProjects   && <SubLink href="/projects"   label="المشاريع"        icon={IC.projects}   active={pathname.startsWith('/projects')} />}
            {hasVisits     && <SubLink href="/visits"     label="الزيارات الفنية" icon={IC.visits}     active={pathname.startsWith('/visits')} />}
            {hasInventory  && <SubLink href="/inventory"  label="المخزون"         icon={IC.inventory}  active={pathname.startsWith('/inventory')} />}
          </NavSection>
        )}

        {/* السلامة والجودة */}
        {hasQHSE && (
          <NavSection label="السلامة والجودة" icon={IC.shield}
            isActive={inQHSE} isOpen={qhseOpen} onToggle={() => setQhseOpen(o => !o)}>
            <SubLink href="/qhse"             label="لوحة التحكم"   icon={IC.dashboard}   active={pathname === '/qhse'} />
            <SubLink href="/qhse/safety"      label="السلامة (HSE)" icon={IC.safety}      active={pathname.startsWith('/qhse/safety')} />
            <SubLink href="/qhse/quality"     label="الجودة (QC)"   icon={IC.quality}     active={pathname.startsWith('/qhse/quality')} />
            <SubLink href="/qhse/environment" label="البيئة (ENV)"  icon={IC.environment} active={pathname.startsWith('/qhse/environment')} />
          </NavSection>
        )}

        {/* الموارد البشرية */}
        {hasHR && (
          <NavSection label="الموارد البشرية" icon={IC.hr}
            isActive={inHR} isOpen={hrOpen} onToggle={() => setHrOpen(o => !o)}>
            <SubLink href="/hr/dashboard"  label="لوحة التحكم"           icon={IC.dashboard}  active={pathname === '/hr/dashboard'} />
            <SubLink href="/hr/org"        label="الهيكل التنظيمي"       icon={IC.org}        active={pathname.startsWith('/hr/org')} />
            <SubLink href="/hr"            label="ملفات الموظفين"         icon={IC.employees}  active={pathname === '/hr'} />
            <SubLink href="/hr/attendance" label="الحضور والغياب"         icon={IC.attendance} active={pathname.startsWith('/hr/attendance')} />
            <SubLink href="/hr/leaves"     label="الإجازات"               icon={IC.leaves}     active={pathname.startsWith('/hr/leaves')} />
            <SubLink href="/hr/payroll"    label="الرواتب والتعويضات"     icon={IC.payroll}    active={pathname.startsWith('/hr/payroll')} />
            <SubLink href="/hr/documents"  label="الوثائق"                icon={IC.documents}  active={pathname.startsWith('/hr/documents')} />
            <SubLink href="/hr/jobs"       label="عروض الوظائف"           icon={IC.jobs}       active={pathname.startsWith('/hr/jobs')} />
          </NavSection>
        )}

        <Divider />

        {hasPurchases && <StandaloneLink href="/purchases" label="المشتريات" icon={IC.purchases} active={pathname.startsWith('/purchases')} />}
        {hasReports   && <StandaloneLink href="/reports"   label="التقارير"  icon={IC.reports}   active={pathname.startsWith('/reports')} />}

        {isAdmin && (
          <>
            <Divider />
            <NavSection label="الإعدادات" icon={IC.settings}
              isActive={inSettings} isOpen={settingsOpen} onToggle={() => setSettingsOpen(o => !o)}>
              <SubLink href="/employees" label="المستخدمون والصلاحيات" icon={IC.employees} active={pathname.startsWith('/employees')} />
              <SubLink href="/settings"  label="إعدادات النظام"         icon={IC.settings}  active={pathname === '/settings'} />
            </NavSection>
          </>
        )}
      </nav>

      {/* ════ Footer ════ */}
      <div style={{ padding: '12px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        {/* بطاقة المستخدم */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', borderRadius: '9px',
          background: C.groupBg, border: `1px solid ${C.border}`, marginBottom: '8px',
        }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
            background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: 'white', fontSize: '0.9rem',
          }}>
            {currentUser?.name?.charAt(0) || '؟'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.textPrimary, fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser?.name}
            </div>
            <div style={{ color: C.textMuted, fontSize: '0.7rem', marginTop: '1px' }}>
              {currentUser?.role}
            </div>
          </div>
        </div>

        {/* تسجيل الخروج */}
        <button onClick={() => { reset(); router.push('/login') }} style={{
          width: '100%', background: 'transparent', color: C.textSecondary,
          border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 12px',
          cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(239,68,68,0.12)'; el.style.color = '#fca5a5'; el.style.borderColor = 'rgba(239,68,68,0.3)' }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = C.textSecondary; el.style.borderColor = C.border }}
        >
          <Icon d={IC.logout} size={15} />
          تسجيل الخروج
        </button>

        <div style={{ textAlign: 'center', color: C.textMuted, fontSize: '0.65rem', marginTop: '8px' }}>
          وثيق v1.0
        </div>
      </div>
    </div>
  )
}
