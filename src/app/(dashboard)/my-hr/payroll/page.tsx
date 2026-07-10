'use client'

import { useEffect, useState } from 'react'
import { useMyHrEmployee } from '@/hooks/useMyHrEmployee'
import { supabase } from '@/lib/supabase'
import { Banknote } from 'lucide-react'

type Payslip = {
  id: number
  month: number
  year: number
  basic_salary: number
  housing_allow: number
  transport_allow: number
  other_allow: number
  overtime_pay: number
  bonuses: number
  gosi_deduction: number
  absence_deduct: number
  other_deduct: number
  gross_salary: number
  net_salary: number
  status: string
}

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function MyPayrollPage() {
  const { hrEmployeeId, tenant } = useMyHrEmployee()
  const [rows, setRows] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenant?.id || !hrEmployeeId) return
    setLoading(true)
    supabase.from('hr_payroll')
      .select('id, month, year, basic_salary, housing_allow, transport_allow, other_allow, overtime_pay, bonuses, gosi_deduction, absence_deduct, other_deduct, gross_salary, net_salary, status')
      .eq('tenant_id', tenant.id)
      .eq('employee_id', hrEmployeeId)
      .in('status', ['معتمد', 'مدفوع', 'موافق'])
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .then(({ data }) => {
        setRows(data || [])
        setLoading(false)
      })
  }, [tenant?.id, hrEmployeeId])

  return (
    <div className="space-y-4">
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: '50px', textAlign: 'center', color: 'var(--text3)' }}>
          <Banknote style={{ width: '40px', height: '40px', margin: '0 auto 10px', opacity: 0.4 }} />
          لا توجد مسيرات رواتب معتمدة حتى الآن
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rows.map(r => (
            <div key={r.id} className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontWeight: 700 }}>{ARABIC_MONTHS[r.month - 1]} {r.year}</div>
                <span className="badge badge-green">{r.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '0.82rem' }}>
                <div><span style={{ color: 'var(--text3)' }}>الأساسي:</span> <strong>{r.basic_salary?.toLocaleString()}</strong></div>
                <div><span style={{ color: 'var(--text3)' }}>البدلات:</span> <strong>{(r.housing_allow + r.transport_allow + r.other_allow + r.overtime_pay + r.bonuses).toLocaleString()}</strong></div>
                <div><span style={{ color: 'var(--text3)' }}>الخصومات:</span> <strong style={{ color: '#c81e1e' }}>{(r.gosi_deduction + r.absence_deduct + r.other_deduct).toLocaleString()}</strong></div>
                <div><span style={{ color: 'var(--text3)' }}>الإجمالي:</span> <strong>{r.gross_salary?.toLocaleString()}</strong></div>
                <div><span style={{ color: 'var(--text3)' }}>الصافي:</span> <strong style={{ color: '#0ea77b', fontSize: '1rem' }}>{r.net_salary?.toLocaleString()} ر.س</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
