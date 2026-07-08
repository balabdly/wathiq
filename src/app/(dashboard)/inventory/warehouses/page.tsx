'use client'
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  FileSpreadsheet, FolderOpen, Info, Package, Pencil, Plus, Save, Search, Trash2, Upload, Warehouse, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { UNITS, type Material } from '../materials/opsShared'

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
// مودال: تعريف مادة
// ══════════════════════════════════════════
function MaterialDefineModal({ tenantId, branchId, warehouses, onClose, onSave }: {
  tenantId: string; branchId: number; warehouses: WH[]
  onClose: () => void; onSave: () => void
}) {
  const [tab,     setTab]     = useState<'manual' | 'import'>('manual')
  const [saving,  setSaving]  = useState(false)
  const [form, setForm] = useState({
    warehouse_id: warehouses[0]?.id ? String(warehouses[0].id) : '',
    name: '', catalog_no: '', sec_number: '', mat_code: '', item_code: '',
    unit: 'قطعة', qty: '0', reorder: '0', source: 'خاص', location: '', notes: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const [importData, setImportData] = useState<any[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSave() {
    if (!form.name.trim())       { toast.error('اسم المادة مطلوب'); return }
    if (!form.warehouse_id)      { toast.error('اختر المستودع'); return }
    // مواد الكهرباء (SEC) تُعرَّف حصراً بأرقامها الرسمية — إلزامي
    if (form.source === 'كهرباء' && !String(form.sec_number || '').trim()) { toast.error('رقم SEC إلزامي لمواد الكهرباء'); return }
    if (form.source === 'كهرباء' && !String(form.catalog_no || '').trim()) { toast.error('رقم الكتالوج إلزامي لمواد الكهرباء'); return }
    setSaving(true)
    const { error } = await supabase.from('materials').insert({
      tenant_id: tenantId, branch_id: branchId,
      warehouse_id: Number(form.warehouse_id),
      name: form.name.trim(), catalog_no: form.catalog_no || null,
      sec_number: form.sec_number || null, mat_code: form.mat_code || null,
      item_code: form.item_code || null, unit: form.unit,
      qty: Number(form.qty) || 0, reorder: Number(form.reorder) || 0,
      source: form.source, location: form.location || null,
      notes: form.notes || null, is_active: true,
    })
    setSaving(false)
    if (error) {
      if (error.message.includes('materials_unique_name_per_warehouse'))
        toast.error('⛔ هذه المادة موجودة بالفعل في هذا المستودع')
      else if (error.message.includes('materials_unique_catalog_no'))
        toast.error('⛔ رقم الكتالوج مستخدم لمادة أخرى')
      else if (error.message.includes('materials_unique_sec_number'))
        toast.error('⛔ رقم SEC مستخدم لمادة أخرى')
      else
        toast.error('خطأ: ' + error.message)
      return
    }
    toast.success('تمت إضافة المادة ✅')
    onSave(); onClose()
  }

  async function handleImport() {
    if (!form.warehouse_id) { toast.error('اختر المستودع'); return }
    if (importData.length === 0) { toast.error('لا توجد بيانات للاستيراد'); return }
    setSaving(true)
    const rows = importData.map(r => ({
      tenant_id: tenantId, branch_id: branchId,
      warehouse_id: Number(form.warehouse_id),
      name: r['اسم المادة'] || r['name'] || '', unit: r['الوحدة'] || r['unit'] || 'قطعة',
      catalog_no: r['رقم الكتالوج'] || r['catalog_no'] || null,
      sec_number: r['رقم SEC'] || r['sec_number'] || null,
      qty: Number(r['الكمية'] || r['qty'] || 0), reorder: Number(r['حد الأمان'] || r['reorder'] || 0),
      source: 'خاص', is_active: true,
    })).filter(r => r.name)
    const { error } = await supabase.from('materials').insert(rows)
    setSaving(false)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success(`تم استيراد ${rows.length} مادة ✅`)
    onSave(); onClose()
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const XLSX = await import('xlsx')
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
        // تصفية الصفوف الفارغة وأسطر الملاحظات
        const valid = rows.filter(r =>
          r['اسم المادة'] && String(r['اسم المادة']).trim() &&
          !String(r['اسم المادة']).startsWith('#')
        )
        setImportData(valid)
        toast.success(`تم قراءة ${valid.length} مادة ✅`)
      } catch { toast.error('خطأ في قراءة الملف — تأكد أنه ملف Excel صحيح') }
    }
    reader.readAsArrayBuffer(file)
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const wb   = XLSX.utils.book_new()

    // ── ورقة المواد ──
    const headers = ['اسم المادة', 'الوحدة', 'المصدر', 'رقم الكتالوج', 'رقم SEC', 'الكمية', 'حد الأمان', 'الموقع في المستودع']
    const examples = [
      ['كيبل نحاسي 4×10مم', 'متر', 'خاص', 'CAT-1001', 'SEC-2001', 0, 50, 'رف A - قسم 1'],
      ['محول توزيع 100KVA', 'قطعة', 'SEC', 'CAT-1002', 'SEC-2002', 0, 2, 'رف B - قسم 2'],
      ['لوحة تحكم كهربائية', 'قطعة', 'خاص', 'CAT-1003', '', 0, 1, ''],
      ...Array(20).fill(['', 'قطعة', 'خاص', '', '', 0, 0, '']),
    ]
    const wsData = [headers, ...examples]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // عرض الأعمدة
    ws['!cols'] = [
      { wch: 30 }, { wch: 12 }, { wch: 10 },
      { wch: 16 }, { wch: 16 }, { wch: 10 },
      { wch: 12 }, { wch: 25 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'المواد')

    // ── ورقة التوضيحات ──
    const wsInfo = XLSX.utils.aoa_to_sheet([
      ['الحقل', 'إلزامي؟', 'القيم المسموحة', 'ملاحظة'],
      ['اسم المادة', 'نعم', '—', 'لا يتكرر في نفس المستودع'],
      ['الوحدة', 'نعم', 'متر / كجم / قطعة / لتر / علبة / رول / طن / م² / م³ / كيس / برميل / أمبير / متر كيبل', ''],
      ['المصدر', 'نعم', 'خاص / SEC', 'خاص = مواد الشركة | SEC = مواد العميل'],
      ['رقم الكتالوج', 'لا', '—', 'فريد على مستوى الشركة'],
      ['رقم SEC', 'لا', '—', 'فريد على مستوى الشركة'],
      ['الكمية', 'لا', 'رقم', 'الكمية الافتتاحية — 0 افتراضياً'],
      ['حد الأمان', 'لا', 'رقم', 'تنبيه عند الوصول لهذا الحد'],
      ['الموقع في المستودع', 'لا', '—', 'مثال: رف A - قسم 1'],
    ])
    wsInfo['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 55 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, wsInfo, 'تعليمات')

    XLSX.writeFile(wb, 'نموذج_استيراد_المواد.xlsx')
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>إضافة مادة للمخزون</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        {/* تبويبات */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
          {[{ id: 'manual', label: '✍️ يدوي' }, { id: 'import', label: '📊 استيراد Excel' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              style={{ flex: 1, padding: '10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                background: tab === t.id ? 'white' : 'transparent',
                color: tab === t.id ? '#1a56db' : '#9ca3af',
                borderBottom: tab === t.id ? '2px solid #1a56db' : '2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* اختيار المستودع مشترك */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>المستودع <span style={{ color: '#c81e1e' }}>*</span></label>
            <select value={form.warehouse_id} onChange={e => set('warehouse_id', e.target.value)} className="select">
              <option value="">— اختر المستودع —</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          {tab === 'manual' && (<>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>اسم المادة <span style={{ color: '#c81e1e' }}>*</span></label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: كيبل 4×10 مم" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الوحدة</label>
                <select value={form.unit} onChange={e => set('unit', e.target.value)} className="select">
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>رقم الكتالوج</label>
                <input value={form.catalog_no} onChange={e => set('catalog_no', e.target.value)} className="input" placeholder="CAT-001" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>رقم SEC</label>
                <input value={form.sec_number} onChange={e => set('sec_number', e.target.value)} className="input" placeholder="SEC-001" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>المصدر</label>
                <select value={form.source} onChange={e => set('source', e.target.value)} className="select">
                  <option value="خاص">خاص</option>
                  <option value="SEC">SEC</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الكمية الافتتاحية</label>
                <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)} className="input" min="0" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>حد الأمان</label>
                <input type="number" value={form.reorder} onChange={e => set('reorder', e.target.value)} className="input" min="0" />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الموقع في المستودع</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="مثال: رف A — قسم 3" />
            </div>
          </>)}

          {tab === 'import' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* خطوات الاستيراد */}
              <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '2px' }}>خطوات الاستيراد:</div>
                {[
                  { n: '١', text: 'حمّل النموذج', sub: 'اضغط الزر أدناه لتنزيل ملف Excel جاهز', color: '#1a56db' },
                  { n: '٢', text: 'عبّئ البيانات', sub: 'أدخل بيانات المواد في الأعمدة المحددة', color: '#0ea77b' },
                  { n: '٣', text: 'ارفع الملف', sub: 'اضغط زر الرفع واختر ملف Excel — سيُقرأ مباشرة', color: '#7c3aed' },
                ].map(s => (
                  <div key={s.n} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: s.color, color: 'white', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>{s.text}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{s.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* زر تحميل النموذج */}
              <button onClick={downloadTemplate}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '10px', border: '2px solid #bfdbfe', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', color: '#1a56db', transition: 'all 0.2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}>
                <FileSpreadsheet style={{ width: '20px', height: '20px' }} />
                📥 تحميل نموذج Excel
              </button>

              {/* رفع الملف */}
              <div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
                <button onClick={() => fileRef.current?.click()} className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed', padding: '14px' }}>
                  <Upload style={{ width: '16px', height: '16px' }} />
                  {importData.length > 0 ? `تم قراءة ${importData.length} مادة — اضغط لتغيير الملف` : 'ارفع ملف Excel (.xlsx)'}
                </button>
              </div>

              {importData.length > 0 && (
                <div style={{ background: '#ecfdf5', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 14px', fontSize: '0.82rem', color: '#0ea77b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ✅ تم قراءة {importData.length} مادة — جاهزة للاستيراد
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={tab === 'manual' ? handleSave : handleImport} disabled={saving} className="btn btn-primary">
            {saving ? 'جاري الحفظ...' : tab === 'manual' ? 'إضافة المادة' : `استيراد ${importData.length} مادة`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// مودال: تعديل مادة
// ══════════════════════════════════════════
function MaterialEditModal({ material, warehouses, onClose, onSave }: {
  material: Material; warehouses: WH[]
  onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:        material.name,
    catalog_no:  material.catalog_no  || '',
    sec_number:  material.sec_number  || '',
    mat_code:    material.mat_code    || '',
    unit:        material.unit,
    reorder:     String(material.reorder),
    source:      material.source      || 'خاص',
    location:    material.location    || '',
    notes:       material.notes       || '',
    warehouse_id: String(material.warehouse_id),
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) { toast.error('الاسم مطلوب'); return }
    if (form.source === 'كهرباء' && !String(form.sec_number || '').trim()) { toast.error('رقم SEC إلزامي لمواد الكهرباء'); return }
    if (form.source === 'كهرباء' && !String(form.catalog_no || '').trim()) { toast.error('رقم الكتالوج إلزامي لمواد الكهرباء'); return }
    setSaving(true)
    const { error } = await supabase.from('materials').update({
      name: form.name.trim(), catalog_no: form.catalog_no || null,
      sec_number: form.sec_number || null, mat_code: form.mat_code || null,
      unit: form.unit, reorder: Number(form.reorder) || 0,
      source: form.source, location: form.location || null,
      notes: form.notes || null, warehouse_id: Number(form.warehouse_id),
    }).eq('id', material.id)
    setSaving(false)
    if (error) {
      if (error.message.includes('materials_unique_name_per_warehouse'))
        toast.error('⛔ هذه المادة موجودة بالفعل في هذا المستودع')
      else if (error.message.includes('materials_unique_catalog_no'))
        toast.error('⛔ رقم الكتالوج مستخدم لمادة أخرى')
      else if (error.message.includes('materials_unique_sec_number'))
        toast.error('⛔ رقم SEC مستخدم لمادة أخرى')
      else
        toast.error('خطأ: ' + error.message)
      return
    }
    toast.success('تم التعديل ✅'); onSave(); onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>تعديل المادة — {material.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>المستودع</label>
            <select value={form.warehouse_id} onChange={e => set('warehouse_id', e.target.value)} className="select">
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الاسم <span style={{ color: '#c81e1e' }}>*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الوحدة</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)} className="select">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>رقم الكتالوج</label>
              <input value={form.catalog_no} onChange={e => set('catalog_no', e.target.value)} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>رقم SEC</label>
              <input value={form.sec_number} onChange={e => set('sec_number', e.target.value)} className="input" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>حد الأمان</label>
              <input type="number" value={form.reorder} onChange={e => set('reorder', e.target.value)} className="input" min="0" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>المصدر</label>
              <select value={form.source} onChange={e => set('source', e.target.value)} className="select">
                <option value="خاص">خاص</option>
                <option value="SEC">SEC</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '5px' }}>الموقع في المستودع</label>
            <input value={form.location} onChange={e => set('location', e.target.value)} className="input" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  )
}



// ══════════════════════════════════════════
function WarehouseCard({ wh, stats, onEdit, onDelete, onItems, canEdit }: {
  wh: WH; stats: { total: number; low: number }
  onEdit: () => void; onDelete: () => void; onItems: () => void; canEdit: boolean
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
              <button onClick={onItems} title="أصناف المستودع"
                style={{ padding: '5px 9px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Package style={{ width: '13px', height: '13px' }} /> الأصناف
              </button>
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

  // ══ لوحة أصناف المستودع (الإعداد الأولي للمواد) ══
  const [itemsWhId,   setItemsWhId]   = useState<number | null>(null)
  const [whMats,      setWhMats]      = useState<Material[]>([])
  const [matsLoading, setMatsLoading] = useState(false)
  const [matSearch,   setMatSearch]   = useState('')
  const [matModal,    setMatModal]    = useState<'define' | 'edit' | null>(null)
  const [editMat,     setEditMat]     = useState<Material | null>(null)

  const canEdit = currentUser?.permissions?.includes('inventory') || currentUser?.role === 'مدير عام'

  useEffect(() => { if (tenant && activeBranch) loadData() }, [tenant?.id, activeBranch?.id])

  // فتح مستودع محدد قادماً من صفحة الأرصدة (?wh=)
  useEffect(() => {
    const whParam = new URLSearchParams(window.location.search).get('wh')
    if (whParam) openItems(Number(whParam))
  }, [tenant?.id])

  async function openItems(whId: number) {
    setItemsWhId(whId); setMatSearch('')
    await loadWhMats(whId)
  }

  async function loadWhMats(whId: number) {
    if (!tenant) return
    setMatsLoading(true)
    const { data } = await supabase.from('materials')
      .select('*, warehouse:warehouses(name)')
      .eq('tenant_id', tenant.id).eq('warehouse_id', whId).order('name')
    setWhMats((data || []) as Material[])
    setMatsLoading(false)
  }

  async function toggleMaterial(id: number, current: boolean) {
    if (!confirm(current ? 'تعطيل هذه المادة؟' : 'تفعيل هذه المادة؟')) return
    await supabase.from('materials').update({ is_active: !current }).eq('id', id)
    if (itemsWhId) loadWhMats(itemsWhId)
    loadData()
    toast.success(current ? 'تم التعطيل' : 'تم التفعيل')
  }

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
            <Warehouse style={{ width: '22px', height: '22px', color: '#7c3aed' }} /> المستودعات والأصناف
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>
            {warehouses.length} مستودع — {generalWhs.length} عام، {projectWhs.length} مشاريع — الإعداد الأولي: تعريف المستودعات وأصنافها
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditWh(undefined); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '15px', height: '15px' }} /> مستودع جديد
          </button>
        )}
      </div>


      {/* ══ لوحة أصناف المستودع المحدد — الإعداد الأولي ══ */}
      {itemsWhId !== null && (() => {
        const selWh = warehouses.find(w => w.id === itemsWhId)
        const shown = matSearch.trim()
          ? whMats.filter(m => m.name.includes(matSearch) || (m.catalog_no || '').includes(matSearch) || (m.sec_number || '').includes(matSearch) || (m.mat_code || '').includes(matSearch))
          : whMats
        return (
          <div style={{ background: 'var(--card-bg, white)', border: '2px solid #bfdbfe', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: '#eff6ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Package style={{ width: '18px', height: '18px', color: '#1a56db' }} />
                <span style={{ fontWeight: 700, color: '#1a56db' }}>أصناف: {selWh?.name || '—'}</span>
                <span style={{ background: 'white', color: '#1a56db', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{whMats.length} صنف</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: 'var(--text3)' }} />
                  <input value={matSearch} onChange={e => setMatSearch(e.target.value)}
                    placeholder="بحث..." className="input" style={{ paddingRight: '28px', width: '160px', fontSize: '0.78rem' }} />
                </div>
                <button onClick={() => setMatModal('define')} className="btn btn-primary" style={{ fontSize: '0.78rem' }}>
                  <Plus style={{ width: '14px', height: '14px' }} /> إضافة مادة
                </button>
                <button onClick={() => setItemsWhId(null)} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>
                  <X style={{ width: '14px', height: '14px' }} /> إغلاق
                </button>
              </div>
            </div>

            {matsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <div style={{ width: '26px', height: '26px', border: '3px solid var(--border)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : shown.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.875rem' }}>
                {matSearch ? 'لا نتائج للبحث' : 'لا توجد أصناف — أضف أول مادة لهذا المستودع'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2, #f8fafc)' }}>
                      {['الكود', 'رقم الكتالوج', 'رقم SEC', 'الاسم', 'المصدر', 'الوحدة', 'الكمية', 'حد الأمان', 'الحالة', ''].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: '0.73rem', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--bg2, #f8fafc)', opacity: m.is_active === false ? 0.5 : 1 }}>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700 }}>{m.mat_code || '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#1a56db' }}>{m.catalog_no || '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text3)' }}>{m.sec_number || '—'}</td>
                        <td style={{ padding: '9px 12px', fontWeight: 700 }}>{m.name}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ background: m.source === 'كهرباء' || m.source === 'SEC' ? '#ecfdf5' : '#f5f3ff', color: m.source === 'كهرباء' || m.source === 'SEC' ? '#0ea77b' : '#7c3aed', borderRadius: '20px', padding: '2px 9px', fontSize: '0.68rem', fontWeight: 700 }}>
                            {m.source || 'خاص'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{m.unit}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 700, color: Number(m.qty) <= 0 ? '#c81e1e' : '#0ea77b' }}>{Number(m.qty).toLocaleString()}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--text3)' }}>{m.reorder || '—'}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ background: m.is_active === false ? '#f3f4f6' : '#ecfdf5', color: m.is_active === false ? '#6b7280' : '#0ea77b', borderRadius: '20px', padding: '2px 9px', fontSize: '0.68rem', fontWeight: 700 }}>
                            {m.is_active === false ? 'معطلة' : 'نشطة'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>
                          <button onClick={() => { setEditMat(m); setMatModal('edit') }} title="تعديل"
                            style={{ padding: '4px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#6b7280', marginLeft: '4px' }}>
                            <Pencil style={{ width: '12px', height: '12px' }} />
                          </button>
                          <button onClick={() => toggleMaterial(m.id, m.is_active !== false)}
                            style={{ padding: '4px 9px', borderRadius: '6px', border: '1px solid ' + (m.is_active === false ? '#86efac' : '#fecaca'), background: m.is_active === false ? '#ecfdf5' : '#fef2f2', cursor: 'pointer', color: m.is_active === false ? '#0ea77b' : '#c81e1e', fontSize: '0.7rem', fontWeight: 700 }}>
                            {m.is_active === false ? 'تفعيل' : 'تعطيل'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

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
                onDelete={() => handleDelete(wh)}
                onItems={() => openItems(wh.id)} />
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
                onDelete={() => handleDelete(wh)}
                onItems={() => openItems(wh.id)} />
            ))}
          </div>
        )}
      </div>

      {matModal === 'define' && tenant && activeBranch && (
        <MaterialDefineModal tenantId={tenant.id} branchId={activeBranch.id} warehouses={warehouses as any}
          onClose={() => setMatModal(null)}
          onSave={() => { if (itemsWhId) loadWhMats(itemsWhId); loadData() }} />
      )}
      {matModal === 'edit' && editMat && (
        <MaterialEditModal material={editMat} warehouses={warehouses as any}
          onClose={() => { setMatModal(null); setEditMat(null) }}
          onSave={() => { if (itemsWhId) loadWhMats(itemsWhId); loadData() }} />
      )}

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
