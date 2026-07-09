'use client'

import { useEffect, useState } from 'react'
import { useMyHrEmployee } from '@/hooks/useMyHrEmployee'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Clock } from 'lucide-react'

type Attendance = {
  id: number
  date: string
  status: string
  check_in?: string
  check_out?: string
  hours_worked?: number
  overtime_hours?: number
  notes?: string
}

const STATUS_COLOR: Record<string, string> = {
  'حضور': 'badge-green',
  'غياب': 'badge-red',
  'إجازة': 'badge-blue',
  'مأمورية': 'badge-amber',
  'عطلة': 'badge-gray',
}

export default function MyAttendancePage() {
  const { hrEmployeeId, tenant } = useMyHrEmployee()
  const [rows, setRows] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))

  useEffect(() => {
    if (!tenant?.id || !hrEmployeeId) return
    setLoading(true)
    const start = `${filterYear}-${filterMonth}-01`
    const end = `${filterYear}-${filterMonth}-31`
    supabase.from('hr_attendance')
      .select('id, date, status, check_in, check_out, hours_worked, overtime_hours, notes')
      .eq('tenant_id', tenant.id)
      .eq('employee_id', hrEmployeeId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
      .then(({ data }) => {
        setRows(data || [])
        setLoading(false)
      })
  }, [tenant?.id, hrEmployeeId, filterMonth, filterYear])

  const present = rows.filter(r => r.status === 'حضور').length
  const absent = rows.filter(r => r.status === 'غياب').length
  const overtime = rows.reduce((s, r) => s + (r.overtime_hours || 0), 0)

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="select" style={{ width: 'auto' }}>
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="select" style={{ width: 'auto' }}>
          {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0ea77b' }}>{present}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>أيام حضور</div>
        </div>
        <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#c81e1e' }}>{absent}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>أيام غياب</div>
        </div>
        <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a56db' }}>{overtime}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>ساعات إضافية</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: '50px', textAlign: 'center', color: 'var(--text3)' }}>
          <Clock style={{ width: '40px', height: '40px', margin: '0 auto 10px', opacity: 0.4 }} />
          لا توجد سجلات حضور لهذا الشهر
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['التاريخ', 'الحالة', 'حضور', 'انصراف', 'الساعات', 'إضافي', 'ملاحظات'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--bg2)' }}>
                  <td style={{ padding: '10px 12px' }}>{formatDate(r.date)}</td>
                  <td style={{ padding: '10px 12px' }}><span className={`badge ${STATUS_COLOR[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                  <td style={{ padding: '10px 12px' }}>{r.check_in || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{r.check_out || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{r.hours_worked ?? '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{r.overtime_hours ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: '0.8rem' }}>{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
