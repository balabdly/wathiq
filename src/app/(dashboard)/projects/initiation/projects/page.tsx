'use client'
import { useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useInitiation } from '../InitiationContext'
import InitiationProjectModal from '@/components/projects/InitiationProjectModal'
import ManageProjectTypesModal from '@/components/projects/ManageProjectTypesModal'
import { Plus, Search, Pencil, Trash2, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import type { InitiationProject } from '../InitiationContext'

function typeLabel(code: string | undefined, types: { code: string; name: string }[]) {
  if (!code) return '—'
  return types.find(t => t.code === code || t.name === code)?.name || code
}

export default function InitiationProjectsPage() {
  const { tenant } = useStore()
  const { projects, projectTypes, reloadShared, reloadKpis, tenantId, branchId } = useInitiation()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showTypes, setShowTypes] = useState(false)
  const [editProject, setEditProject] = useState<InitiationProject | null>(null)

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return !q
      || p.name.toLowerCase().includes(q)
      || (p.code || '').toLowerCase().includes(q)
      || (p.client_name || '').includes(search)
  })

  async function handleDelete(id: number, name: string) {
    if (!confirm(`حذف "${name}"؟`)) return
    await supabase.from('projects').delete().eq('id', id)
    toast.success('تم الحذف')
    await reloadShared()
    await reloadKpis()
  }

  if (!tenantId || !branchId) {
    return <div className="card" style={{ padding: '24px', color: 'var(--text3)' }}>اختر فرعاً للمتابعة</div>
  }

  return (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px', width: '220px' }} placeholder="بحث..." />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setShowTypes(true)} className="btn btn-ghost" style={{ fontSize: '0.82rem', border: '1px solid #ddd6fe', color: '#7c3aed' }}>
            <Tag style={{ width: '15px', height: '15px' }} /> تحديد أنواع المشاريع
          </button>
          <button onClick={() => { setEditProject(null); setShowModal(true) }} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
            <Plus style={{ width: '16px', height: '16px' }} /> مشروع جديد
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
          لا مشاريع في مرحلة البدء
        </div>
      ) : (
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['الرقم', 'المشروع', 'العميل', 'النوع', 'القيمة', 'البداية', 'النهاية', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace' }} dir="ltr">{p.code || '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{p.name}</td>
                  <td style={{ padding: '10px 12px', color: '#1a56db', fontWeight: 600 }}>{p.client_name || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{typeLabel(p.type, projectTypes)}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0ea77b' }}>
                    {p.estimated_value ? `${Number(p.estimated_value).toLocaleString('ar-SA')} ر.س` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>{p.start_date ? formatDate(p.start_date) : '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>{p.end_date ? formatDate(p.end_date) : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => { setEditProject(p); setShowModal(true) }} className="btn btn-ghost" style={{ padding: '6px' }} title="تعديل">
                        <Pencil style={{ width: '14px', height: '14px' }} />
                      </button>
                      <button onClick={() => handleDelete(p.id, p.name)} className="btn btn-ghost" style={{ padding: '6px', color: '#c81e1e' }} title="حذف">
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
        <InitiationProjectModal
          project={editProject}
          projectTypes={projectTypes}
          tenantId={tenantId}
          branchId={branchId}
          onClose={() => { setShowModal(false); setEditProject(null) }}
          onSave={async () => { await reloadShared(); await reloadKpis() }}
        />
      )}

      {showTypes && tenant && (
        <ManageProjectTypesModal
          tenantId={tenant.id}
          onClose={() => setShowTypes(false)}
          onChanged={reloadShared}
        />
      )}
    </div>
  )
}
