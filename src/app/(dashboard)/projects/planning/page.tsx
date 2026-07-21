'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Eye, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '@/hooks/useStore'
import { reopenProjectToInitiation } from '@/lib/project-initiation-service'
import { usePlanning } from './PlanningContext'
import { formatDate } from '@/lib/utils'
import PlanningProgressBadge from '@/components/projects/PlanningProgressBadge'
import { useFilteredPagination } from '@/hooks/useFilteredPagination'

export default function PlanningListPage() {
  const router = useRouter()
  const { currentUser } = useStore()
  const { tenantId, projects, reload } = usePlanning()
  const [search, setSearch] = useState('')
  const [returning, setReturning] = useState<number | null>(null)

  const canEdit = !!(currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit'))

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
  })

  const { paginated, PaginationBar } = useFilteredPagination(filtered, 10, search)

  async function handleReturnToInitiation(projectId: number, name: string) {
    if (!tenantId) return
    const msg = [
      `إرجاع «${name}» إلى مرحلة البدء؟`,
      '',
      '• لتصحيح بيانات المشروع أو الكميات',
      '• خطط التخطيط تبقى محفوظة',
    ].join('\n')
    if (!confirm(msg)) return
    setReturning(projectId)
    try {
      await reopenProjectToInitiation(tenantId, projectId)
      toast.success('تم إرجاع المشروع إلى مرحلة البدء')
      await reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الإرجاع')
    }
    setReturning(null)
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
            لا مشاريع في سلة التخطيط — أرسل مشروعاً من مرحلة البدء
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['التخطيط', 'الرقم', 'المشروع', 'العميل', 'البداية', 'النهاية', 'القيمة', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', minWidth: '120px' }}>
                      {p.planningProgress ? (
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
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => router.push(`/projects/planning/${p.id}/materials`)}
                          className="btn btn-ghost"
                          style={{ padding: '6px 10px', color: '#0ea77b', border: '1px solid #86efac' }}
                          title="عرض المشروع"
                        >
                          <Eye style={{ width: '16px', height: '16px' }} />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleReturnToInitiation(p.id, p.name)}
                            disabled={returning === p.id}
                            className="btn btn-ghost"
                            style={{ padding: '6px 10px', color: '#1a56db', border: '1px solid #bfdbfe', opacity: returning === p.id ? 0.6 : 1 }}
                            title="إرجاع لمرحلة البدء"
                          >
                            <RotateCcw style={{ width: '16px', height: '16px' }} />
                          </button>
                        )}
                      </div>
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
