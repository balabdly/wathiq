'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Users, Calendar, Banknote, AlertTriangle, TrendingUp, Clock, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

export default function HRDashboard() {
  const { tenant } = useStore()
  const [stats, setStats] = useState({
    totalActive: 0, saudiCount: 0, expatCount: 0,
    pendingLeaves: 0, approvedLeaves: 0,
    expiringIqama: 0, newThisMonth: 0,
    unpaidPayrolls: 0, notReturnedCount: 0,
  })
  const [loading, setLoading] = useState(false)
  const [pendingLeavesList, setPendingLeavesList] = useState<any[]>([])
  const [expiringList, setExpiringList] = useState<any[]>([])
  const [absentList, setAbsentList] = useState<any[]>([])

  useEffect(() => { if (tenant) load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const now = new Date()
    const thisMonth = now.getMonth() + 1
    const thisYear = now.getFullYear()
    const in60Days = new Date(now.getTime() + 60 * 86400000).toISOString().split('T')[0]

    const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]

    const [empRes, leavesRes, iqamaRes, payrollRes, absentRes] = await Promise.all([
      supabase.from('hr_employees')
        .select('id, nationality, hire_date, employee:employees!hr_employees_employee_id_fkey(name)')
        .eq('tenant_id', tenant.id).eq('is_active', true),
      supabase.from('hr_leaves')
        .select('id, status, employee:employees!hr_leaves_employee_id_fkey(name), leave_type, start_date, days')
        .eq('tenant_id', tenant.id).eq('status', 'بانتظار الموافقة'),
      supabase.from('hr_employees')
        .select('id, iqama_expiry, employee:employees!hr_employees_employee_id_fkey(name)')
        .eq('tenant_id', tenant.id).eq('is_active', true)
        .not('iqama_expiry', 'is', null)
        .lte('iqama_expiry', in60Days),
      supabase.from('hr_payroll')
        .select('id').eq('tenant_id', tenant.id)
        .eq('month', thisMonth).eq('year', thisYear).eq('status', 'مسودة'),
      // الموظفون الذين انتهت إجازتهم ولم يسجلوا حضوراً
      supabase.from('hr_leaves')
        .select('id, employee_id, end_date, leave_type, days, employee:employees!hr_leaves_employee_id_fkey(name, role)')
        .eq('tenant_id', tenant.id)
        .eq('status', 'موافق')
        .lt('end_date', now.toISOString().split('T')[0])
        .gte('end_date', new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]),
    ])

    const emps = empRes.data || []
    const saudi = emps.filter(e => e.nationality === 'سعودي').length
    const newThisMonth = emps.filter(e => {
      if (!e.hire_date) return false
      const d = new Date(e.hire_date)
      return d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear
    }).length

    // تصفية الموظفين الذين انتهت إجازتهم ولم يسجلوا حضوراً بعد
    const recentLeaves = absentRes.data || []
    // جلب سجلات الحضور لهؤلاء الموظفين بعد تاريخ انتهاء إجازتهم
    const absentEmployees: any[] = []
    for (const leave of recentLeaves) {
      const { data: attendance } = await supabase
        .from('hr_attendance')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('employee_id', leave.employee_id)
        .eq('status', 'حضور')
        .gt('date', leave.end_date)
        .limit(1)
      if (!attendance || attendance.length === 0) {
        const overdueDays = Math.ceil((now.getTime() - new Date(leave.end_date).getTime()) / 86400000)
        absentEmployees.push({ ...leave, overdue_days: overdueDays })
      }
    }

    setStats({
      totalActive: emps.length, saudiCount: saudi, expatCount: emps.length - saudi,
      pendingLeaves: leavesRes.data?.length || 0,
      approvedLeaves: 0, expiringIqama: iqamaRes.data?.length || 0,
      newThisMonth, unpaidPayrolls: payrollRes.data?.length || 0,
      notReturnedCount: absentEmployees.length,
    })
    setPendingLeavesList(leavesRes.data || [])
    setExpiringList(iqamaRes.data || [])
    setAbsentList(absentEmployees)
    setLoading(false)
  }

  const KPI = ({ label, value, color, bg, icon: Icon, href }: any) => (
    <Link href={href || '#'} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ padding: '18px', background: bg, cursor: 'pointer', transition: 'transform 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '4px' }}>{label}</div>
          </div>
          <div style={{ background: color + '22', borderRadius: '10px', padding: '8px' }}>
            <Icon style={{ width: '20px', height: '20px', color }} />
          </div>
        </div>
      </div>
    </Link>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users style={{ width: '22px', height: '22px', color: 'var(--primary)' }} /> لوحة تحكم الموارد البشرية
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>نظرة عامة على الموظفين والإجازات والرواتب</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPI label="الموظفون النشطون"    value={stats.totalActive}     color="#1a56db" bg="#eff6ff"  icon={Users}        href="/hr" />
        <KPI label="طلبات إجازة معلقة"  value={stats.pendingLeaves}   color={stats.pendingLeaves > 0 ? '#e6820a' : '#0ea77b'} bg={stats.pendingLeaves > 0 ? '#fffbeb' : '#ecfdf5'} icon={Clock} href="/hr/leaves" />
        <KPI label="إقامات تنتهي < 60 يوم" value={stats.expiringIqama} color={stats.expiringIqama > 0 ? '#c81e1e' : '#0ea77b'} bg={stats.expiringIqama > 0 ? '#fef2f2' : '#ecfdf5'} icon={AlertTriangle} href="/hr" />
        <KPI label="لم يعودوا من إجازتهم" value={stats.notReturnedCount} color={stats.notReturnedCount > 0 ? '#c81e1e' : '#0ea77b'} bg={stats.notReturnedCount > 0 ? '#fef2f2' : '#ecfdf5'} icon={ShieldAlert} href="/hr/leaves" />
        <KPI label="موظفون جدد هذا الشهر" value={stats.newThisMonth}  color="#0ea77b"  bg="#ecfdf5"  icon={TrendingUp}    href="/hr" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="سعوديون"      value={stats.saudiCount}      color="#1a56db" bg="#eff6ff"  icon={Users}    href="/hr" />
        <KPI label="وافدون"       value={stats.expatCount}      color="#e6820a" bg="#fffbeb"  icon={Users}    href="/hr" />
        <KPI label="مسيرات مسودة هذا الشهر" value={stats.unpaidPayrolls} color={stats.unpaidPayrolls > 0 ? '#e6820a' : '#0ea77b'} bg={stats.unpaidPayrolls > 0 ? '#fffbeb' : '#ecfdf5'} icon={Banknote} href="/hr/payroll" />
        <KPI label="إجمالي الإجازات اليوم" value="—" color="#6b7280" bg="#f9fafb" icon={Calendar} href="/hr/leaves" />
      </div>

      {/* تنبيه: لم يعودوا من إجازتهم */}
      {absentList.length > 0 && (
        <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid #fca5a5' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #fca5a5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2' }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#c81e1e' }}>
              <ShieldAlert style={{ width: '16px', height: '16px' }} />
              موظفون لم يعودوا من إجازتهم
            </div>
            <Link href="/hr/leaves" style={{ fontSize: '0.78rem', color: '#c81e1e', textDecoration: 'none' }}>عرض الكل ←</Link>
          </div>
          {absentList.slice(0, 5).map(l => {
            const isSerious = l.overdue_days >= 5
            return (
              <div key={l.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{l.employee?.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                    {l.leave_type} · كان يجب العودة: {l.end_date}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{
                    background: isSerious ? '#fef2f2' : '#fffbeb',
                    color: isSerious ? '#c81e1e' : '#92400e',
                    borderRadius: '20px', padding: '3px 10px',
                    fontSize: '0.72rem', fontWeight: 700,
                  }}>
                    {l.overdue_days} يوم تأخير
                  </span>
                  {isSerious && (
                    <Link href="/hr/disciplinary" style={{ fontSize: '0.68rem', color: '#c81e1e', textDecoration: 'none', fontWeight: 600 }}>
                      ← إصدار إنذار
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* طلبات الإجازة المعلقة */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock style={{ width: '16px', height: '16px', color: '#e6820a' }} />
              طلبات إجازة بانتظار الموافقة
            </div>
            <Link href="/hr/leaves" style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none' }}>عرض الكل ←</Link>
          </div>
          {pendingLeavesList.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.875rem' }}>
              ✅ لا توجد طلبات معلقة
            </div>
          ) : (
            pendingLeavesList.slice(0, 5).map(l => (
              <div key={l.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{l.employee?.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{l.leave_type} · {l.days} يوم · {l.start_date}</div>
                </div>
                <span style={{ background: '#fffbeb', color: '#92400e', borderRadius: '20px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600 }}>⏳ معلق</span>
              </div>
            ))
          )}
        </div>

        {/* إقامات تنتهي قريباً */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle style={{ width: '16px', height: '16px', color: '#c81e1e' }} />
              إقامات تنتهي خلال 60 يوم
            </div>
            <Link href="/hr" style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none' }}>عرض الكل ←</Link>
          </div>
          {expiringList.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.875rem' }}>
              ✅ لا توجد إقامات منتهية قريباً
            </div>
          ) : (
            expiringList.slice(0, 5).map(e => {
              const days = e.iqama_expiry
                ? Math.ceil((new Date(e.iqama_expiry).getTime() - Date.now()) / 86400000)
                : null
              return (
                <div key={e.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{e.employee?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>تنتهي: {e.iqama_expiry}</div>
                  </div>
                  <span style={{ background: days! <= 0 ? '#fef2f2' : '#fffbeb', color: days! <= 0 ? '#c81e1e' : '#92400e', borderRadius: '20px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600 }}>
                    {days! <= 0 ? `منتهية ${Math.abs(days!)} يوم` : `${days} يوم`}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* روابط سريعة */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ fontWeight: 700, marginBottom: '14px', fontSize: '0.875rem' }}>🔗 وصول سريع</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { href: '/hr', label: '👥 ملفات الموظفين' },
            { href: '/hr/attendance', label: '📅 الحضور والغياب' },
            { href: '/hr/leaves', label: '🌴 الإجازات' },
            { href: '/hr/payroll', label: '💰 الرواتب والتعويضات' },
            { href: '/hr/documents', label: '📄 الوثائق' },
            { href: '/hr/jobs', label: '💼 عروض الوظائف' },
            { href: '/hr/disciplinary', label: '⚖️ التأديب والجزاءات' },
          ].map(l => (
            <Link key={l.href} href={l.href}
              style={{ padding: '8px 14px', background: 'var(--bg2)', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', textDecoration: 'none', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-light)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
