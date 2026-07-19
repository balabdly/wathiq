'use client'
import { useRouter } from 'next/navigation'
import { Search, Eye } from 'lucide-react'
import { usePlanning } from '../PlanningContext'
import { formatDate } from '@/lib/utils'
import PlanningProgressBadge from '@/components/projects/PlanningProgressBadge'
import { useState } from 'react'

export default function ClosedProjectsPage() {
  const { closedProjects } = usePlanning()
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = closedProjects.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
  })

  return (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{ position: 'relative', marginBottom: '14px', maxWidth: '240px' }}>
        <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px' }} placeholder="بحث..." />
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>لا مشاريع مغلقة</div>
      ) : (
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['التخطيط', 'الرقم', 'المشروع', 'العميل', 'البداية', 'النهاية', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', minWidth: '120px' }}>
                    <PlanningProgressBadge progress={p.planningProgress} size="sm" />
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace' }} dir="ltr">{p.code || '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{p.name}</td>
                  <td style={{ padding: '10px 12px' }}>{p.client_name || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>{p.start_date ? formatDate(p.start_date) : '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>{p.end_date ? formatDate(p.end_date) : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => router.push(`/projects/planning/${p.id}/materials`)} className="btn btn-ghost" style={{ padding: '6px' }} title="عرض">
                      <Eye style={{ width: '15px', height: '15px' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
