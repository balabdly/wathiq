'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { useState } from 'react'

// ════════════════════════════════════════
// أيقونات
// ════════════════════════════════════════
const IC = {
  dashboard:   'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  projects:    'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  visits:      'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  inventory:   'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  shield:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  safety:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01',
  quality:     'M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  environment: 'M12 2a10 10 0 100 20A10 10 0 0012 2zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z',
  hr:          'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M12 7a4 4 0 110 8 4 4 0 010-8z',
  attendance:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  leaves:      'M12 2a10 10 0 100 20A10 10 0 0012 2zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  payroll:     'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  documents:   'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  jobs:        'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  purchases:   'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
  reports:     'M18 20V10M12 20V4M6 20v-6',
  settings:    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  employees:   'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  branch:      'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  logout:      'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  chevron:     'M6 9l6 6 6-6',
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

// ════════════════════════════════════════
// مكوّن العنصر الفرعي
// ════════════════════════════════════════
function SubLink({ href, label, icon, active, accent }: {
  href: string; label: string; icon: string; active: boolean; accent: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '9px',
        padding: '8px 10px 8px 12px',
        borderRadius: '8px', marginBottom: '1px', cursor: 'pointer',
        background: active ? `${accent}28` : 'transparent',
        borderRight: active ? `3px solid ${accent}` : '3px solid transparent',
        color: active ? 'white' : 'rgba(255,255,255,0.6)',
        fontSize: '0.82rem', fontWeight: active ? 700 : 400,
        transition: 'all 0.15s',
      }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = 'white' }}
        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)' } }}
      >
        <Icon d={icon} size={14} />
        <span>{label}</span>
      </div>
    </Link>
  )
}

// ════════════════════════════════════════
// مكوّن القسم الرئيسي
// ════════════════════════════════════════
function NavSection({ label, sublabel, icon, accent, isActive, isOpen, onToggle, children }: {
  label: string; sublabel: string; icon: string; accent: string
  isActive: boolean; isOpen: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: '4px' }}>
      {/* زر القسم */}
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0',
        padding: '0', border: 'none', cursor: 'pointer', borderRadius: '10px',
        background: 'transparent', overflow: 'hidden',
        transition: 'all 0.15s',
      }}>
        {/* شريط اللون الجانبي */}
        <div style={{
          width: '4px', alignSelf: 'stretch', borderRadius: '4px 0 0 4px',
          background: isActive || isOpen ? accent : 'transparent',
          transition: 'background 0.2s', flexShrink: 0,
        }} />

        {/* محتوى الزر */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px 10px 10px',
          background: isActive ? `${accent}22` : isOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
          borderRadius: '0 10px 10px 0',
          transition: 'background 0.15s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* أيقونة ملوّنة */}
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
              background: isActive || isOpen ? `${accent}33` : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isActive || isOpen ? accent : 'rgba(255,255,255,0.5)',
              transition: 'all 0.2s',
            }}>
              <Icon d={icon} size={16} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
                color: isActive || isOpen ? accent : 'rgba(255,255,255,0.35)',
                lineHeight: 1, marginBottom: '2px',
              }}>
                {sublabel}
              </div>
              <div style={{
                fontSize: '0.85rem', fontWeight: 600,
                color: isActive ? 'white' : isOpen ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)',
              }}>
                {label}
              </div>
            </div>
          </div>
          {/* سهم */}
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ color: isOpen ? accent : 'rgba(255,255,255,0.3)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'all 0.2s', flexShrink: 0 }}>
            <path d={IC.chevron} />
          </svg>
        </div>
      </button>

      {/* العناصر الفرعية */}
      {isOpen && (
        <div style={{
          marginTop: '2px', paddingRight: '16px', paddingLeft: '4px',
          borderRight: `2px solid ${accent}44`,
          marginRight: '4px',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════
// عنصر مستقل (بدون dropdown)
// ════════════════════════════════════════
function StandaloneLink({ href, label, icon, active }: {
  href: string; label: string; icon: string; active: boolean
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px 9px 12px', borderRadius: '10px', marginBottom: '2px',
        background: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.04)',
        color: active ? 'white' : 'rgba(255,255,255,0.65)',
        fontSize: '0.85rem', fontWeight: active ? 700 : 400,
        cursor: 'pointer', transition: 'all 0.15s',
        borderRight: active ? '3px solid rgba(255,255,255,0.8)' : '3px solid transparent',
      }}
        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLElement).style.color = 'white' } }}
        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)' } }}
      >
        <div style={{
          width: '30px', height: '30px', borderRadius: '7px', flexShrink: 0,
          background: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon d={icon} size={15} />
        </div>
        <span>{label}</span>
      </div>
    </Link>
  )
}

