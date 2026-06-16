'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Warehouse, Plus, X, Save, Pencil, Trash2, Package, FolderOpen, Info } from 'lucide-react'
import toast from 'react-hot-toast'

type WH = {
  id: number; name: string; location?: string
  wh_category: 'عام' | 'مشاريع'
  description?: string; sections?: string[]
  tenant_id: string; branch_id?: number
}

// ══════════════════════════════════════════
// توضيح نوع المستودع
// ══════════════════════════════════════════
const WH_CATEGORY_INFO = {
  عام: {
    color:  '#1a56db', bg: '#eff6ff', border: '#bfdbfe',
    icon:   Warehouse,
    title:  'المستودع العام',
    desc:   'مواد الشركة الخاصة — تُشترى بأموال الشركة وتُصرف على أي مشروع حسب الحاجة',
    points: ['استلام من الموردين', 'صرف على أي مشروع', 'إرجاع فائض للمستودع', 'تحويل بين المستودعات'],
  },
  مشاريع: {
    color:  '#0f766e', bg: '#f0fdfa', border: '#99f6e4',
    icon:   FolderOpen,
    title:  'مستودع المشاريع (العهدة)',
    desc:   'مواد العميل — تدخل كعهدة مرتبطة بمشروع محدد وتُصرف حسب مراحل التنفيذ',
    points: ['استلام من العميل بإذن خروج', 'صرف حسب مراحل المشروع', 'إرجاع الفائض للعميل', 'تعديل مقايسة عند النقص'],
  },
}

