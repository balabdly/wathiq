'use client'

import { useEffect, useState } from 'react'
import { useMyHrEmployee } from '@/hooks/useMyHrEmployee'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

type Warning = {
  id: number
  incident_date: string
  violation_name: string
  category: string
  penalty_degree: number
  penalty_type?: string
  status: string
  notes?: string
}

const DEGREE_COLOR: Record<number, string> = {
  1: 'badge-amber',
  2: 'badge-blue',
  3: 'badge-red',
}

export default function MyDisciplinaryPage() {
  const { hrEmployeeId, tenant } = useMyHrEmployee()
  const [rows, setRows] = useState<Warning[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenant?.id || !hrEmployeeId) return
    setLoading(true)
    supabase.from('hr_disciplinary')
      .select('id, incident_date, violation_name, category, penalty_degree, penalty_type, status, notes')
      .eq('tenant_id', tenant.id)
      .eq('employee_id', hrEmployeeId)
      .order('incident_date', { ascending: false })
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
          <AlertTriangle style={{ width: '40px', height: '40px', margin: '0 auto 10px', opacity: 0.4 }} />
          لا توجد جزاءات أو إنذارات مسجّلة عليك
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rows.map(r => (
            <div key={r.id} className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{r.violation_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text3)', marginTop: '2px' }}>{formatDate(r.incident_date)} · {r.category}</div>
                </div>
                <span className={`badge ${DEGREE_COLOR[r.penalty_degree] || 'badge-gray'}`}>الدرجة {r.penalty_degree}</span>
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text3)' }}>الجزاء:</span> {r.penalty_type || '—'}
                {r.status && <> · <span style={{ color: 'var(--text3)' }}>الحالة:</span> {r.status}</>}
              </div>
              {r.notes && <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text3)' }}>{r.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
