'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useInitiation } from '../InitiationContext'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Project } from '@/types'
import { WO_SOURCES } from '@/lib/sec-workflow'

const ProjectModal = dynamic(() => import('@/components/projects/ProjectModal'), { ssr: false })

export default function InitiationProjectsPage() {
  const { tenant, activeBranch } = useStore()
  const { projects, reloadShared, reloadKpis } = useInitiation()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q) || (p.wo_number || '').includes(q)
  })

  async function handleSave(data: Partial<Project>) {
    if (!tenant || !activeBranch) return
    const payload = {
      ...data,
      pmo_phase: '1_RECEIPT',
      workflow_type: data.workflow_type || 'FULL_SEC',
      status: data.status || 'تحت التخطيط',
      progress: 0,
    }
    let error
    if ((payload as any).id) {
      const { id, ...rest } = payload as any
      const res = await supabase.from('projects').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id)
      error = res.error
    } else {
      const res = await supabase.from('projects').insert({
        ...payload,
        tenant_id: tenant.id,
        branch_id: activeBranch.id,
      })
      error = res.error
    }
    if (error) { toast.error(error.message); return }
    toast.success('تم الحفظ ✅')
    setShowModal(false)
    setEditProject(null)
    await reloadShared()
    await reloadKpis()
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`حذف "${name}"؟`)) return
    await supabase.from('projects').delete().eq('id', id)
    toast.success('تم الحذف')
    await reloadShared()
    await reloadKpis()
  }

  function openNew() {
    setEditProject(null)
    setShowModal(true)
  }

  return (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px', width: '220px' }} placeholder="بحث..." />
        </div>
        <button onClick={openNew} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> مشروع جديد
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
          لا مشاريع في مرحلة البدء — اضغط «مشروع جديد»
        </div>
      ) : (
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['WO', 'المشروع', 'النوع', 'المصدر', 'الموقع', 'القيمة التقديرية', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }} dir="ltr">
                    {p.wo_number || <span style={{ color: '#c81e1e' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    {p.code && <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{p.code}</div>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{p.type || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>
                    {WO_SOURCES.find(s => s.id === p.wo_source)?.label.split('(')[0] || '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{p.location || '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0ea77b' }}>
                    {p.estimated_value ? `${Number(p.estimated_value).toLocaleString('ar-SA')} ر.س` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => { setEditProject(p as unknown as Project); setShowModal(true) }}
                        className="btn btn-ghost" style={{ padding: '6px' }}
                        title="تعديل"
                      >
                        <Pencil style={{ width: '14px', height: '14px' }} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="btn btn-ghost" style={{ padding: '6px', color: '#c81e1e' }}
                        title="حذف"
                      >
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ProjectModal
          project={editProject?.id ? editProject : null}
          onClose={() => { setShowModal(false); setEditProject(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
