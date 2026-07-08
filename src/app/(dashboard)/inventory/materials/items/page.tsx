// src/app/(dashboard)/inventory/materials/items/page.tsx
// تبويب: الأرصدة — متابعة تشغيلية (أرصدة + جرد + تصدير) — تعريف الأصناف من صفحة المستودعات والأصناف
'use client'
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  X, Save, Search, Download, Settings,
  Package, Scale, Filter,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useMaterials } from '../MaterialsContext'
import { type Material } from '../opsShared'

const PAGE_SIZE = 50

// ══════════════════════════════════════════
// الصفحة الرئيسية: الأصناف والأرصدة
// ══════════════════════════════════════════
export default function MaterialsItemsPage() {
  const { tenant, activeBranch } = useStore()
  const { warehouses, projects, loading: ctxLoading } = useMaterials()
  const [materials,  setMaterials]  = useState<Material[]>([])
  const [matTotal,   setMatTotal]   = useState(0)
  const [matPage,    setMatPage]    = useState(1)
  const [loading,    setLoading]    = useState(false)

  // فلاتر
  const [search,      setSearch]      = useState('')
  const [filterWh,    setFilterWh]    = useState('')
  const [filterQty,   setFilterQty]   = useState<'all' | 'with' | 'without' | 'low'>('all')
  const [filterSource, setFilterSource] = useState<'all' | 'خاص' | 'SEC'>('all')
  const [viewMode,    setViewMode]    = useState<'all' | 'project'>('all')
  const [projectId,   setProjectId]   = useState('')

  // modals
  const [modal,      setModal]      = useState<'check' | null>(null)
  const [checkItems, setCheckItems] = useState<any[]>([])
  const [checkWh,    setCheckWh]    = useState('')
  const [openLoans,  setOpenLoans]  = useState(0)

  const totalPages = Math.ceil(matTotal / PAGE_SIZE)

  useEffect(() => { if (tenant && !ctxLoading) loadMaterials(1) }, [tenant?.id, ctxLoading])

  useEffect(() => {
    if (!tenant) return
    supabase.from('project_material_loans')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).neq('status', 'مُعاد كلياً')
      .then(({ count }) => setOpenLoans(count || 0))
  }, [tenant?.id])

  async function loadMaterials(page = 1) {
    if (!tenant) return
    setLoading(true)
    const from = (page - 1) * PAGE_SIZE

    if (viewMode === 'project' && projectId) {
      const { data } = await supabase.from('project_materials')
        .select('*, material:materials(id, name, unit, catalog_no, sec_number, mat_code), warehouse:warehouses(name)')
        .eq('tenant_id', tenant.id).eq('project_id', Number(projectId))
      const proj = projects.find((p: any) => p.id === Number(projectId))
      const mapped = (data || []).map((pm: any) => ({
        id: pm.material?.id, name: pm.material?.name || '—', unit: pm.material?.unit || '—',
        catalog_no: pm.material?.catalog_no, sec_number: pm.material?.sec_number,
        mat_code: pm.material?.mat_code, qty: pm.qty_balance,
        qty_received: pm.qty_received, qty_issued: pm.qty_issued,
        reorder: 0, warehouse_id: pm.warehouse_id,
        warehouse: { name: pm.warehouse?.name || '—' }, project_name: proj?.name || '',
      }))
      const filtered = search ? mapped.filter((m: any) => m.name?.includes(search)) : mapped
      setMaterials(filtered as any); setMatTotal(filtered.length); setMatPage(1)
      setLoading(false); return
    }

    let q = supabase.from('materials')
      .select('*, warehouse:warehouses(name)', { count: 'exact' })
      .eq('tenant_id', tenant.id).order('name').range(from, from + PAGE_SIZE - 1)

    if (filterWh)                  q = q.eq('warehouse_id', Number(filterWh))
    if (filterSource !== 'all')    q = q.eq('source', filterSource)
    if (filterQty === 'with')      q = q.gt('qty', 0)
    if (filterQty === 'without')   q = q.lte('qty', 0)
    if (filterQty === 'low')       q = q.gt('qty', 0).lte('qty', 10)
    if (search) q = q.or(`name.ilike.%${search}%,catalog_no.ilike.%${search}%,sec_number.ilike.%${search}%,mat_code.ilike.%${search}%`)

    const { data, count } = await q
    setMaterials(data || []); setMatTotal(count || 0); setMatPage(page)
    setLoading(false)
  }

  async function loadInventoryCheck() {
    if (!tenant || !checkWh) return
    const { data } = await supabase.from('materials').select('*')
      .eq('tenant_id', tenant.id).eq('warehouse_id', Number(checkWh)).order('name')
    setCheckItems((data || []).map(m => ({ ...m, actualQty: m.qty, systemQty: m.qty })))
  }

  async function saveInventoryCheck() {
    if (!tenant || !activeBranch) return
    const changed = checkItems.filter(i => i.actualQty !== i.systemQty)
    if (changed.length === 0) { toast.error('لا توجد فروقات للتسوية'); return }

    // ── رقم إذن تسوية موحد لكل سطور الجرد ──
    const { data: voucherNo } = await supabase.rpc('generate_txn_number', { p_type: 'استلام' })

    for (const item of changed) {
      const diff = item.actualQty - item.systemQty
      await supabase.from('materials').update({ qty: item.actualQty }).eq('id', item.id)
      await supabase.from('stock_ledger').insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        txn_number: voucherNo || null,
        type: diff > 0 ? 'استلام' : 'صرف', mat_name: item.name, unit: item.unit,
        qty: Math.abs(diff), qty_before: item.systemQty, qty_after: item.actualQty,
        wh_name: warehouses.find(w => w.id === Number(checkWh))?.name || '',
        dispatch_note: 'تسوية جرد',
      })
    }
    toast.success(`✅ تم جرد وتسوية ${changed.length} مادة`)
    setModal(null); loadMaterials(matPage)
  }

  function exportCSV() {
    const headers = ['الاسم', 'رقم الكتالوج', 'رقم SEC', 'المستودع', 'الوحدة', 'الكمية', 'حد الأمان', 'المصدر']
    const rows = materials.map(m => [m.name, m.catalog_no || '', m.sec_number || '', (m.warehouse as any)?.name || '', m.unit, m.qty, m.reorder, m.source || ''])
    const csv = [headers, ...rows].map(r => r.join('\t')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'المواد.xls'; a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* شريط الإجراءات */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>
          <Package style={{ width: '14px', height: '14px', verticalAlign: '-2px', marginLeft: '4px' }} />
          {matTotal.toLocaleString()} صنف — متابعة الأرصدة (تعريف الأصناف من المستودعات والأصناف)
        </span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
            <Download style={{ width: '15px', height: '15px' }} /> تصدير
          </button>
          <button onClick={() => setModal('check')} className="btn btn-ghost" style={{ fontSize: '0.82rem', color: '#e6820a', borderColor: '#fde68a' }}>
            <Scale style={{ width: '15px', height: '15px' }} /> جرد المستودع
          </button>
        </div>
      </div>

      {/* ذمم الاستعارة المفتوحة */}
      {openLoans > 0 && (
        <Link href="/inventory/materials/issue" style={{ textDecoration: 'none' }}>
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: '#7c3aed', cursor: 'pointer' }}>
            🔁 <strong>{openLoans}</strong> ذمّة استعارة مفتوحة بين المشاريع — التسوية من تبويب أذون الصرف ←
          </div>
        </Link>
      )}

      {/* الفلاتر */}
      <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* طريقة العرض */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[{ id: 'all', label: '📦 كل المواد' }, { id: 'project', label: '🏗️ مشروع' }].map(opt => (
            <button key={opt.id} onClick={() => { setViewMode(opt.id as any); setMaterials([]); setMatTotal(0) }}
              style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                borderColor: viewMode === opt.id ? '#1a56db' : 'var(--border)',
                background: viewMode === opt.id ? '#eff6ff' : 'transparent',
                color: viewMode === opt.id ? '#1a56db' : 'var(--text3)' }}>
              {opt.label}
            </button>
          ))}
        </div>

        {viewMode === 'project' ? (
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className="select" style={{ minWidth: '200px', fontSize: '0.82rem' }}>
            <option value="">— اختر المشروع —</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : (<>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadMaterials(1)}
              placeholder="بحث بالاسم أو الكود..." className="input" style={{ paddingRight: '32px', width: '200px', fontSize: '0.82rem' }} />
          </div>
          <select value={filterWh} onChange={e => setFilterWh(e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
            <option value="">كل المستودعات</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select value={filterQty} onChange={e => setFilterQty(e.target.value as any)} className="select" style={{ fontSize: '0.82rem' }}>
            <option value="all">كل الكميات</option>
            <option value="with">لها كمية</option>
            <option value="without">كمية صفر</option>
            <option value="low">منخفضة</option>
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value as any)} className="select" style={{ fontSize: '0.82rem' }}>
            <option value="all">كل المصادر</option>
            <option value="خاص">خاص</option>
            <option value="SEC">SEC</option>
          </select>
        </>)}

        <button onClick={() => loadMaterials(1)} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
          <Filter style={{ width: '13px', height: '13px' }} /> عرض
        </button>
      </div>
      {/* الجدول */}
      <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid #e5e7eb', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : materials.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📦</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
              {search || filterWh || filterQty !== 'all' ? 'لا توجد نتائج بهذه الفلاتر' : 'لا توجد مواد — ابدأ بإضافة مادة'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2, #f8fafc)', position: 'sticky', top: 0 }}>
                    {(viewMode === 'project'
                      ? ['الاسم', 'المستودع', 'الوحدة', 'مستلم', 'مصروف', 'الرصيد']
                      : ['الكود', 'رقم الكتالوج', 'رقم SEC', 'الاسم', 'المستودع', 'الوحدة', 'الكمية', 'حد الأمان', 'الحالة', '']
                    ).map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materials.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--bg2, #f8fafc)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2, #f8fafc)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      {viewMode === 'project' ? (<>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{m.name}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: '0.78rem' }}>{(m as any).warehouse?.name || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text3)' }}>{m.unit}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#0ea77b', fontWeight: 700 }}>{(m as any).qty_received ?? '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#c81e1e', fontWeight: 700 }}>{(m as any).qty_issued ?? '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 800, color: m.qty <= 0 ? '#c81e1e' : '#1a56db', fontSize: '0.9rem' }}>{m.qty}</td>
                      </>) : (<>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700 }}>{m.mat_code || '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#1a56db' }}>{m.catalog_no || '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#9ca3af' }}>{m.sec_number || '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.source === 'SEC' && <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '4px', padding: '1px 5px', fontSize: '0.65rem', fontWeight: 700, marginLeft: '5px' }}>SEC</span>}
                          {m.name}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{(m.warehouse as any)?.name || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text3)' }}>{m.unit}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', color: m.qty <= 0 ? '#c81e1e' : m.qty <= m.reorder ? '#d97706' : '#0ea77b' }}>
                          {m.qty}
                          {m.qty > 0 && m.qty <= m.reorder && <span style={{ marginRight: '4px', fontSize: '0.68rem' }}>⚠️</span>}
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text3)' }}>{m.reorder || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className={`badge ${m.qty <= 0 ? 'badge-red' : m.qty <= m.reorder ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: '0.68rem' }}>
                            {m.qty <= 0 ? 'نفدت' : m.qty <= m.reorder ? 'منخفض' : 'متوفر'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <Link href={`/inventory/warehouses?wh=${m.warehouse_id}`} title="إعداد الصنف (تعديل / تعطيل)"
                            style={{ display: 'inline-flex', padding: '4px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', color: '#6b7280' }}>
                            <Settings style={{ width: '12px', height: '12px' }} />
                          </Link>
                        </td>
                      </>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg2, #f8fafc)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                  {((matPage - 1) * PAGE_SIZE) + 1} — {Math.min(matPage * PAGE_SIZE, matTotal)} من {matTotal.toLocaleString()} مادة
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => { setMatPage(p => p - 1); loadMaterials(matPage - 1) }} disabled={matPage === 1}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: matPage === 1 ? 'not-allowed' : 'pointer', opacity: matPage === 1 ? 0.4 : 1 }}>
                    <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                  <span style={{ padding: '5px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{matPage} / {totalPages}</span>
                  <button onClick={() => { setMatPage(p => p + 1); loadMaterials(matPage + 1) }} disabled={matPage === totalPages}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: matPage === totalPages ? 'not-allowed' : 'pointer', opacity: matPage === totalPages ? 0.4 : 1 }}>
                    <ChevronLeft style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* جرد المستودع */}
      {modal === 'check' && (
        <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale style={{ width: '18px', height: '18px', color: '#e6820a' }} /> جرد المستودع
              </h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>اختر المستودع</label>
                  <select value={checkWh} onChange={e => setCheckWh(e.target.value)} className="select">
                    <option value="">— اختر —</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <button onClick={loadInventoryCheck} disabled={!checkWh} className="btn btn-primary" style={{ background: '#e6820a' }}>
                  تحميل المواد
                </button>
              </div>
              {checkItems.length > 0 && (
                <>
                  <div style={{ overflowY: 'auto', maxHeight: '380px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg2)', position: 'sticky', top: 0 }}>
                          {['المادة', 'الوحدة', 'كمية النظام', 'الكمية الفعلية', 'الفرق'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {checkItems.map((item, i) => {
                          const diff = item.actualQty - item.systemQty
                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--bg2)', background: diff !== 0 ? '#fffbeb' : 'transparent' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{item.name}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--text3)' }}>{item.unit}</td>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#9ca3af' }}>{item.systemQty}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <input type="number" value={item.actualQty} min="0"
                                  onChange={e => setCheckItems(prev => prev.map((ci, j) => j === i ? { ...ci, actualQty: Number(e.target.value) } : ci))}
                                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                                  style={{ width: '80px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.82rem', textAlign: 'center' }} dir="ltr" />
                              </td>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: diff !== 0 ? 700 : 400, color: diff > 0 ? '#0ea77b' : diff < 0 ? '#c81e1e' : '#9ca3af' }}>
                                {diff > 0 ? '+' : ''}{diff}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.82rem', color: '#92400e', border: '1px solid #fde68a' }}>
                    🔔 الخلايا الصفراء تعني وجود فروقات — عدّل الكمية الفعلية ثم احفظ
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setModal(null)} className="btn btn-ghost">إلغاء</button>
              {checkItems.length > 0 && (
                <button onClick={saveInventoryCheck} className="btn btn-primary" style={{ background: '#e6820a' }}>
                  <Save style={{ width: '14px', height: '14px' }} /> حفظ الجرد
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