// ══════════════════════════════════════════
// مودال: إضافة / تعديل مستودع
// ══════════════════════════════════════════
function WarehouseModal({ wh, onClose, onSave, tenantId, branchId }: {
  wh?: WH; onClose: () => void; onSave: () => void
  tenantId: string; branchId: number
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:        wh?.name        || '',
    location:    wh?.location    || '',
    description: wh?.description || '',
    wh_category: wh?.wh_category || 'عام' as 'عام' | 'مشاريع',
    sections:    wh?.sections    || [] as string[],
  })
  const [sectionInput, setSectionInput] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم المستودع مطلوب'); return }
    setSaving(true)
    const payload = {
      name:        form.name.trim(),
      location:    form.location.trim() || null,
      description: form.description.trim() || null,
      wh_category: form.wh_category,
      sections:    form.sections,
      tenant_id:   tenantId,
      branch_id:   branchId,
    }
    let error
    if (wh?.id) {
      ;({ error } = await supabase.from('warehouses').update(payload).eq('id', wh.id))
    } else {
      ;({ error } = await supabase.from('warehouses').insert(payload))
    }
    setSaving(false)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success(wh?.id ? 'تم التعديل ✅' : 'تم الإنشاء ✅')
    onSave(); onClose()
  }

  function addSection() {
    if (!sectionInput.trim()) return
    set('sections', [...form.sections, sectionInput.trim()])
    setSectionInput('')
  }

  const catInfo = WH_CATEGORY_INFO[form.wh_category]

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: catInfo.bg, borderBottom: `2px solid ${catInfo.border}` }}>
          <h3 style={{ fontWeight: 700, color: catInfo.color }}>
            {wh?.id ? 'تعديل مستودع' : 'إنشاء مستودع جديد'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* نوع المستودع */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px' }}>
              نوع المستودع <span style={{ color: '#c81e1e' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {(['عام', 'مشاريع'] as const).map(cat => {
                const info = WH_CATEGORY_INFO[cat]
                const Icon = info.icon
                return (
                  <button key={cat} type="button" onClick={() => set('wh_category', cat)}
                    style={{
                      padding: '12px', borderRadius: '10px', border: '2px solid', cursor: 'pointer', textAlign: 'right',
                      borderColor: form.wh_category === cat ? info.color : '#e5e7eb',
                      background: form.wh_category === cat ? info.bg : 'white',
                    }}>
                    <Icon style={{ width: '18px', height: '18px', color: info.color, marginBottom: '6px' }} />
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: info.color }}>{info.title}</div>
                    <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '3px', lineHeight: 1.4 }}>{info.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                اسم المستودع <span style={{ color: '#c81e1e' }}>*</span>
              </label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: مستودع الرياض" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الموقع</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="مثال: حي النزهة" />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>وصف المستودع</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              className="input" placeholder="وصف اختياري..." style={{ minHeight: '60px', resize: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الأقسام الداخلية</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input value={sectionInput} onChange={e => setSectionInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSection())}
                className="input" placeholder="اسم القسم ثم Enter..." style={{ flex: 1 }} />
              <button onClick={addSection} className="btn btn-ghost" style={{ flexShrink: 0 }}>إضافة</button>
            </div>
            {form.sections.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {form.sections.map((s, i) => (
                  <span key={i} style={{ background: catInfo.bg, border: `1px solid ${catInfo.border}`, borderRadius: '20px', padding: '3px 10px', fontSize: '0.75rem', color: catInfo.color, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {s}
                    <button onClick={() => set('sections', form.sections.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: catInfo.color, fontSize: '0.75rem', padding: 0, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: catInfo.color }}>
            {saving ? 'جاري الحفظ...' : wh?.id ? 'حفظ التعديلات' : 'إنشاء المستودع'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// بطاقة مستودع
// ══════════════════════════════════════════
function WarehouseCard({ wh, stats, onEdit, onDelete, canEdit }: {
  wh: WH; stats: { total: number; low: number }
  onEdit: () => void; onDelete: () => void; canEdit: boolean
}) {
  const info = WH_CATEGORY_INFO[wh.wh_category] || WH_CATEGORY_INFO['عام']
  const Icon = info.icon
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div style={{
      background: 'var(--card-bg, white)', borderRadius: '14px',
      border: `2px solid ${info.border}`, overflow: 'hidden',
      transition: 'box-shadow 0.2s', position: 'relative',
    }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>

      {/* شريط علوي ملون */}
      <div style={{ height: '4px', background: info.color }} />

      <div style={{ padding: '18px' }}>
        {/* الرأس */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: info.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon style={{ width: '22px', height: '22px', color: info.color }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{wh.name}</div>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, background: info.bg, color: info.color, borderRadius: '20px', padding: '1px 8px' }}>
                {wh.wh_category === 'مشاريع' ? 'مستودع مشاريع' : 'مستودع عام'}
              </span>
            </div>
          </div>
          {canEdit && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setShowInfo(!showInfo)} title="معلومات"
                style={{ padding: '5px', borderRadius: '6px', border: '1px solid var(--border)', background: showInfo ? info.bg : 'white', cursor: 'pointer', color: info.color }}>
                <Info style={{ width: '14px', height: '14px' }} />
              </button>
              <button onClick={onEdit} title="تعديل"
                style={{ padding: '5px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280' }}>
                <Pencil style={{ width: '14px', height: '14px' }} />
              </button>
              <button onClick={onDelete} title="حذف"
                style={{ padding: '5px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e' }}>
                <Trash2 style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
          )}
        </div>

        {/* معلومات الموقع */}
        {wh.location && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: '10px' }}>📍 {wh.location}</div>
        )}

        {/* وصف المستودع */}
        {wh.description && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: '10px', lineHeight: 1.5 }}>{wh.description}</div>
        )}

        {/* توضيح طريقة العمل */}
        {showInfo && (
          <div style={{ background: info.bg, border: `1px solid ${info.border}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: info.color, marginBottom: '6px' }}>طريقة العمل:</div>
            {info.points.map((p, i) => (
              <div key={i} style={{ fontSize: '0.72rem', color: info.color, display: 'flex', gap: '6px', marginBottom: '3px' }}>
                <span>•</span><span>{p}</span>
              </div>
            ))}
          </div>
        )}

        {/* الإحصائيات */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <div style={{ background: 'var(--bg2, #f8fafc)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '1.2rem', color: info.color }}>{stats.total}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>صنف</div>
          </div>
          <div style={{ background: stats.low > 0 ? '#fffbeb' : 'var(--bg2, #f8fafc)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '1.2rem', color: stats.low > 0 ? '#d97706' : 'var(--text3)' }}>{stats.low}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>منخفض</div>
          </div>
        </div>

        {/* الأقسام */}
        {wh.sections && wh.sections.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {wh.sections.map((s, i) => (
              <span key={i} style={{ background: info.bg, border: `1px solid ${info.border}`, borderRadius: '6px', padding: '2px 8px', fontSize: '0.68rem', color: info.color, fontWeight: 600 }}>
                📦 {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════
export default function WarehousesPage() {
  const { tenant, activeBranch, currentUser } = useStore()
  const [warehouses, setWarehouses] = useState<WH[]>([])
  const [stats,      setStats]      = useState<Record<number, { total: number; low: number }>>({})
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [editWh,     setEditWh]     = useState<WH | undefined>()

  const canEdit = currentUser?.permissions?.includes('inventory') || currentUser?.role === 'مدير عام'

  useEffect(() => { if (tenant && activeBranch) loadData() }, [tenant?.id, activeBranch?.id])

  async function loadData() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const { data } = await supabase.from('warehouses')
      .select('*').eq('tenant_id', tenant.id).order('wh_category').order('name')
    const whList = (data || []) as WH[]
    setWarehouses(whList)

    const s: Record<number, { total: number; low: number }> = {}
    await Promise.all(whList.map(async wh => {
      const { data: mats } = await supabase.from('materials')
        .select('qty, reorder, source').eq('tenant_id', tenant.id).eq('warehouse_id', wh.id).eq('is_active', true)
      const total = mats?.length || 0
      const low   = (mats || []).filter(m => m.source !== 'SEC' && Number(m.qty) > 0 && Number(m.qty) <= Number(m.reorder || 0)).length
      s[wh.id] = { total, low }
    }))
    setStats(s)
    setLoading(false)
  }

  async function handleDelete(wh: WH) {
    if (!confirm(`حذف مستودع "${wh.name}"؟\n\nسيتم حذف كل المواد والحركات المرتبطة به.`)) return
    const { error } = await supabase.from('warehouses').delete().eq('id', wh.id)
    if (error) { toast.error('لا يمكن الحذف: ' + error.message); return }
    toast.success('تم الحذف')
    loadData()
  }

  const generalWhs  = warehouses.filter(w => w.wh_category !== 'مشاريع')
  const projectWhs  = warehouses.filter(w => w.wh_category === 'مشاريع')

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* العنوان */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Warehouse style={{ width: '22px', height: '22px', color: '#7c3aed' }} /> المستودعات
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>
            {warehouses.length} مستودع — {generalWhs.length} عام، {projectWhs.length} مشاريع
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditWh(undefined); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '15px', height: '15px' }} /> مستودع جديد
          </button>
        )}
      </div>

      {/* مستودعات المشاريع */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ height: '1px', flex: 1, background: '#99f6e4' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '20px' }}>
            <FolderOpen style={{ width: '16px', height: '16px', color: '#0f766e' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f766e' }}>مستودعات المشاريع (العهدة)</span>
          </div>
          <div style={{ height: '1px', flex: 1, background: '#99f6e4' }} />
        </div>

        {/* بطاقة توضيح */}
        <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '12px', padding: '14px 18px', marginBottom: '14px', fontSize: '0.82rem', color: '#0f766e' }}>
          <div style={{ fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info style={{ width: '15px', height: '15px' }} /> كيف تعمل مستودعات المشاريع؟
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px' }}>
            {WH_CATEGORY_INFO.مشاريع.points.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1rem' }}>{['📥','📤','↩️','📋'][i]}</span>
                <span style={{ lineHeight: 1.4 }}>{p}</span>
              </div>
            ))}
          </div>
        </div>

        {projectWhs.length === 0 ? (
          <div style={{ background: 'var(--card-bg, white)', border: '2px dashed #99f6e4', borderRadius: '14px', padding: '40px', textAlign: 'center', color: '#0f766e' }}>
            <FolderOpen style={{ width: '40px', height: '40px', margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px' }}>لا توجد مستودعات مشاريع</div>
            {canEdit && (
              <button onClick={() => { setEditWh(undefined); setShowModal(true) }} className="btn btn-primary" style={{ background: '#0f766e', fontSize: '0.82rem' }}>
                <Plus style={{ width: '14px', height: '14px' }} /> إنشاء مستودع مشاريع
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {projectWhs.map(wh => (
              <WarehouseCard key={wh.id} wh={wh} stats={stats[wh.id] || { total: 0, low: 0 }} canEdit={canEdit}
                onEdit={() => { setEditWh(wh); setShowModal(true) }}
                onDelete={() => handleDelete(wh)} />
            ))}
          </div>
        )}
      </div>

      {/* مستودعات عامة */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ height: '1px', flex: 1, background: '#bfdbfe' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '20px' }}>
            <Warehouse style={{ width: '16px', height: '16px', color: '#1a56db' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1a56db' }}>المستودعات العامة</span>
          </div>
          <div style={{ height: '1px', flex: 1, background: '#bfdbfe' }} />
        </div>

        {/* بطاقة توضيح */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px 18px', marginBottom: '14px', fontSize: '0.82rem', color: '#1a56db' }}>
          <div style={{ fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info style={{ width: '15px', height: '15px' }} /> كيف تعمل المستودعات العامة؟
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px' }}>
            {WH_CATEGORY_INFO.عام.points.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1rem' }}>{['📥','📤','↩️','🔄'][i]}</span>
                <span style={{ lineHeight: 1.4 }}>{p}</span>
              </div>
            ))}
          </div>
        </div>

        {generalWhs.length === 0 ? (
          <div style={{ background: 'var(--card-bg, white)', border: '2px dashed #bfdbfe', borderRadius: '14px', padding: '40px', textAlign: 'center', color: '#1a56db' }}>
            <Warehouse style={{ width: '40px', height: '40px', margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px' }}>لا توجد مستودعات عامة</div>
            {canEdit && (
              <button onClick={() => { setEditWh(undefined); setShowModal(true) }} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
                <Plus style={{ width: '14px', height: '14px' }} /> إنشاء مستودع عام
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {generalWhs.map(wh => (
              <WarehouseCard key={wh.id} wh={wh} stats={stats[wh.id] || { total: 0, low: 0 }} canEdit={canEdit}
                onEdit={() => { setEditWh(wh); setShowModal(true) }}
                onDelete={() => handleDelete(wh)} />
            ))}
          </div>
        )}
      </div>

      {showModal && tenant && activeBranch && (
        <WarehouseModal
          wh={editWh}
          tenantId={tenant.id}
          branchId={activeBranch.id}
          onClose={() => { setShowModal(false); setEditWh(undefined) }}
          onSave={loadData}
        />
      )}

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
