// src/app/(dashboard)/inventory/warehouses/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { ArrowRight, Eye, Pencil, Plus, Package } from 'lucide-react'
import { WH_TYPES, type InventoryWarehouse } from '@/components/inventory/types'
import WarehouseModal from '@/components/inventory/WarehouseModal'
import toast from 'react-hot-toast'

export default function WarehousesPage() {
  const router = useRouter()
  const { tenant, activeBranch, warehouses, setWarehouses, currentUser } = useStore()
  const [loading, setLoading]   = useState(true)
  const [showModal, setModal]   = useState(false)
  const [editWh, setEditWh]     = useState<InventoryWarehouse | null>(null)
  const [whStats, setWhStats]   = useState<Record<number, { total: number; low: number }>>({})

  const canEdit = currentUser?.permissions?.includes('inventory')

  useEffect(() => { loadData() }, [tenant?.id, activeBranch?.id])

  async function loadData() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const { data } = await supabase.from('warehouses')
      .select('*').eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).order('id')
    setWarehouses(data || [])

    // إحصائيات كل مستودع
    const stats: Record<number, { total: number; low: number }> = {}
    await Promise.all((data || []).map(async (wh: any) => {
      const [total, low] = await Promise.all([
        supabase.from('materials').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id).eq('warehouse_id', wh.id),
        supabase.from('materials').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id).eq('warehouse_id', wh.id).lte('qty', 5).gt('qty', 0),
      ])
      stats[wh.id] = { total: total.count || 0, low: low.count || 0 }
    }))
    setWhStats(stats)
    setLoading(false)
  }

  async function handleSave(data: any) {
    if (!tenant || !activeBranch) return
    let error: any = null
    if (data.id) {
      const { error: err } = await supabase.from('warehouses')
        .update({ name: data.name, location: data.location, sections: data.sections })
        .eq('id', data.id)
      error = err
    } else {
      const { error: err } = await supabase.from('warehouses')
        .insert({ name: data.name, location: data.location, sections: data.sections, tenant_id: tenant.id, branch_id: activeBranch.id })
      error = err
    }
    if (error) { toast.error('خطأ: ' + error.message); return }
    await loadData(); setModal(false); setEditWh(null)
    toast.success(data.id ? 'تم التعديل ✅' : 'تمت الإضافة ✅')
  }

  const whByType: Record<string, InventoryWarehouse> = {}
  warehouses.forEach((w: any) => { if (w.wh_type) whByType[w.wh_type] = w as InventoryWarehouse })

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/inventory')} className="btn btn-ghost btn-sm">
          <ArrowRight style={{ width: '16px', height: '16px' }} /> العودة
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🏭 المستودع الرئيسي
          </h1>
          <p style={{ fontSize: '0.82rem', color: '#9ca3af', marginTop: '2px' }}>
            {activeBranch?.name} · {warehouses.length} مستودع
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditWh(null); setModal(true) }}
            className="btn btn-ghost btn-sm border border-gray-200">
            <Plus style={{ width: '15px', height: '15px' }} /> مستودع جديد
          </button>
        )}
      </div>

      {/* المستودعات الأربعة الثابتة */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            {WH_TYPES.map(wt => {
              const wh = whByType[wt.type]
              const st = wh ? whStats[wh.id] : null
              return (
                <div key={wt.type} className="card"
                  style={{ padding: '20px', border: wh ? `2px solid ${wt.color}22` : '2px dashed #e5e7eb', position: 'relative', overflow: 'hidden' }}>

                  {/* خط لوني علوي */}
                  {wh && <div style={{ position: 'absolute', top: 0, right: 0, left: 0, height: '3px', background: wt.color }} />}

                  {/* هيدر */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', marginTop: wh ? '6px' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: wt.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                        {wt.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: wt.color }}>{wt.label}</div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>{wt.desc}</div>
                      </div>
                    </div>
                    {canEdit && wh && (
                      <button onClick={() => { setEditWh(wh); setModal(true) }}
                        style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '7px', cursor: 'pointer', padding: '4px 6px', color: '#6b7280' }}>
                        <Pencil style={{ width: '13px', height: '13px' }} />
                      </button>
                    )}
                  </div>

                  {wh ? (
                    <>
                      {/* إحصائيات */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, color: wt.color, fontSize: '1.2rem' }}>{st?.total ?? '—'}</div>
                          <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>مادة</div>
                        </div>
                        <div style={{ background: st?.low ? '#fffbeb' : 'var(--bg2)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, color: st?.low ? '#e6820a' : '#9ca3af', fontSize: '1.2rem' }}>{st?.low ?? '—'}</div>
                          <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>منخفض</div>
                        </div>
                      </div>

                      {/* أقسام المستودع */}
                      {(wh as any).sections?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                          {(wh as any).sections.map((s: string, i: number) => (
                            <span key={i} style={{ background: wt.color + '12', border: `1px solid ${wt.color}33`, borderRadius: '6px', padding: '2px 8px', fontSize: '0.7rem', color: wt.color, fontWeight: 600 }}>
                              📦 {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {wh.location && (
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '10px' }}>
                          📍 {wh.location}
                        </div>
                      )}

                      {/* زر الدخول */}
                      <button onClick={() => router.push('/inventory/' + wh.id)}
                        style={{ width: '100%', padding: '9px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: wt.color, color: 'white', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'opacity 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                        <Eye style={{ width: '15px', height: '15px' }} />
                        فتح المستودع
                      </button>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '10px' }}>لم يُنشأ بعد</div>
                      {canEdit && (
                        <button onClick={() => { setModal(true) }}
                          style={{ padding: '6px 16px', borderRadius: '8px', border: `1px dashed ${wt.color}`, background: 'transparent', cursor: 'pointer', color: wt.color, fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Plus style={{ width: '13px', height: '13px' }} /> إنشاء
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* مستودعات إضافية */}
          {warehouses.filter((w: any) => !['projects','returns','scrap','private'].includes(w.wh_type || '')).length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#9ca3af', marginBottom: '8px' }}>مستودعات إضافية</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                {warehouses.filter((w: any) => !['projects','returns','scrap','private'].includes(w.wh_type || '')).map((wh: any) => (
                  <div key={wh.id} className="card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Package style={{ width: '16px', height: '16px', color: '#6b7280' }} />
                        {wh.name}
                      </div>
                      {canEdit && (
                        <button onClick={() => { setEditWh(wh); setModal(true) }} className="btn btn-ghost btn-xs">
                          <Pencil style={{ width: '13px', height: '13px' }} />
                        </button>
                      )}
                    </div>
                    {whStats[wh.id] && (
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '10px' }}>
                        {whStats[wh.id].total} مادة
                      </div>
                    )}
                    <button onClick={() => router.push('/inventory/' + wh.id)}
                      className="btn btn-primary w-full btn-sm" style={{ justifyContent: 'center' }}>
                      <Eye style={{ width: '13px', height: '13px' }} /> فتح
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <WarehouseModal
          warehouse={editWh || undefined}
          onClose={() => { setModal(false); setEditWh(null) }}
          onSave={handleSave} />
      )}
    </div>
  )
}
