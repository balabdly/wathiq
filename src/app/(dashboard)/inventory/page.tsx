'use client'
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  Plus, X, Save, Search, Pencil, Trash2, Download, Upload,
  ArrowDownToLine, ArrowUpFromLine, RotateCcw, ArrowLeftRight,
  ClipboardList, Package, Settings, BarChart3, Scale, FileSpreadsheet,
  ChevronLeft, ChevronRight, Filter
} from 'lucide-react'
import toast from 'react-hot-toast'

// ════════════════════════════════════
// Types
// ════════════════════════════════════
type Warehouse = {
  id: number; name: string; location?: string
  capacity?: string; sections?: string[]; tenant_id: string
  mode?: 'عام' | 'مشاريع' | 'مرن'
}
type Material = {
  id: number; warehouse_id: number; catalog_no?: string
  sec_number?: string; name: string; unit: string
  qty: number; reorder: number; source?: string
  location?: string; notes?: string; project_name?: string
  warehouse?: { name: string }
}
type LedgerEntry = {
  id: number; type: string; mat_name: string; unit: string
  qty: number; qty_before: number; qty_after: number
  wh_name: string; project_name?: string; dispatch_note?: string
  vendor_name?: string; doc_code?: string; created_at: string
}

const UNITS = ['قطعة', 'متر', 'كجم', 'لتر', 'علبة', 'رول', 'طن', 'م²', 'م³', 'كيس', 'برميل', 'أمبير', 'متر كيبل']
const PAGE_SIZE = 50

