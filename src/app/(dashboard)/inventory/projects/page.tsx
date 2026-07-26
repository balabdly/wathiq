// src/app/(dashboard)/inventory/projects/page.tsx
// عهدة المشاريع — قائمة + صفحة تفاصيل لكل مشروع
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { fetchCustodyProjectsList, type CustodyProjectListRow } from '@/lib/project-custody-service'
import { FolderOpen, Search, RotateCcw, Eye } from 'lucide-react'

const COUNT_COL: Record<string, string> = {
  receive: '#0ea77b',
  issue: '#c81e1e',
  return_client: '#e6820a',
  return_site: '#1a56db',
}

function CountCell({ value, color }: { value: number; color: string }) {
  return (
    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
      {value > 0 ? (
        <span style={{ fontWeight: 800, color }} dir="ltr">{value}</span>
      ) : (
        <span style={{ color: '#cbd5e1' }}>—</span>
      )}
    </td>
  )
}

export default function InventoryProjectsPage() {
  const { tenant, activeBranch } = useStore()

  const [projects, setProjects] = useState<CustodyProjectListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { if (tenant) loadBase() }, [tenant?.id, activeBranch?.id])

  async function loadBase() {
    if (!tenant) return
    setLoading(true)
    const list = await fetchCustodyProjectsList(tenant.id, activeBranch?.id ?? null)
    setProjects(list)
    setLoading(false)
  }

  const filtered = projects.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
  })

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  const headers = ['رقم المشروع', 'استلام', 'صرف', 'إرجاع', 'مرتجع', '']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderOpen style={{ width: '22px', height: '22px', color: '#0f766e' }} /> عهدة المشاريع
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>
          اضغط 👁 لعرض تفاصيل العهدة والأذون
        </p>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', maxWidth: '320px', flex: 1 }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم أو اسم المشروع..."
            className="input" style={{ paddingRight: '32px', fontSize: '0.82rem', width: '100%' }} />
        </div>
        <button onClick={loadBase} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>
          <RotateCcw style={{ width: '14px', height: '14px' }} /> تحديث
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '14px', padding: '60px', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏗️</div>
          <div style={{ fontWeight: 600 }}>لا توجد مشاريع عليها عهدة</div>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '620px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {headers.map(h => (
                  <th key={h || 'action'} style={{
                    padding: '11px 12px', textAlign: h && h !== 'رقم المشروع' ? 'center' : 'right',
                    fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(proj => (
                <tr key={proj.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1a56db' }} dir="ltr">{proj.code || '—'}</div>
                    {!proj.code && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{proj.name}</div>
                    )}
                  </td>
                  <CountCell value={proj.voucher_counts.receive} color={COUNT_COL.receive} />
                  <CountCell value={proj.voucher_counts.issue} color={COUNT_COL.issue} />
                  <CountCell value={proj.voucher_counts.return_client} color={COUNT_COL.return_client} />
                  <CountCell value={proj.voucher_counts.return_site} color={COUNT_COL.return_site} />
                  <td style={{ padding: '12px 16px', textAlign: 'left', width: '56px' }}>
                    <Link href={`/inventory/projects/${proj.id}`} title="عرض العهدة"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #99f6e4',
                        background: '#f0fdfa', color: '#0f766e', textDecoration: 'none',
                      }}>
                      <Eye style={{ width: '16px', height: '16px' }} />
                    </Link>
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
