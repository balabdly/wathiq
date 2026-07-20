'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ClipboardList } from 'lucide-react'
import { usePlanning } from './PlanningContext'
import { ensureProjectPlanning, type PlanningProject } from '@/lib/project-planning-service'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import PlanningProgressBadge from '@/components/projects/PlanningProgressBadge'
import ProjectPhaseBadge from '@/components/projects/ProjectPhaseBadge'
import { useFilteredPagination } from '@/hooks/useFilteredPagination'

export default function PlanningListPage() {
  const router = useRouter()
  const { tenantId, projects, reload, reloadKpis } = usePlanning()
  const [search, setSearch] = useState('')
  const [opening, setOpening] = useState<number | null>(null)

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
  })

  const { paginated, PaginationBar } = useFilteredPagination(filtered, 10, search)

  async function openPlans(project: PlanningProject) {
    if (!tenantId) return
    setOpening(project.id)
    try {
      if ((project.pmo_phase === '1_RECEIPT' || project.pmo_phase === '2_PREP') && project.planning?.planning_status !== 'closed') {
        await ensureProjectPlanning(tenantId, project.id, project)
        await reload()
        await reloadKpis()
      }
      router.push(`/projects/planning/${project.id}/materials`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل فتح الخطة')
    }
    setOpening(null)
  }

  function canEditPlans(p: PlanningProject) {
    return (p.pmo_phase === '1_RECEIPT' || p.pmo_phase === '2_PREP') && p.planning?.planning_status !== 'closed'
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px' }}>
        <div style={{ position: 'relative', marginBottom: '14px', maxWidth: '240px' }}>
          <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px' }} placeholder="بحث..." />
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
            لا مشاريع مسجّلة — ابدأ من «مرحلة بدء المشروع»
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['المرحلة', 'التخطيط', 'الرقم', 'المشروع', 'العميل', 'البداية', 'النهاية', 'القيمة', 'الخطط'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <ProjectPhaseBadge phase={p.pmo_phase} size="sm" />
                    </td>
                    <td style={{ padding: '10px 12px', minWidth: '120px' }}>
                      {p.planning ? (
                        <PlanningProgressBadge progress={p.planningProgress} size="sm" />
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>—</span>
                      )}
                    </td>
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
                        onClick={() => openPlans(p)}
                        disabled={opening === p.id}
                        className="btn btn-ghost"
                        style={{ padding: '6px 10px', color: '#0ea77b', border: '1px solid #86efac' }}
                        title={canEditPlans(p) ? 'إضافة / عرض الخطط' : 'عرض الخطط'}
                      >
                        <ClipboardList style={{ width: '16px', height: '16px' }} />
                        {canEditPlans(p) ? (p.planning ? 'عرض' : 'إضافة') : 'عرض'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <PaginationBar color="#0ea77b" />
    </div>
  )
}
