'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Eye, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '@/hooks/useStore'
import { reopenProjectToExecution } from '@/lib/project-close-service'
import { useClose } from './CloseContext'
import PlanningProgressBadge from '@/components/projects/PlanningProgressBadge'
import { useFilteredPagination } from '@/hooks/useFilteredPagination'

export default function CloseListPage() {
  const router = useRouter()
  const { currentUser } = useStore()
  const { tenantId, projects, reload } = useClose()
  const [search, setSearch] = useState('')
  const [returning, setReturning] = useState<number | null>(null)

  const canEdit = !!(currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit'))

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
  })

  const { paginated, PaginationBar } = useFilteredPagination(filtered, 10, search)

  async function handleReturnToExecution(projectId: number, name: string) {
    if (!tenantId) return
    const msg = [
      `إرجاع «${name}» إلى مرحلة التنفيذ؟`,
      '',
      '• لمراجعة التنفيذ أو تعديل المقايسة',
      '• بيانات الإغلاق تبقى محفوظة',
    ].join('\n')
    if (!confirm(msg)) return
    setReturning(projectId)
    try {
      await reopenProjectToExecution(tenantId, projectId)
      toast.success('تم إرجاع المشروع إلى التنفيذ')
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
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏁</div>
            لا مشاريع في سلة الإغلاق — انقل مشروعاً من التنفيذ بعد اكتمال 100%
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الإغلاق', 'الرقم', 'المشروع', 'العميل', 'موانع', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(p => {
                  const blockerCount = (p.blockers?.openTasks || 0) + (p.blockers?.openNcr || 0) + (p.blockers?.missingDocs?.length || 0)
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', minWidth: '120px' }}>
                        {p.closureProgress ? (
                          <PlanningProgressBadge progress={p.closureProgress} size="sm" />
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }} dir="ltr">{p.code || '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>{p.name}</td>
                      <td style={{ padding: '10px 12px', color: '#0ea77b' }}>{p.client_name || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {blockerCount > 0 ? (
                          <span style={{ fontSize: '0.72rem', color: '#c81e1e', fontWeight: 700 }}>{blockerCount} مانع</span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#0ea77b' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => router.push(`/projects/close/${p.id}`)}
                            className="btn btn-ghost"
                            style={{ padding: '6px 10px', color: '#0ea77b', border: '1px solid #86efac' }}
                            title="عرض المشروع"
                          >
                            <Eye style={{ width: '16px', height: '16px' }} />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleReturnToExecution(p.id, p.name)}
                              disabled={returning === p.id}
                              className="btn btn-ghost"
                              style={{ padding: '6px 10px', color: '#e6820a', border: '1px solid #fcd34d', opacity: returning === p.id ? 0.6 : 1 }}
                              title="إرجاع لمرحلة التنفيذ"
                            >
                              <Undo2 style={{ width: '16px', height: '16px' }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <PaginationBar />
      </div>
    </div>
  )
}