// ════════════════════════════════════════
// فاصل خفيف
// ════════════════════════════════════════
function Divider() {
  return <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUser, tenant, activeBranch, branches, setActiveBranch, reset } = useStore()
  const perms: string[] = currentUser?.permissions || []
  const tenantModules = (tenant as any)?.modules || {}
  const isAdmin = currentUser?.role === 'مدير عام'

  // ── صلاحيات ──
  const hasProjects  = perms.includes('projects_view')  && tenantModules.projects  !== false
  const hasVisits    = perms.some((p: string) => p.startsWith('visits')) && tenantModules.visits !== false
  const hasInventory = perms.includes('inventory')      && tenantModules.inventory !== false
  const hasQHSE      = perms.includes('qhse')           && tenantModules.qhse      !== false
  const hasPurchases = perms.includes('purchases')      && tenantModules.purchases !== false
  const hasReports   = perms.includes('reports')
  const hasHR        = perms.includes('employees')
  const hasDashboard = perms.includes('dashboard')

  // ── حالة الأقسام — تفتح تلقائياً بناءً على الصفحة الحالية ──
  const inProjects = pathname === '/dashboard' || ['/projects','/visits','/inventory'].some(p => pathname.startsWith(p))
  const inQHSE     = pathname.startsWith('/qhse')
  const inHR       = pathname.startsWith('/hr')
  const inSettings = pathname.startsWith('/settings') || pathname.startsWith('/employees')

  const [projectsOpen, setProjectsOpen] = useState(inProjects)
  const [qhseOpen,     setQhseOpen]     = useState(inQHSE)
  const [hrOpen,       setHrOpen]       = useState(inHR)
  const [settingsOpen, setSettingsOpen] = useState(inSettings)

  // ── ألوان ──
  const BLUE   = '#60a5fa'
  const YELLOW = '#fbbf24'
  const GREEN  = '#4ade80'
  const PURPLE = '#c084fc'

  return (
    <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ════ Header ════ */}
      <div style={{ padding: '18px 14px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        {/* الشعار والاسم */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            <Icon d={IC.shield} size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tenant?.name || 'وثيق ERP'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', marginTop: '1px' }}>مقاول كهرباء معتمد</div>
          </div>
        </div>

        {/* الفرع */}
        {branches.length > 1 ? (
          <select
            value={activeBranch?.id || ''}
            onChange={e => { const b = branches.find(b => b.id === Number(e.target.value)); if (b) setActiveBranch(b) }}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
              color: 'white', borderRadius: '8px', padding: '7px 10px', fontSize: '0.8rem', cursor: 'pointer',
            }}>
            {branches.map(b => <option key={b.id} value={b.id} style={{ color: '#1a1a1a', background: 'white' }}>{b.name}</option>)}
          </select>
        ) : (
          <div style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '7px 10px',
            color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem',
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
      <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0' }}>

        {/* ── إدارة المشاريع ── */}
        {(hasDashboard || hasProjects || hasVisits || hasInventory) && (
          <NavSection
            label="إدارة المشاريع" sublabel="PROJECTS"
            icon={IC.projects} accent={BLUE}
            isActive={inProjects} isOpen={projectsOpen}
            onToggle={() => setProjectsOpen(o => !o)}
          >
            {hasDashboard && <SubLink href="/dashboard"  label="لوحة التحكم"   icon={IC.dashboard}  active={pathname === '/dashboard'}            accent={BLUE} />}
            {hasProjects   && <SubLink href="/projects"  label="المشاريع"       icon={IC.projects}   active={pathname.startsWith('/projects')}     accent={BLUE} />}
            {hasVisits     && <SubLink href="/visits"    label="الزيارات الفنية" icon={IC.visits}    active={pathname.startsWith('/visits')}       accent={BLUE} />}
            {hasInventory  && <SubLink href="/inventory" label="المخزون"        icon={IC.inventory}  active={pathname.startsWith('/inventory')}    accent={BLUE} />}
          </NavSection>
        )}

        {/* ── إدارة السلامة والجودة ── */}
        {hasQHSE && (
          <NavSection
            label="السلامة والجودة" sublabel="QHSE"
            icon={IC.shield} accent={YELLOW}
            isActive={inQHSE} isOpen={qhseOpen}
            onToggle={() => setQhseOpen(o => !o)}
          >
            <SubLink href="/qhse"             label="لوحة التحكم"       icon={IC.dashboard}    active={pathname === '/qhse'}                  accent={YELLOW} />
            <SubLink href="/qhse/safety"      label="السلامة (HSE)"     icon={IC.safety}       active={pathname.startsWith('/qhse/safety')}   accent={YELLOW} />
            <SubLink href="/qhse/quality"     label="الجودة (QC)"       icon={IC.quality}      active={pathname.startsWith('/qhse/quality')}  accent={YELLOW} />
            <SubLink href="/qhse/environment" label="البيئة (ENV)"      icon={IC.environment}  active={pathname.startsWith('/qhse/environment')} accent={YELLOW} />
          </NavSection>
        )}

        {/* ── الموارد البشرية ── */}
        {hasHR && (
          <NavSection
            label="الموارد البشرية" sublabel="HR"
            icon={IC.hr} accent={GREEN}
            isActive={inHR} isOpen={hrOpen}
            onToggle={() => setHrOpen(o => !o)}
          >
            <SubLink href="/hr/dashboard" label="لوحة التحكم"         icon={IC.dashboard}  active={pathname === '/hr/dashboard'}           accent={GREEN} />
            <SubLink href="/hr"           label="ملفات الموظفين"       icon={IC.employees}  active={pathname === '/hr'}                     accent={GREEN} />
            <SubLink href="/hr/attendance" label="الحضور والغياب"     icon={IC.attendance} active={pathname.startsWith('/hr/attendance')}  accent={GREEN} />
            <SubLink href="/hr/leaves"    label="الإجازات"             icon={IC.leaves}     active={pathname.startsWith('/hr/leaves')}      accent={GREEN} />
            <SubLink href="/hr/payroll"   label="الرواتب والتعويضات"   icon={IC.payroll}    active={pathname.startsWith('/hr/payroll')}     accent={GREEN} />
            <SubLink href="/hr/documents" label="الوثائق"              icon={IC.documents}  active={pathname.startsWith('/hr/documents')}   accent={GREEN} />
            <SubLink href="/hr/jobs"      label="عروض الوظائف"         icon={IC.jobs}       active={pathname.startsWith('/hr/jobs')}        accent={GREEN} />
          </NavSection>
        )}

        <Divider />

        {/* ── مستقلة ── */}
        {hasPurchases && <StandaloneLink href="/purchases" label="المشتريات" icon={IC.purchases} active={pathname.startsWith('/purchases')} />}
        {hasReports   && <StandaloneLink href="/reports"   label="التقارير"  icon={IC.reports}   active={pathname.startsWith('/reports')}   />}

        {/* ── الإعدادات ── */}
        {isAdmin && (
          <>
            <Divider />
            <NavSection
              label="الإعدادات" sublabel="SETTINGS"
              icon={IC.settings} accent={PURPLE}
              isActive={inSettings} isOpen={settingsOpen}
              onToggle={() => setSettingsOpen(o => !o)}
            >
              <SubLink href="/employees" label="المستخدمون والصلاحيات" icon={IC.employees} active={pathname.startsWith('/employees')} accent={PURPLE} />
              <SubLink href="/settings"  label="إعدادات النظام"         icon={IC.settings}  active={pathname === '/settings'}           accent={PURPLE} />
            </NavSection>
          </>
        )}

      </nav>

      {/* ════ Footer ════ */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        {/* بيانات المستخدم */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px', borderRadius: '10px',
          background: 'rgba(255,255,255,0.07)', marginBottom: '8px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: 'white', fontSize: '0.9rem',
          }}>
            {currentUser?.name?.charAt(0) || '؟'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'white', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser?.name}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', marginTop: '1px' }}>
              {currentUser?.role}
            </div>
          </div>
        </div>

        {/* زر تسجيل الخروج */}
        <button
          onClick={() => { reset(); router.push('/login') }}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '0.8rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLElement).style.color = '#fca5a5'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)' }}
        >
          <Icon d={IC.logout} size={15} />
          تسجيل الخروج
        </button>

        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', marginTop: '8px' }}>
          وثيق v1.0
        </div>
      </div>
    </div>
  )
}
