// src/app/(dashboard)/inventory/projects/page.tsx
// عهدة المشاريع — قائمة + صفحة تفاصيل لكل مشروع
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { fetchCustodyProjectsList, type CustodyProjectListRow } from '@/lib/project-custody-service'
import { FolderOpen, Search, RotateCcw, Eye } from 'lucide-react'

const COUNT_META = [
  { key: 'receive' as const, label: 'استلام', color: '#0ea77b', bg: '#ecfdf5' },
  { key: 'issue' as const, label: 'صرف', color: '#c81e1e', bg: '#fef2f2' },
  { key: 'return_client' as const, label: 'إرجاع', color: '#e6820a', bg: '#fffbeb' },
  { key: 'return_site' as const, label: 'مرتجع', color: '#1a56db', bg: '#eff6ff' },
  { key: 'loan' as const, label: 'استعارة', color: '#7c3aed', bg: '#f5f3ff' },
]

const TH: React.CSSProperties = {
  padding: '12px 14px',
  fontWeight: 700,
  color: '#64748b',
  fontSize: '0.72rem',
  borderBottom: '2px solid #e2e8f0',
  whiteSpace: 'nowrap',
  background: '#f8fafc',
}

function CountBadge({ value, color, bg }: { value: number; color: string; bg: string }) {
  if (value <= 0) {
    return <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>—</span>
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '36px', height: '30px', padding: '0 10px',
      borderRadius: '8px', fontWeight: 800, fontSize: '0.85rem',
      background: bg, color, border: `1px solid ${color}33`,
    }} dir="ltr">
      {value}
    </span>
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
        <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '10px', overflow: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px',
            fontSize: '0.82rem', minWidth: '780px', tableLayout: 'fixed',
          }}>
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '64px' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...TH, textAlign: 'right', borderRadius: '0 10px 10px 0' }}>رقم المشروع</th>
                {COUNT_META.map(c => (
                  <th key={c.key} style={{ ...TH, textAlign: 'center' }}>{c.label}</th>
                ))}
                <th style={{ ...TH, textAlign: 'center', borderRadius: '10px 0 0 10px' }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map(proj => (
                <tr key={proj.id}>
                  <td style={{
                    padding: '14px 16px', verticalAlign: 'middle',
                    background: 'white', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0', borderRadius: '0 12px 12px 0',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                      <span style={{
                        display: 'inline-block', padding: '5px 12px', borderRadius: '8px',
                        background: '#eff6ff', border: '1px solid #bfdbfe',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontWeight: 700, fontSize: '0.88rem', color: '#1e40af',
                        letterSpacing: '0.04em', lineHeight: 1.4,
                        direction: 'ltr', unicodeBidi: 'isolate',
                      }}>
                        {proj.code || '—'}
                      </span>
                      {proj.name && proj.code !== proj.name && (
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {proj.name}
                        </span>
                      )}
                    </div>
                  </td>
                  {COUNT_META.map(c => (
                    <td key={c.key} style={{
                      padding: '14px 8px', textAlign: 'center', verticalAlign: 'middle',
                      background: 'white', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
                    }}>
                      <CountBadge value={proj.voucher_counts[c.key]} color={c.color} bg={c.bg} />
                    </td>
                  ))}
                  <td style={{
                    padding: '14px 12px', textAlign: 'center', verticalAlign: 'middle',
                    background: 'white', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
                    borderLeft: '1px solid #e2e8f0', borderRadius: '12px 0 0 12px',
                  }}>
                    <Link href={`/inventory/projects/${proj.id}`} title="عرض العهدة"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '36px', height: '36px', borderRadius: '10px',
                        border: '1px solid #99f6e4', background: '#f0fdfa', color: '#0f766e', textDecoration: 'none',
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
