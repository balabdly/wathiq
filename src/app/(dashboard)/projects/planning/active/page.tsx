'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ClipboardList } from 'lucide-react'
import { usePlanning } from '../PlanningContext'
import { ensureProjectPlanning, type PlanningProject } from '@/lib/project-planning-service'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'

export default function ActiveProjectsPage() {
  const router = useRouter()
  const { tenantId, activeProjects, reloadActive, reloadKpis } = usePlanning()
  const [search, setSearch] = useState('')
  const [opening, setOpening] = useState<number | null>(null)

  const filtered = activeProjects.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
  })

  async function openPlans(project: PlanningProject) {
    if (!tenantId) return
    setOpening(project.id)
    try {
      await ensureProjectPlanning(tenantId, project.id, project)
      await reloadActive()
      await reloadKpis()
      router.push(`/projects/planning/${project.id}/permit`)
    } catch (e: any) {
      toast.error(e.message || 'فشل فتح الخطة')
    }
    setOpening(null)
  }

  return (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{ position: 'relative', marginBottom: '14px', maxWidth: '240px' }}>
        <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px' }} placeholder="بحث..." />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>لا مشاريع نشطة</div>
      ) : (
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['الرقم', 'المشروع', 'العميل', 'البداية', 'النهاية', 'القيمة', 'الخطط'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace' }} dir="ltr">{p.code || '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{p.name}</td>
                  <td style={{ padding: '10px 12px', color: '#1a56db' }}>{p.client_name || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>{p.start_date ? formatDate(p.start_date) : '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>{p.end_date ? formatDate(p.end_date) : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#0ea77b', fontWeight: 600 }}>
                    {p.estimated_value ? `${Number(p.estimated_value).toLocaleString('ar-SA')} ر.س` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={() => p.planning ? router.push(`/projects/planning/${p.id}/permit`) : openPlans(p)}
                      disabled={opening === p.id}
                      className="btn btn-ghost"
                      style={{ padding: '6px 10px', color: '#0ea77b', border: '1px solid #86efac' }}
                      title="إضافة / عرض الخطط"
                    >
                      <ClipboardList style={{ width: '16px', height: '16px' }} />
                      {p.planning ? 'عرض' : 'إضافة'}
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