// ════════════════════════════════════
// مودال: إعداد المستودع
// ════════════════════════════════════
function WarehouseSetupModal({ tenantId, branchId, onClose, onSave }: {
  tenantId: string; branchId: number; onClose: () => void; onSave: () => void
}) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading]       = useState(true)
  const [editId, setEditId]         = useState<number | null>(null)
  const [form, setForm]             = useState({ name: '', location: '', capacity: '', sections: '', mode: 'عام' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('warehouses').select('*')
      .eq('tenant_id', tenantId).order('name')
    setWarehouses(data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم المستودع مطلوب'); return }
    const sections = form.sections ? form.sections.split('،').map(s => s.trim()).filter(Boolean) : []
    const payload  = { tenant_id: tenantId, branch_id: branchId, name: form.name.trim(), location: form.location || null, capacity: form.capacity || null, sections, mode: form.mode }
    if (editId) {
      await supabase.from('warehouses').update(payload).eq('id', editId)
      toast.success('تم التعديل ✅')
    } else {
      await supabase.from('warehouses').insert(payload)
      toast.success('تم إضافة المستودع ✅')
    }
    setForm({ name: '', location: '', capacity: '', sections: '' })
    setEditId(null)
    await load(); onSave()
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`حذف مستودع "${name}"؟ سيتم حذف جميع موادة.`)) return
    await supabase.from('materials').delete().eq('warehouse_id', id)
    await supabase.from('warehouses').delete().eq('id', id)
    await load(); onSave()
    toast.success('تم الحذف')
  }

  function startEdit(w: Warehouse) {
    setEditId(w.id)
    setForm({ name: w.name, location: w.location || '', capacity: w.capacity || '', sections: (w.sections || []).join('، '), mode: w.mode || 'عام' })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings style={{ width: '18px', height: '18px', color: '#1a56db' }} />
            إعداد المستودعات
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* فورم إضافة/تعديل */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text3)', marginBottom: '10px' }}>
              {editId ? '✏️ تعديل مستودع' : '➕ إضافة مستودع جديد'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>اسم المستودع *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)}
                    className="input" placeholder="مثال: المستودع الرئيسي" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>السعة</label>
                  <input value={form.capacity} onChange={e => set('capacity', e.target.value)}
                    className="input" placeholder="مثال: 500 م²" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الموقع</label>
                <input value={form.location} onChange={e => set('location', e.target.value)}
                  className="input" placeholder="مثال: الرياض — حي الصناعية" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                  نمط المستودع
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { val: 'عام',      desc: 'الاستلام للمستودع، الصرف يحدد المشروع',          color: '#6b7280', bg: '#f9fafb' },
                    { val: 'مشاريع',   desc: 'الاستلام والصرف يطلبان مشروعاً إلزامياً',        color: '#1a56db', bg: '#eff6ff' },
                    { val: 'مرن',      desc: 'تحديد المشروع اختياري في كل العمليات',            color: '#0ea77b', bg: '#ecfdf5' },
                  ].map(m => (
                    <button key={m.val} type="button" onClick={() => set('mode', m.val)}
                      style={{ flex: 1, padding: '8px 6px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', textAlign: 'center',
                        borderColor: form.mode === m.val ? m.color : 'var(--border)',
                        background: form.mode === m.val ? m.bg : 'white',
                        color: form.mode === m.val ? m.color : 'var(--text3)' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{m.val}</div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '3px', lineHeight: 1.3 }}>{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>
                  الأقسام الداخلية
                  <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.72rem', marginRight: '6px' }}>افصل بفاصلة عربية ،</span>
                </label>
                <input value={form.sections} onChange={e => set('sections', e.target.value)}
                  className="input" placeholder="مثال: قسم A، قسم B، قسم C" />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }}>
                  <Save style={{ width: '14px', height: '14px' }} />
                  {editId ? 'حفظ التعديل' : 'إضافة المستودع'}
                </button>
                {editId && (
                  <button onClick={() => { setEditId(null); setForm({ name: '', location: '', capacity: '', sections: '' }) }}
                    className="btn btn-ghost">إلغاء</button>
                )}
              </div>
            </div>
          </div>

          {/* قائمة المستودعات */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>جاري التحميل...</div>
          ) : warehouses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '0.875rem' }}>
              لا توجد مستودعات بعد
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {warehouses.map(w => (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', background: '#f9fafb', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{w.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', display: 'flex', gap: '8px', alignItems: 'center', marginTop: '3px' }}>
                      {w.location && <span>📍 {w.location}</span>}
                      {w.sections?.length ? <span>· {w.sections.length} قسم</span> : null}
                      {w.mode && (
                        <span style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 600,
                          background: w.mode === 'مشاريع' ? '#eff6ff' : w.mode === 'مرن' ? '#ecfdf5' : '#f3f4f6',
                          color: w.mode === 'مشاريع' ? '#1a56db' : w.mode === 'مرن' ? '#0ea77b' : '#6b7280' }}>
                          {w.mode}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => startEdit(w)}
                    style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280' }}>
                    <Pencil style={{ width: '13px', height: '13px' }} />
                  </button>
                  <button onClick={() => handleDelete(w.id, w.name)}
                    style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e' }}>
                    <Trash2 style={{ width: '13px', height: '13px' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-primary">تم</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════
// مودال: تعريف المواد
// ════════════════════════════════════
function MaterialsDefineModal({ tenantId, branchId, warehouses, onClose, onSave }: {
  tenantId: string; branchId: number; warehouses: Warehouse[]
  onClose: () => void; onSave: () => void
}) {
  const [tab, setTab]           = useState<'manual' | 'import'>('manual')
  const [saving, setSaving]     = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    catalog_no: '', sec_number: '', name: '', unit: 'قطعة',
    qty: '0', reorder: '5', warehouse_id: warehouses[0]?.id ? String(warehouses[0].id) : '',
    source: 'خاص', location: '', notes: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSaveManual() {
    if (!form.name.trim())     { toast.error('اسم المادة مطلوب'); return }
    if (!form.warehouse_id)    { toast.error('اختر المستودع'); return }
    setSaving(true)
    const { error } = await supabase.from('materials').insert({
      tenant_id: tenantId, branch_id: branchId,
      warehouse_id: Number(form.warehouse_id),
      catalog_no: form.catalog_no || null,
      sec_number: form.sec_number || null,
      name: form.name.trim(), unit: form.unit,
      qty: Number(form.qty), reorder: Number(form.reorder),
      source: form.source,
      location: form.location || null,
      notes: form.notes || null,
    })
    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    toast.success('✅ تمت إضافة المادة')
    setForm({ catalog_no: '', sec_number: '', name: '', unit: 'قطعة', qty: '0', reorder: '5', warehouse_id: form.warehouse_id, source: 'خاص', location: '', notes: '' })
    onSave()
    setSaving(false)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !form.warehouse_id) { toast.error('اختر المستودع أولاً'); return }
    setImporting(true)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws)
      if (rows.length === 0) { toast.error('الملف فارغ'); setImporting(false); return }

      const payload = rows.map(r => ({
        tenant_id: tenantId, branch_id: branchId,
        warehouse_id: Number(form.warehouse_id),
        catalog_no: String(r['رقم الكتالوج'] || r['catalog_no'] || ''),
        sec_number: String(r['SEC Number'] || r['sec_number'] || '') || null,
        name: String(r['اسم المادة'] || r['name'] || ''),
        unit: String(r['الوحدة'] || r['unit'] || 'قطعة'),
        qty: Number(r['الكمية'] || r['qty'] || 0),
        reorder: Number(r['حد الأمان'] || r['reorder'] || 5),
        source: String(r['المصدر'] || r['source'] || 'خاص'),
        location: String(r['الموقع'] || r['location'] || '') || null,
        notes: String(r['ملاحظات'] || r['notes'] || '') || null,
      })).filter(r => r.name)

      if (payload.length === 0) { toast.error('لا توجد بيانات صالحة في الملف'); setImporting(false); return }

      const { error } = await supabase.from('materials').insert(payload)
      if (error) { toast.error('خطأ في الاستيراد: ' + error.message); setImporting(false); return }
      toast.success(`✅ تم استيراد ${payload.length} مادة`)
      onSave()
    } catch (err) {
      toast.error('خطأ في قراءة الملف')
    }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function downloadTemplate() {
    const headers = ['رقم الكتالوج', 'SEC Number', 'اسم المادة', 'الوحدة', 'الكمية', 'حد الأمان', 'المصدر', 'الموقع', 'ملاحظات']
    const example = ['CAT-001', 'SEC-123', 'كيبل نحاس 16مم', 'متر', '100', '20', 'خاص', 'رف A1', '']
    const csv = [headers.join(','), example.join(',')].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'template-materials.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package style={{ width: '18px', height: '18px', color: '#0ea77b' }} />
            تعريف المواد
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* تبويبات */}
          <div style={{ display: 'flex', gap: '6px', background: '#f3f4f6', padding: '4px', borderRadius: '8px' }}>
            {[
              { id: 'manual', label: '✏️ إدخال يدوي' },
              { id: 'import', label: '📄 رفع ملف Excel' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                style={{ flex: 1, padding: '7px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                  background: tab === t.id ? 'white' : 'transparent',
                  color: tab === t.id ? '#1a56db' : 'var(--text3)',
                  boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* اختيار المستودع (مشترك) */}
          <div>
            <label style={lbl}>المستودع <span style={{ color: '#c81e1e' }}>*</span></label>
            <select value={form.warehouse_id} onChange={e => set('warehouse_id', e.target.value)} className="select">
              <option value="">— اختر المستودع —</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          {/* الإدخال اليدوي */}
          {tab === 'manual' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={lbl}>رقم الكتالوج</label>
                  <input value={form.catalog_no} onChange={e => set('catalog_no', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    className="input" dir="ltr" placeholder="CAT-001" />
                </div>
                <div>
                  <label style={lbl}>SEC Number</label>
                  <input value={form.sec_number} onChange={e => set('sec_number', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    className="input" dir="ltr" placeholder="اختياري" />
                </div>
              </div>
              <div>
                <label style={lbl}>اسم المادة <span style={{ color: '#c81e1e' }}>*</span></label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                  className="input" placeholder="وصف المادة" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={lbl}>الوحدة</label>
                  <select value={form.unit} onChange={e => set('unit', e.target.value)} className="select">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>الكمية الابتدائية</label>
                  <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    className="input" dir="ltr" min="0" />
                </div>
                <div>
                  <label style={lbl}>حد الأمان</label>
                  <input type="number" value={form.reorder} onChange={e => set('reorder', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    className="input" dir="ltr" min="0" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={lbl}>الموقع الداخلي</label>
                  <input value={form.location} onChange={e => set('location', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    className="input" placeholder="رف A-3" />
                </div>
                <div>
                  <label style={lbl}>المصدر</label>
                  <select value={form.source} onChange={e => set('source', e.target.value)} className="select">
                    <option value="خاص">خاص</option>
                    <option value="كهرباء">كهرباء</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* رفع ملف */}
          {tab === 'import' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={downloadTemplate}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, width: 'fit-content' }}>
                <Download style={{ width: '15px', height: '15px' }} />
                تحميل Template الاستيراد (CSV)
              </button>
              <div style={{ background: '#fffbeb', borderRadius: '10px', padding: '12px', border: '1px solid #fde68a', fontSize: '0.8rem', color: '#92400e' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>📋 أعمدة الملف المطلوبة:</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['رقم الكتالوج', 'SEC Number', 'اسم المادة', 'الوحدة', 'الكمية', 'حد الأمان', 'المصدر', 'الموقع', 'ملاحظات'].map(col => (
                    <span key={col} style={{ padding: '2px 8px', background: 'white', borderRadius: '4px', border: '1px solid #fde68a', fontSize: '0.75rem' }}>{col}</span>
                  ))}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px', borderRadius: '10px', border: '2px dashed #d1d5db', cursor: 'pointer', background: '#fafafa', justifyContent: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} style={{ display: 'none' }} />
                <FileSpreadsheet style={{ width: '24px', height: '24px', color: '#0ea77b' }} />
                {importing ? 'جاري الاستيراد...' : 'اختر ملف Excel أو CSV'}
              </label>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إغلاق</button>
          {tab === 'manual' && (
            <button onClick={handleSaveManual} disabled={saving} className="btn btn-primary" style={{ background: '#0ea77b' }}>
              {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '14px', height: '14px' }} />}
              إضافة المادة
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════
// مودال: عملية (استلام/صرف/إرجاع/تحويل)
// ════════════════════════════════════
function OperationModal({ type, tenantId, branchId, warehouses, projects, onClose, onSave }: {
  type: 'استلام' | 'صرف' | 'إرجاع' | 'تحويل'
  tenantId: string; branchId: number
  warehouses: Warehouse[]; projects: any[]
  onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving]     = useState(false)
  const [materials, setMaterials] = useState<Material[]>([])
  const [rows, setRows]         = useState([{ mat_id: '', qty: '', note: '' }])
  const [form, setForm]         = useState({
    warehouse_id:    warehouses[0]?.id ? String(warehouses[0].id) : '',
    to_warehouse_id: '',
    project_name:    '',
    vendor_name:     '',
    doc_code:        '',
    date:            new Date().toISOString().split('T')[0],
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { if (form.warehouse_id) loadMaterials() }, [form.warehouse_id])

  async function loadMaterials() {
    const { data } = await supabase.from('materials')
      .select('*').eq('tenant_id', tenantId).eq('warehouse_id', Number(form.warehouse_id)).order('name')
    setMaterials(data || [])
  }

  function setRow(i: number, k: string, v: string) {
    setRows(prev => { const next = [...prev]; next[i] = { ...next[i], [k]: v }; return next })
  }

  async function handleSave() {
    const validRows = rows.filter(r => r.mat_id && Number(r.qty) > 0)
    if (validRows.length === 0) { toast.error('أضف مادة واحدة على الأقل بكمية صحيحة'); return }
    if ((type === 'صرف' || type === 'إرجاع') && !form.project_name) { toast.error('اسم المشروع مطلوب'); return }
    if (type === 'استلام' && projectRequiredOnReceive && !form.project_name) { toast.error('المشروع إلزامي لهذا المستودع'); return }
    if (type === 'تحويل' && !form.to_warehouse_id) { toast.error('اختر المستودع المستلم'); return }
    setSaving(true)

    const wh = warehouses.find(w => w.id === Number(form.warehouse_id))

    for (const row of validRows) {
      const mat = materials.find(m => m.id === Number(row.mat_id))
      if (!mat) continue
      const qty = Number(row.qty)

      if ((type === 'صرف' || type === 'تحويل') && mat.qty < qty) {
        toast.error(`رصيد "${mat.name}" غير كافٍ — متاح: ${mat.qty} ${mat.unit}`)
        setSaving(false); return
      }

      let newQty = mat.qty
      if (type === 'استلام') newQty = mat.qty + qty
      if (type === 'صرف'  || type === 'تحويل') newQty = mat.qty - qty
      if (type === 'إرجاع') newQty = mat.qty + qty

      // تحديث الكمية
      await supabase.from('materials').update({ qty: newQty }).eq('id', mat.id)

      // تسجيل في سجل الحركات
      await supabase.from('stock_ledger').insert({
        tenant_id: tenantId, branch_id: branchId,
        type: type === 'تحويل' ? 'نقل مخزني' : type,
        mat_name: mat.name, unit: mat.unit, qty,
        qty_before: mat.qty, qty_after: newQty,
        wh_name: wh?.name || '',
        project_name: form.project_name || null,
        vendor_name: form.vendor_name || null,
        doc_code: form.doc_code || null,
        dispatch_note: row.note || null,
      })

      // لو تحويل — أضف في المستودع المستلم
      if (type === 'تحويل') {
        const toWh = warehouses.find(w => w.id === Number(form.to_warehouse_id))
        const { data: existing } = await supabase.from('materials')
          .select('*').eq('tenant_id', tenantId).eq('warehouse_id', Number(form.to_warehouse_id)).eq('name', mat.name).single()
        if (existing) {
          await supabase.from('materials').update({ qty: existing.qty + qty }).eq('id', existing.id)
        } else {
          const { id: _id, ...rest } = mat as any
          await supabase.from('materials').insert({ ...rest, warehouse_id: Number(form.to_warehouse_id), qty })
        }
        await supabase.from('stock_ledger').insert({
          tenant_id: tenantId, branch_id: branchId, type: 'توريد',
          mat_name: mat.name, unit: mat.unit, qty,
          qty_before: existing?.qty || 0, qty_after: (existing?.qty || 0) + qty,
          wh_name: toWh?.name || '',
          dispatch_note: `تحويل من ${wh?.name}`,
        })
      }
    }

    toast.success(`✅ تمت عملية ${type} بنجاح`)
    onSave(); setSaving(false)
  }

  const COLORS: Record<string, { color: string; bg: string }> = {
    'استلام': { color: '#0ea77b', bg: '#ecfdf5' },
    'صرف':    { color: '#c81e1e', bg: '#fef2f2' },
    'إرجاع':  { color: '#e6820a', bg: '#fffbeb' },
    'تحويل':  { color: '#1a56db', bg: '#eff6ff' },
  }
  const tc = COLORS[type]
  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '620px', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: tc.bg, borderRadius: '10px 10px 0 0', margin: '-1px -1px 0' }}>
          <h3 style={{ fontWeight: 700, color: tc.color, fontSize: '1rem' }}>
            {type === 'استلام' ? '📥' : type === 'صرف' ? '📤' : type === 'إرجاع' ? '↩️' : '🔄'} {type} مواد
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tc.color }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* المستودع */}
          <div style={{ display: 'grid', gridTemplateColumns: type === 'تحويل' ? '1fr 1fr' : '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>{type === 'تحويل' ? 'المستودع المرسل' : 'المستودع'} *</label>
              <select value={form.warehouse_id} onChange={e => set('warehouse_id', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            {type === 'تحويل' ? (
              <div>
                <label style={lbl}>المستودع المستلم *</label>
                <select value={form.to_warehouse_id} onChange={e => set('to_warehouse_id', e.target.value)} className="select">
                  <option value="">— اختر —</option>
                  {warehouses.filter(w => w.id !== Number(form.warehouse_id)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            ) : (type === 'صرف' || type === 'إرجاع') ? (
              <div>
                <label style={lbl}>المشروع *</label>
                <select value={form.project_name} onChange={e => set('project_name', e.target.value)} className="select">
                  <option value="">— اختر المشروع —</option>
                  {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label style={lbl}>المورد / رقم الوثيقة</label>
                <input value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)}
                  className="input" placeholder="اسم المورد أو رقم الإذن" />
              </div>
            )}
          </div>

          {/* حقل المشروع للاستلام حسب نمط المستودع */}
          {type === 'استلام' && showProjectOnReceive && (
            <div>
              <label style={lbl}>
                المشروع {projectRequiredOnReceive && <span style={{ color: '#c81e1e' }}>*</span>}
                {!projectRequiredOnReceive && <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 400 }}> (اختياري)</span>}
              </label>
              <select value={form.project_name} onChange={e => set('project_name', e.target.value)} className="select">
                <option value="">— اختر المشروع —</option>
                {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              {whMode === 'مشاريع' && (
                <div style={{ marginTop: '5px', fontSize: '0.72rem', color: '#1a56db' }}>
                  🏗️ هذا المستودع مخصص للمشاريع — تحديد المشروع إلزامي
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'none' }}>
          </div>

          {/* المواد */}
          <div>
            <label style={{ ...lbl, marginBottom: '8px' }}>المواد</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {rows.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '6px', alignItems: 'center' }}>
                  <select value={row.mat_id} onChange={e => setRow(i, 'mat_id', e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
                    <option value="">— اختر مادة —</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} {type !== 'استلام' ? `(${m.qty} ${m.unit})` : ''}
                      </option>
                    ))}
                  </select>
                  <input type="number" value={row.qty} onChange={e => setRow(i, 'qty', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    className="input" dir="ltr" min="0" placeholder="الكمية" style={{ fontSize: '0.82rem' }} />
                  <input value={row.note} onChange={e => setRow(i, 'note', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    className="input" placeholder="ملاحظة" style={{ fontSize: '0.78rem' }} />
                  <button onClick={() => setRows(prev => prev.filter((_, j) => j !== i))}
                    style={{ padding: '6px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e', display: rows.length === 1 ? 'none' : 'flex' }}>
                    <X style={{ width: '13px', height: '13px' }} />
                  </button>
                </div>
              ))}
              <button onClick={() => setRows(prev => [...prev, { mat_id: '', qty: '', note: '' }])}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '7px', border: `1px dashed ${tc.color}`, background: tc.bg, color: tc.color, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, width: 'fit-content' }}>
                <Plus style={{ width: '13px', height: '13px' }} /> إضافة مادة أخرى
              </button>
            </div>
          </div>

        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: tc.color }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : null}
            تأكيد {type}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════
export default function InventoryPage() {
  const { tenant, activeBranch } = useStore()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [projects,   setProjects]   = useState<any[]>([])

  // المودالات
  const [modal, setModal] = useState<'setup' | 'define' | 'materials' | 'ledger' | 'inventory_check' | 'settlement' | 'استلام' | 'صرف' | 'إرجاع' | 'تحويل' | null>(null)

  // عرض المواد
  const [materials,     setMaterials]     = useState<Material[]>([])
  const [matTotal,      setMatTotal]      = useState(0)
  const [matPage,       setMatPage]       = useState(1)
  const [matSearch,     setMatSearch]     = useState('')
  const [matWh,         setMatWh]         = useState('')
  const [matQtyFilter,  setMatQtyFilter]  = useState<'all' | 'with' | 'without'>('all')
  const [matLoading,    setMatLoading]    = useState(false)

  // الحركات
  const [ledger,        setLedger]        = useState<LedgerEntry[]>([])
  const [ledgerTotal,   setLedgerTotal]   = useState(0)
  const [ledgerPage,    setLedgerPage]    = useState(1)
  const [ledgerDate,    setLedgerDate]    = useState('')
  const [ledgerMat,     setLedgerMat]     = useState('')
  const [ledgerType,    setLedgerType]    = useState('')
  const [ledgerLoading, setLedgerLoading] = useState(false)

  // الجرد
  const [checkItems,    setCheckItems]    = useState<any[]>([])
  const [checkWh,       setCheckWh]       = useState('')

  useEffect(() => { if (tenant) loadBase() }, [tenant?.id])

  async function loadBase() {
    if (!tenant) return
    const [whRes, projRes] = await Promise.all([
      supabase.from('warehouses').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('projects').select('id, name').eq('tenant_id', tenant.id).order('name'),
    ])
    setWarehouses(whRes.data || [])
    setProjects(projRes.data || [])
  }

  async function loadMaterials(page = 1) {
    if (!tenant) return
    setMatLoading(true)
    const from = (page - 1) * PAGE_SIZE
    let q = supabase.from('materials')
      .select('*, warehouse:warehouses(name)', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .order('name').range(from, from + PAGE_SIZE - 1)

    if (matWh)     q = q.eq('warehouse_id', Number(matWh))
    if (matSearch) q = q.or(`name.ilike.%${matSearch}%,catalog_no.ilike.%${matSearch}%,sec_number.ilike.%${matSearch}%`)
    if (matQtyFilter === 'with')    q = q.gt('qty', 0)
    if (matQtyFilter === 'without') q = q.lte('qty', 0)

    const { data, count } = await q
    setMaterials(data || [])
    setMatTotal(count || 0)
    setMatPage(page)
    setMatLoading(false)
  }

  async function loadLedger(page = 1) {
    if (!tenant) return
    setLedgerLoading(true)
    const from = (page - 1) * PAGE_SIZE
    let q = supabase.from('stock_ledger')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (ledgerDate) q = q.gte('created_at', ledgerDate).lte('created_at', ledgerDate + 'T23:59:59')
    if (ledgerMat)  q = q.ilike('mat_name', `%${ledgerMat}%`)
    if (ledgerType) q = q.eq('type', ledgerType)

    const { data, count } = await q
    setLedger(data || [])
    setLedgerTotal(count || 0)
    setLedgerPage(page)
    setLedgerLoading(false)
  }

  async function loadInventoryCheck() {
    if (!tenant || !checkWh) return
    const { data } = await supabase.from('materials')
      .select('*').eq('tenant_id', tenant.id).eq('warehouse_id', Number(checkWh)).order('name')
    setCheckItems((data || []).map(m => ({ ...m, actualQty: m.qty, systemQty: m.qty })))
  }

  async function saveInventoryCheck() {
    if (!tenant || !activeBranch) return
    const changed = checkItems.filter(i => i.actualQty !== i.systemQty)
    if (changed.length === 0) { toast.error('لا توجد فروقات للتسوية'); return }
    for (const item of changed) {
      const diff = item.actualQty - item.systemQty
      await supabase.from('materials').update({ qty: item.actualQty }).eq('id', item.id)
      await supabase.from('stock_ledger').insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: diff > 0 ? 'توريد' : 'صرف',
        mat_name: item.name, unit: item.unit,
        qty: Math.abs(diff), qty_before: item.systemQty, qty_after: item.actualQty,
        wh_name: warehouses.find(w => w.id === Number(checkWh))?.name || '',
        dispatch_note: 'تسوية جرد',
      })
    }
    toast.success(`✅ تم جرد وتسوية ${changed.length} مادة`)
    setModal(null)
  }

  const matTotalPages = Math.ceil(matTotal / PAGE_SIZE)
  const ledgerTotalPages = Math.ceil(ledgerTotal / PAGE_SIZE)

  // نمط المستودع المختار
  const selectedWh = warehouses.find(w => w.id === Number(form.warehouse_id))
  const whMode     = selectedWh?.mode || 'عام'
  // هل نُظهر حقل المشروع في الاستلام؟
  const showProjectOnReceive = whMode === 'مشاريع' || whMode === 'مرن'
  // هل المشروع إلزامي في الاستلام؟
  const projectRequiredOnReceive = whMode === 'مشاريع'

  const TYPE_COLOR: Record<string, string> = {
    'توريد':      'badge-green',
    'استلام':     'badge-green',
    'صرف':        'badge-red',
    'نقل مخزني':  'badge-blue',
    'إرجاع':      'badge-amber',
    'تسوية جرد':  'badge-purple',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100vh' }}>

      {/* ══ الجزء العلوي — الأزرار الثانوية ══ */}
      <div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package style={{ width: '20px', height: '20px', color: '#1a56db' }} />
          إدارة المخزون
        </h1>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { id: 'setup',            label: 'إعداد المستودع',      icon: Settings,       color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
            { id: 'define',           label: 'تعريف المواد',         icon: Package,        color: '#0ea77b', bg: '#ecfdf5', border: '#bbf7d0' },
            { id: 'materials',        label: 'عرض المواد',           icon: ClipboardList,  color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe' },
            { id: 'ledger',           label: 'الحركات اليومية',      icon: BarChart3,      color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
            { id: 'inventory_check',  label: 'جرد المستودع',        icon: Scale,          color: '#e6820a', bg: '#fffbeb', border: '#fde68a' },
          ].map(btn => (
            <button key={btn.id} onClick={() => {
              setModal(btn.id as any)
              if (btn.id === 'materials')  loadMaterials(1)
              if (btn.id === 'ledger')     loadLedger(1)
            }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', border: `1px solid ${btn.border}`, background: btn.bg, color: btn.color, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
              <btn.icon style={{ width: '16px', height: '16px' }} />
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ الجزء السفلي — الأزرار الرئيسية (نصف الصفحة) ══ */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '16px', minHeight: '360px' }}>
        {[
          { type: 'استلام', icon: ArrowDownToLine, color: '#0ea77b', bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '#86efac', desc: 'استلام مواد جديدة للمستودع' },
          { type: 'صرف',    icon: ArrowUpFromLine,  color: '#c81e1e', bg: 'linear-gradient(135deg, #fef2f2, #fecaca)', border: '#fca5a5', desc: 'صرف مواد لمشروع أو جهة' },
          { type: 'إرجاع',  icon: RotateCcw,        color: '#e6820a', bg: 'linear-gradient(135deg, #fffbeb, #fde68a)', border: '#fcd34d', desc: 'إرجاع مواد من المشروع للمستودع' },
          { type: 'تحويل',  icon: ArrowLeftRight,   color: '#1a56db', bg: 'linear-gradient(135deg, #eff6ff, #bfdbfe)', border: '#93c5fd', desc: 'نقل مواد بين المستودعات' },
        ].map(btn => (
          <button key={btn.type}
            onClick={() => setModal(btn.type as any)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px',
              padding: '24px', borderRadius: '16px', border: `2px solid ${btn.border}`,
              background: btn.bg, color: btn.color, cursor: 'pointer',
              transition: 'all 0.2s', fontWeight: 700,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${btn.color}30` }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '' }}>
            <btn.icon style={{ width: '36px', height: '36px', color: btn.color }} />
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: btn.color }}>{btn.type}</div>
            <div style={{ fontSize: '0.78rem', color: btn.color, opacity: 0.7, textAlign: 'center' }}>{btn.desc}</div>
          </button>
        ))}
      </div>

      {/* ══ مودال: إعداد المستودع ══ */}
      {modal === 'setup' && tenant && activeBranch && (
        <WarehouseSetupModal tenantId={tenant.id} branchId={activeBranch.id}
          onClose={() => setModal(null)} onSave={() => { loadBase() }} />
      )}

      {/* ══ مودال: تعريف المواد ══ */}
      {modal === 'define' && tenant && activeBranch && (
        <MaterialsDefineModal tenantId={tenant.id} branchId={activeBranch.id} warehouses={warehouses}
          onClose={() => setModal(null)} onSave={() => {}} />
      )}

      {/* ══ مودال: عرض المواد ══ */}
      {modal === 'materials' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-box" style={{ maxWidth: '900px', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList style={{ width: '18px', height: '18px', color: '#1a56db' }} />
                عرض المواد
                {matTotal > 0 && <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 400 }}>({matTotal.toLocaleString()} مادة)</span>}
              </h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9ca3af' }} />
                <input value={matSearch} onChange={e => setMatSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadMaterials(1)}
                  placeholder="بحث باسم أو رقم كتالوج أو SEC..." className="input"
                  style={{ paddingRight: '30px', width: '250px', fontSize: '0.82rem' }} />
              </div>
              <select value={matWh} onChange={e => setMatWh(e.target.value)} className="select" style={{ width: 'auto', fontSize: '0.82rem' }}>
                <option value="">كل المستودعات</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select value={matQtyFilter} onChange={e => setMatQtyFilter(e.target.value as any)} className="select" style={{ width: 'auto', fontSize: '0.82rem' }}>
                <option value="all">كل المواد</option>
                <option value="with">لها كميات</option>
                <option value="without">بدون كمية</option>
              </select>
              <button onClick={() => loadMaterials(1)} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '7px 14px' }}>
                <Filter style={{ width: '13px', height: '13px' }} /> بحث
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {matLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <div style={{ width: '24px', height: '24px', border: '3px solid var(--border)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', position: 'sticky', top: 0 }}>
                      {['رقم الكتالوج', 'SEC', 'اسم المادة', 'المستودع', 'الوحدة', 'الكمية', 'حد الأمان', 'الحالة'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {materials.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد نتائج</td></tr>
                    ) : materials.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#1a56db' }}>{m.catalog_no || '—'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#9ca3af' }}>{(m as any).sec_number || '—'}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text3)' }}>{(m as any).warehouse?.name || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem' }}>{m.unit}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: m.qty <= 0 ? '#c81e1e' : m.qty <= m.reorder ? '#e6820a' : '#0ea77b' }}>
                          {m.qty}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem', color: '#9ca3af' }}>{m.reorder}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span className={`badge ${m.qty <= 0 ? 'badge-red' : m.qty <= m.reorder ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: '0.68rem' }}>
                            {m.qty <= 0 ? 'نفدت' : m.qty <= m.reorder ? 'منخفض' : 'طبيعي'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {/* Pagination */}
            {matTotalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                  {((matPage - 1) * PAGE_SIZE) + 1} — {Math.min(matPage * PAGE_SIZE, matTotal)} من {matTotal.toLocaleString()}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => loadMaterials(matPage - 1)} disabled={matPage === 1}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: matPage === 1 ? 'not-allowed' : 'pointer', opacity: matPage === 1 ? 0.4 : 1 }}>
                    <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                  <span style={{ padding: '5px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{matPage} / {matTotalPages}</span>
                  <button onClick={() => loadMaterials(matPage + 1)} disabled={matPage === matTotalPages}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: matPage === matTotalPages ? 'not-allowed' : 'pointer', opacity: matPage === matTotalPages ? 0.4 : 1 }}>
                    <ChevronLeft style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ مودال: الحركات اليومية ══ */}
      {modal === 'ledger' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-box" style={{ maxWidth: '900px', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 style={{ width: '18px', height: '18px', color: '#7c3aed' }} />
                الحركات اليومية
              </h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
            {/* فلاتر */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#9ca3af', marginBottom: '3px' }}>التاريخ</label>
                <input type="date" value={ledgerDate} onChange={e => setLedgerDate(e.target.value)}
                  className="input" style={{ fontSize: '0.82rem', padding: '6px 10px' }} />
              </div>
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#9ca3af', marginBottom: '3px' }}>اسم المادة</label>
                <input value={ledgerMat} onChange={e => setLedgerMat(e.target.value)}
                  placeholder="بحث..." className="input" style={{ fontSize: '0.82rem', padding: '6px 10px', width: '160px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#9ca3af', marginBottom: '3px' }}>نوع الحركة</label>
                <select value={ledgerType} onChange={e => setLedgerType(e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
                  <option value="">الكل</option>
                  {['توريد', 'استلام', 'صرف', 'إرجاع', 'نقل مخزني', 'تسوية جرد'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ paddingTop: '18px' }}>
                <button onClick={() => loadLedger(1)} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.82rem', background: '#7c3aed' }}>
                  <Filter style={{ width: '13px', height: '13px' }} /> تطبيق
                </button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {ledgerLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <div style={{ width: '24px', height: '24px', border: '3px solid var(--border)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', position: 'sticky', top: 0 }}>
                      {['التاريخ', 'النوع', 'المادة', 'المستودع', 'المشروع', 'الكمية', 'قبل', 'بعد', 'ملاحظة'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.length === 0 ? (
                      <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد حركات</td></tr>
                    ) : ledger.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '8px 12px', fontSize: '0.72rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                          {l.created_at ? new Date(l.created_at).toLocaleDateString('ar-SA') : '—'}
                          <div style={{ fontSize: '0.65rem' }}>{l.created_at ? new Date(l.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span className={`badge ${TYPE_COLOR[l.type] || 'badge-gray'}`} style={{ fontSize: '0.68rem' }}>{l.type}</span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 500, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.mat_name}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text3)' }}>{l.wh_name || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem', color: '#1a56db' }}>{l.project_name || '—'}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: ['صرف', 'نقل مخزني'].includes(l.type) ? '#c81e1e' : '#0ea77b' }}>
                          {['صرف', 'نقل مخزني'].includes(l.type) ? '-' : '+'}{l.qty} {l.unit}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem', color: '#9ca3af', direction: 'ltr' }}>{l.qty_before}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 600, direction: 'ltr' }}>{l.qty_after}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.72rem', color: 'var(--text3)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.dispatch_note || l.vendor_name || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {/* Pagination */}
            {ledgerTotalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                  {((ledgerPage - 1) * PAGE_SIZE) + 1} — {Math.min(ledgerPage * PAGE_SIZE, ledgerTotal)} من {ledgerTotal.toLocaleString()}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => loadLedger(ledgerPage - 1)} disabled={ledgerPage === 1}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: ledgerPage === 1 ? 'not-allowed' : 'pointer', opacity: ledgerPage === 1 ? 0.4 : 1 }}>
                    <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                  <span style={{ padding: '5px 12px', fontSize: '0.78rem', color: 'var(--text3)' }}>{ledgerPage} / {ledgerTotalPages}</span>
                  <button onClick={() => loadLedger(ledgerPage + 1)} disabled={ledgerPage === ledgerTotalPages}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: ledgerPage === ledgerTotalPages ? 'not-allowed' : 'pointer', opacity: ledgerPage === ledgerTotalPages ? 0.4 : 1 }}>
                    <ChevronLeft style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ مودال: جرد المستودع ══ */}
      {modal === 'inventory_check' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale style={{ width: '18px', height: '18px', color: '#e6820a' }} />
                جرد المستودع
              </h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>اختر المستودع</label>
                  <select value={checkWh} onChange={e => setCheckWh(e.target.value)} className="select">
                    <option value="">— اختر المستودع —</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <button onClick={loadInventoryCheck} disabled={!checkWh} className="btn btn-primary" style={{ background: '#e6820a', whiteSpace: 'nowrap' }}>
                  تحميل المواد
                </button>
              </div>

              {checkItems.length > 0 && (
                <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
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
                              <input type="number" value={item.actualQty}
                                onChange={e => setCheckItems(prev => prev.map((ci, j) => j === i ? { ...ci, actualQty: Number(e.target.value) } : ci))}
                                onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                                style={{ width: '80px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.82rem', textAlign: 'center' }}
                                min="0" dir="ltr" />
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
              )}

              {checkItems.length > 0 && (
                <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.82rem', color: '#92400e', border: '1px solid #fde68a' }}>
                  🔔 الخلايا الصفراء تعني وجود فروقات — عدّل الكمية الفعلية ثم اضغط "حفظ الجرد"
                </div>
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

      {/* ══ مودال: العمليات الرئيسية ══ */}
      {(['استلام', 'صرف', 'إرجاع', 'تحويل'] as const).map(type => (
        modal === type && tenant && activeBranch && (
          <OperationModal key={type} type={type}
            tenantId={tenant.id} branchId={activeBranch.id}
            warehouses={warehouses} projects={projects}
            onClose={() => setModal(null)}
            onSave={() => { setModal(null); if (modal === 'materials') loadMaterials(matPage) }} />
        )
      ))}
    </div>
  )
}
