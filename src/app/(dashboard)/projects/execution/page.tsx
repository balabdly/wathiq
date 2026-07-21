'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Eye, Undo2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '@/hooks/useStore'
import { reopenProjectPlanning } from '@/lib/project-planning-service'
import { useExecution } from './ExecutionContext'
import { formatDate } from '@/lib/utils'
import { useFilteredPagination } from '@/hooks/useFilteredPagination'

export default function ExecutionListPage() {
  const router = useRouter()
  const { currentUser } = useStore()
  const { tenantId, projects, reload } = useExecution()
  const [search, setSearch] = useState('')
  const [returning, setReturning] = useState<number | null>(null)

  const canEdit = !!(currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit'))

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
  })

  const { paginated, PaginationBar } = useFilteredPagination(filtered, 10, search)

  async function handleReturnToPlanning(projectId: number, name: string) {
    if (!tenantId) return
    const msg = [
      `إرجاع «${name}» إلى مرحلة التخطيط؟`,
      '',
      '• يُلغى إسناد الفريق',
      '• يُعاد فتح التخطيط للتعديل',
      '• سجل الإنجاز اليومي يبقى محفوظاً',
    ].join('\n')
    if (!confirm(msg)) return
    setReturning(projectId)
    try {
      await reopenProjectPlanning(tenantId, projectId)
      toast.success('تم إرجاع المشروع إلى التخطيط')
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
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏗️</div>
            لا مشاريع في سلة التنفيذ — اعتمد تخطيط مشروع لنقله هنا
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الرقم', 'المشروع', 'العميل', 'الفريق', 'آخر تحديث', 'التقدم', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }} dir="ltr">{p.code || '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{p.name}</td>
                    <td style={{ padding: '10px 12px', color: '#1a56db' }}>{p.client_name || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {p.team ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', padding: '3px 8px', borderRadius: '6px', background: '#eff6ff', color: '#1a56db' }}>
                          <Users style={{ width: '12px', height: '12px' }} />
                          {p.team.name}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#c81e1e' }}>غير مسند</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>
                      {p.lastLogDate ? formatDate(p.lastLogDate) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '6px', overflow: 'hidden', minWidth: '60px' }}>
                          <div style={{ height: '100%', width: `${p.progress ?? 0}%`, background: '#e6820a', borderRadius: '6px' }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#e6820a' }}>{p.progress ?? 0}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => router.push(`/projects/execution/${p.id}`)}
                          className="btn btn-ghost"
                          style={{ padding: '6px 10px', color: '#e6820a', border: '1px solid #fcd34d' }}
                          title="عرض المشروع"
                        >
                          <Eye style={{ width: '16px', height: '16px' }} />
                        </button>
                        {canEdit && p.pmo_phase === '3_EXEC' && (
                          <button
                            onClick={() => handleReturnToPlanning(p.id, p.name)}
                            disabled={returning === p.id}
                            className="btn btn-ghost"
                            style={{ padding: '6px 10px', color: '#0ea77b', border: '1px solid #86efac', opacity: returning === p.id ? 0.6 : 1 }}
                            title="إرجاع لمرحلة التخطيط"
                          >
                            <Undo2 style={{ width: '16px', height: '16px' }} />
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
      <PaginationBar color="#e6820a" />
    </div>
  )
}
