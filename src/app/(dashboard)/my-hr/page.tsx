'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useMyHrEmployee } from '@/hooks/useMyHrEmployee'
import { supabase } from '@/lib/supabase'
import { Clock, Calendar, AlertTriangle, Banknote } from 'lucide-react'

export default function MyHrHomePage() {
  const { hrEmployeeId, tenant, profile } = useMyHrEmployee()
  const [stats, setStats] = useState({ pendingLeaves: 0, attendanceMonth: 0, warnings: 0, payslips: 0 })

  useEffect(() => {
    if (!tenant?.id || !hrEmployeeId) return
    const year = new Date().getFullYear()
    const month = new Date().getMonth() + 1
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`

    Promise.all([
      supabase.from('hr_leaves').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).eq('employee_id', hrEmployeeId)
        .in('status', ['بانتظار الموافقة', 'قيد موافقة المدير المباشر', 'قيد موافقة مدير الإدارة']),
      supabase.from('hr_attendance').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).eq('employee_id', hrEmployeeId)
        .gte('date', monthStart).lte('date', monthEnd),
      supabase.from('hr_disciplinary').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).eq('employee_id', hrEmployeeId),
      supabase.from('hr_payroll').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).eq('employee_id', hrEmployeeId)
        .in('status', ['معتمد', 'مدفوع', 'موافق']),
    ]).then(([leaves, att, disc, pay]) => {
      setStats({
        pendingLeaves: leaves.count || 0,
        attendanceMonth: att.count || 0,
        warnings: disc.count || 0,
        payslips: pay.count || 0,
      })
    })
  }, [tenant?.id, hrEmployeeId])

  const cards = [
    { href: '/my-hr/attendance', icon: Clock, label: 'سجلات الحضور هذا الشهر', value: stats.attendanceMonth, color: '#1a56db' },
    { href: '/my-hr/leaves', icon: Calendar, label: 'طلبات إجازة قيد الموافقة', value: stats.pendingLeaves, color: '#e6820a' },
    { href: '/my-hr/disciplinary', icon: AlertTriangle, label: 'إنذارات مسجّلة', value: stats.warnings, color: '#c81e1e' },
    { href: '/my-hr/payroll', icon: Banknote, label: 'مسيرات رواتب معتمدة', value: stats.payslips, color: '#0ea77b' },
  ]

  return (
    <div className="space-y-4">
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{profile?.name}</div>
        <div style={{ color: 'var(--text3)', fontSize: '0.85rem', marginTop: '4px' }}>{profile?.job_title || '—'} · {profile?.department || '—'}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {cards.map(card => (
          <Link key={card.href} href={card.href} className="card" style={{ padding: '16px', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <card.icon style={{ width: '18px', height: '18px', color: card.color }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>{card.label}</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: card.color }}>{card.value}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
