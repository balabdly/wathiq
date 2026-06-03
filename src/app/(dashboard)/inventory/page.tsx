'use client'
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/hooks/useStore'
import { materialsApi, ledgerApi, warehousesApi } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  Package, Plus, Search, Pencil, Trash2, ArrowDownToLine,
  ArrowUpFromLine, AlertTriangle, X, Warehouse as WarehouseIcon,
  ArrowRight, Eye, Upload, FileSpreadsheet, CheckCircle2,
  ChevronRight, ArrowLeftRight, ChevronLeft, Filter,
  ShoppingCart, ClipboardCheck, Download
} from 'lucide-react'
import type { Material, StockLedger, Warehouse } from '@/types'
import toast from 'react-hot-toast'

// ── دالة الطباعة ─────────────────────────────────────────────────────
function printInventoryReport(title: string, subtitle: string, companyName: string, headers: string[], rows: (string|number)[][]) {
  const win = window.open('', '_blank')
  if (!win) { alert('يرجى السماح بالنوافذ المنبثقة'); return }
  const tableRows = rows.map((row, i) =>
    `<tr style="background:${i%2===0?'#f8fafc':'white'}">${row.map(c => `<td style="padding:7px 12px;border:1px solid #e5e7eb;font-size:12px">${c??''}</td>`).join('')}</tr>`
  ).join('')
  win.document.write(`<!DOCTYPE html><html dir="rtl"><head>
    <meta charset="UTF-8"><title>${title}</title>
    <style>
      body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;margin:24px;direction:rtl;color:#1f2937}
      .header{border-bottom:3px solid #1a56db;padding-bottom:12px;margin-bottom:20px;display:flex;align-items:center;gap:16px}
      .logo{width:50px;height:50px;background:#1a56db;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:bold;flex-shrink:0}
      .company{font-size:18px;font-weight:bold;color:#1a56db}
      .title{font-size:14px;color:#374151;margin-top:4px}
      .subtitle{font-size:11px;color:#6b7280;margin-top:2px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#1a56db;color:white;padding:8px 12px;text-align:right;font-size:12px;border:1px solid #1349b8;white-space:nowrap}
      .footer{margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
      @media print{body{margin:0}.no-print{display:none}}
    </style>
  </head><body>
    <div class="header">
      <div class="logo">📦</div>
      <div>
        <div class="company">${companyName}</div>
        <div class="title">${title}</div>
        <div class="subtitle">${subtitle} &nbsp;|&nbsp; ${new Date().toLocaleDateString('ar-EG')} &nbsp;|&nbsp; ${rows.length} سجل</div>
      </div>
    </div>
    <table>
      <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="footer">
      <span>وثيق ERP — نظام إدارة مقاولي الكهرباء</span>
      <span>${title} — ${new Date().toLocaleDateString('ar-EG')}</span>
    </div>
    <script>window.onload=function(){window.print()}</script>
  </body></html>`)
  win.document.close()
}

// ── ثوابت ──────────────────────────────────────────────────────────
const PAGE_SIZE = 25

const TX_COLORS: Record<string,string> = {
  'توريد':   'badge-green',
  'صرف':     'badge-red',
  'إرجاع للكهرباء': 'badge-amber',
  'نقل مخزني': 'badge-blue',
}

// ── نافذة إضافة / تعديل مادة ──────────────────────────────────────
function MaterialModal({ mat, warehouses, onClose, onSave }: {
  mat: Material | null; warehouses: Warehouse[]
  onClose: () => void; onSave: (d: Partial<Material>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    catalog_no:   mat?.catalog_no   || '',
    sec_number:   mat?.sec_number   || '',
    sku:          mat?.sku          || '',
    name:         mat?.name         || '',
    unit:         mat?.unit         || 'قطعة',
    qty:          mat?.qty          ?? 0,
    reorder:      mat?.reorder      ?? 5,
    warehouse_id: mat?.warehouse_id || warehouses[0]?.id || 0,
    source:       (mat?.source      || 'كهرباء') as 'كهرباء' | 'خاص',
    notes:        mat?.notes        || '',
    location:     (mat as any)?.location || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const UNITS = ['قطعة','متر','كجم','لتر','علبة','رول','طن','م²','م³']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.catalog_no.trim()) return
    if (form.source === 'كهرباء' && !form.sec_number.trim()) {
      toast.error('SEC Number إلزامي لمواد الكهرباء'); return
    }
    setSaving(true)
    await onSave({
      ...(mat ? { id: mat.id } : {}),
      catalog_no: form.catalog_no, sec_number: form.sec_number || undefined,
      sku: form.sku || undefined, name: form.name, unit: form.unit,
      qty: Number(form.qty), reorder: Number(form.reorder),
      warehouse_id: Number(form.warehouse_id), source: form.source,
      notes: form.notes || undefined,
      location: form.location || undefined,
    } as any)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{mat ? 'تعديل مادة' : 'إضافة مادة جديدة'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">مصدر المادة</label>
              <div className="flex gap-2">
                {(['كهرباء','خاص'] as const).map(s => (
                  <button key={s} type="button" onClick={() => set('source', s)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.source === s ? s === 'كهرباء' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-500'}`}>
                    {s === 'كهرباء' ? '⚡ مواد كهرباء' : '🏢 مواد خاصة'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الكتالوج <span className="text-red-500">*</span></label>
                <input value={form.catalog_no} onChange={e => set('catalog_no', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">SEC Number {form.source === 'كهرباء' && <span className="text-red-500">*</span>}</label>
                <input value={form.sec_number} onChange={e => set('sec_number', e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المادة <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الوحدة</label>
                <select value={form.unit} onChange={e => set('unit', e.target.value)} className="select">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم SKU</label>
                <input value={form.sku} onChange={e => set('sku', e.target.value)} className="input" placeholder="اختياري" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الكمية الابتدائية</label>
                <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)} className="input" min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">حد الأمان</label>
                <input type="number" value={form.reorder} onChange={e => set('reorder', e.target.value)} className="input" min="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المستودع</label>
                <select value={form.warehouse_id} onChange={e => set('warehouse_id', e.target.value)} className="select">
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع الداخلي</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="مثال: رف A3، قسم الكابلات" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {mat ? 'حفظ' : 'إضافة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── نافذة إضافة مستودع ─────────────────────────────────────────────
function WarehouseModal({ onClose, onSave }: {
  onClose: () => void; onSave: (d: Partial<Warehouse>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'مختلط' as any, location: '' })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await onSave({ name: form.name, stock_type: form.type, location: form.location || undefined } as any)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">إضافة مستودع</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع المستودع</label>
              <div className="grid grid-cols-3 gap-2">
 diff
-{[{v:'SEC',l:'⚡ مواد SEC'},{v:'خاص',l:'🏢 مواد خاصة'},{v:'مختلط',l:'🏭 مختلط'}].map(t => (
+{[{v:'كهرباء',l:'⚡ مواد كهرباء'},{v:'خاص',l:'🏢 مواد خاصة'},{v:'مختلط',l:'🏭 مختلط'}].map(t => (

                  <button key={t.v} type="button" onClick={() => set('type', t.v)}
                    className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${form.type === t.v ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المستودع <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: مستودع الرياض الرئيسي" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع (اختياري)</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="المدينة، الحي" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              إضافة
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── مكون البحث عن مادة ─────────────────────────────────────────────
function MaterialSearchInput({ materials, value, onChange }: {
  materials: Material[]; value: string
  onChange: (name: string, unit: string, matId?: number) => void
}) {
  const [query, setQuery] = useState(value)
  const [open, setOpen]   = useState(false)
  const ref               = useRef<HTMLDivElement>(null)
  const results = query.length >= 1
    ? materials.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.catalog_no.toLowerCase().includes(query.toLowerCase()) ||
        (m.sec_number||'').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange('','') }}
        onFocus={() => setOpen(true)} className="input text-sm" placeholder="ابحث بالاسم أو الكود أو SEC..." />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {results.map(m => (
            <button key={m.id} type="button"
              onClick={() => { onChange(m.name, m.unit, m.id); setQuery(m.name); setOpen(false) }}
              className="w-full text-right px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-gray-800">{m.name}</div>
                <div className="text-xs text-gray-400">{m.catalog_no}{m.sec_number && <span className="text-blue-500 mr-2">SEC: {m.sec_number}</span>}</div>
              </div>
              <div className="text-xs font-bold text-gray-700 flex-shrink-0">{m.qty} {m.unit}</div>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm text-gray-400 text-center">
          لا توجد مادة — يجب تعريفها أولاً
        </div>
      )}
    </div>
  )
}

// ── نافذة استلام مواد ──────────────────────────────────────────────
function ReceiveModal({ materials, warehouses, projects, onClose, onSave }: {
  materials: Material[]; warehouses: Warehouse[]
  projects: { id: number; name: string }[]
  onClose: () => void
  onSave: (rows: { mat: Material; qty: number; projectId: number|'' }[], vendor: string, reservationNo: string, exitPermitNo: string) => Promise<void>
}) {
  const [saving, setSaving]         = useState(false)
  const [vendor, setVendor]         = useState('')
  const [reservationNo, setReserve] = useState('')
  const [exitPermitNo, setExit]     = useState('')
  const [rows, setRows] = useState<{ id: number; mat: Material|null; qty: number; projectId: number|'' }[]>([{ id: 1, mat: null, qty: 1, projectId: '' }])

  function addRow() { setRows(r => [...r, { id: Date.now(), mat: null, qty: 1, projectId: '' }]) }
  function removeRow(id: number) { setRows(r => r.filter(x => x.id !== id)) }
  function updateRow(id: number, k: string, v: any) { setRows(r => r.map(x => x.id === id ? { ...x, [k]: v } : x)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valid = rows.filter(r => r.mat && r.qty > 0)
    if (valid.length === 0) { toast.error('أضف مادة واحدة على الأقل'); return }
    const secWithoutProject = valid.filter(r => r.mat?.source === 'كهرباء' && !r.projectId)
    if (secWithoutProject.length > 0) {
      toast.error(`يجب تحديد مشروع لمواد الكهرباء: ${secWithoutProject.map(r => r.mat!.name).join('، ')}`); return
    }
    setSaving(true)
    await onSave(valid as any, vendor, reservationNo, exitPermitNo)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><ArrowDownToLine className="w-5 h-5 text-emerald-500" />استلام مواد</h3>
            <p className="text-xs text-gray-400 mt-0.5">مواد الكهرباء يجب ربطها بمشروع</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المورد</label>
              <input value={vendor} onChange={e => setVendor(e.target.value)} className="input" placeholder="اسم المورد أو الكهرباء" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الحجز</label>
                <input value={reservationNo} onChange={e => setReserve(e.target.value)} className="input" dir="ltr" placeholder="RSV-2024-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم إذن الخروج</label>
                <input value={exitPermitNo} onChange={e => setExit(e.target.value)} className="input" dir="ltr" placeholder="EXP-2024-001" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">المواد المستلمة</label>
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={row.id} className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-6 h-9 flex items-center justify-center text-xs text-gray-400 font-bold">{i+1}</div>
                    <div className="flex-1">
                      <MaterialSearchInput materials={materials} value={row.mat?.name||''} onChange={(name,unit,matId) => { const m = materials.find(x=>x.id===matId); updateRow(row.id,'mat',m||null) }} />
                    </div>
                    <div className="w-20 flex-shrink-0">
                      <input type="number" value={row.qty} min="1" onChange={e => updateRow(row.id,'qty',Number(e.target.value))} className="input text-sm text-center" />
                    </div>
                    {row.mat && <div className="w-8 flex-shrink-0 h-9 flex items-center text-xs text-gray-500">{row.mat.unit}</div>}
                    <div className="w-36 flex-shrink-0">
                      <select value={row.projectId} onChange={e => updateRow(row.id,'projectId', e.target.value ? Number(e.target.value) : '')}
                        className={`select text-xs py-1.5 ${row.mat?.source === 'كهرباء' && !row.projectId ? 'border-red-300' : ''}`}>
                        <option value="">بدون مشروع</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name.length > 18 ? p.name.substring(0,18)+'…' : p.name}</option>)}
                      </select>
                    </div>
                    {rows.length > 1 && <button type="button" onClick={() => removeRow(row.id)} className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg"><X className="w-4 h-4" /></button>}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addRow} className="mt-2 btn btn-ghost btn-sm w-full border border-dashed border-gray-300">
                <Plus className="w-3.5 h-3.5" /> إضافة مادة أخرى
              </button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              تسجيل الاستلام
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── نافذة صرف مواد ─────────────────────────────────────────────────
function DispatchModal({ materials, projects, onClose, onSave, onLoan }: {
  materials: Material[]
  projects: { id: number; name: string }[]
  onClose: () => void
  onSave: (rows: { mat: Material; qty: number; checked: boolean }[], projectName: string, note: string) => Promise<void>
  onLoan: (rows: { mat: Material; qty: number }[], fromProject: string, toProject: string, note: string) => Promise<void>
}) {
  const [saving, setSaving]           = useState(false)
  const [projectId, setProject]       = useState<number|''>('')
  const [note, setNote]               = useState('')
  const [showLoan, setShowLoan]       = useState(false)
  const [loanProjectId, setLoanProj]  = useState<number|''>('')
  const [loanRows, setLoanRows]       = useState<{ id: number; mat: Material|null; qty: number }[]>([{ id: 1, mat: null, qty: 1 }])
  const [projectMaterials, setProjMats] = useState<{ mat: Material; totalIn: number; totalOut: number }[]>([])
  const [loadingProjMats, setLoadingProjMats] = useState(false)
  const [checkedRows, setCheckedRows] = useState<Record<string, { checked: boolean; qty: number }>>({})

  useEffect(() => {
    if (!projectId) { setProjMats([]); return }
    const projectName = projects.find(p => p.id === Number(projectId))?.name || ''
    if (!projectName) return
    setLoadingProjMats(true)
    supabase.from('stock_ledger').select('*').eq('project_name', projectName)
      .then(({ data }) => {
        const matMap: Record<string, { mat: Material; totalIn: number; totalOut: number }> = {}
        ;(data || []).forEach((l: any) => {
          const m = materials.find(x => x.name === l.mat_name)
          if (!m) return
          if (!matMap[l.mat_name]) matMap[l.mat_name] = { mat: m, totalIn: 0, totalOut: 0 }
          if (l.type === 'توريد' || l.type === 'إرجاع للكهرباء') matMap[l.mat_name].totalIn += l.qty
          if (l.type === 'صرف' && !l.is_loan) matMap[l.mat_name].totalOut += l.qty
        })
        setProjMats(Object.values(matMap).filter(x => x.totalIn - x.totalOut > 0))
        setLoadingProjMats(false)
      })
  }, [projectId])

  function toggleCheck(matName: string, maxQty: number) {
    setCheckedRows(prev => ({
      ...prev,
      [matName]: prev[matName] ? { ...prev[matName], checked: !prev[matName].checked } : { checked: true, qty: maxQty }
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId) { toast.error('يجب اختيار المشروع'); return }
    const selected = projectMaterials.filter(pm => checkedRows[pm.mat.name]?.checked)
    if (selected.length === 0) { toast.error('حدد مادة واحدة على الأقل'); return }
    for (const pm of selected) {
      const qty = checkedRows[pm.mat.name]?.qty || 0
      const available = pm.totalIn - pm.totalOut
      if (qty <= 0 || qty > available) { toast.error(`كمية غير صحيحة لـ "${pm.mat.name}"`); return }
    }
    setSaving(true)
    const rows = selected.map(pm => ({ mat: pm.mat, qty: checkedRows[pm.mat.name]?.qty || (pm.totalIn - pm.totalOut), checked: true }))
    const projectName = projects.find(p => p.id === Number(projectId))?.name || ''
    await onSave(rows, projectName, note)
    setSaving(false)
  }

  async function handleLoan(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !loanProjectId) { toast.error('يجب اختيار المشروعين'); return }
    if (projectId === loanProjectId) { toast.error('لا يمكن الاستعارة من نفس المشروع'); return }
    const valid = loanRows.filter(r => r.mat && r.qty > 0)
    if (valid.length === 0) { toast.error('أضف مادة واحدة على الأقل'); return }
    setSaving(true)
    const fromProject = projects.find(p => p.id === Number(loanProjectId))?.name || ''
    const toProject   = projects.find(p => p.id === Number(projectId))?.name || ''
    await onLoan(valid as { mat: Material; qty: number }[], fromProject, toProject, note)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '750px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><ArrowUpFromLine className="w-5 h-5 text-red-500" />صرف مواد للمشروع</h3>
            <p className="text-xs text-gray-400 mt-0.5">تظهر مواد المشروع المستلمة فقط</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع <span className="text-red-500">*</span></label>
              <select value={projectId} onChange={e => { setProject(e.target.value ? Number(e.target.value) : ''); setCheckedRows({}) }} className="select">
                <option value="">— اختر المشروع —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظة</label>
              <input value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="ملاحظة..." />
            </div>
          </div>

          {projectId && (
            <>
              {loadingProjMats ? (
                <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
              ) : projectMaterials.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <div className="text-amber-700 font-semibold text-sm mb-1">لا توجد مواد مستلمة لهذا المشروع</div>
                  <div className="text-amber-600 text-xs">استخدم خيار الاستعارة أدناه</div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">مواد المشروع — أشّر ما تريد صرفه</label>
                    <span className="text-xs text-gray-400">{Object.values(checkedRows).filter(r => r.checked).length} محدد</span>
                  </div>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-10 px-3 py-2"></th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">المادة</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-emerald-600">المتاح</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">الكمية</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">الوحدة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {projectMaterials.map(pm => {
                          const available = pm.totalIn - pm.totalOut
                          const row = checkedRows[pm.mat.name]
                          return (
                            <tr key={pm.mat.id} className={`transition-colors ${row?.checked ? 'bg-red-50/40' : 'hover:bg-gray-50/50'}`}>
                              <td className="px-3 py-2.5 text-center">
                                <input type="checkbox" checked={row?.checked || false}
                                  onChange={() => toggleCheck(pm.mat.name, available)}
                                  className="w-4 h-4 rounded cursor-pointer" />
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="font-medium text-gray-800">{pm.mat.name}</div>
                                {pm.mat.sec_number && <div className="text-xs text-blue-500 font-mono">SEC: {pm.mat.sec_number}</div>}
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold text-emerald-600">{available}</td>
                              <td className="px-3 py-2.5 text-center">
                                <input type="number" min="1" max={available}
                                  value={row?.qty || available}
                                  onChange={e => setCheckedRows(prev => ({ ...prev, [pm.mat.name]: { checked: true, qty: Number(e.target.value) } }))}
                                  disabled={!row?.checked}
                                  className={`w-20 input text-center text-sm py-1 ${!row?.checked ? 'opacity-40' : ''}`} />
                              </td>
                              <td className="px-3 py-2.5 text-center text-gray-400 text-xs">{pm.mat.unit}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button type="button" onClick={() => setShowLoan(!showLoan)}
                className={`btn btn-sm w-full gap-2 border border-dashed transition-all ${showLoan ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-600'}`}>
                <ArrowLeftRight className="w-4 h-4" />
                {showLoan ? 'إلغاء' : '🔄 استعارة مواد من مشروع آخر'}
              </button>

              {showLoan && (
                <form onSubmit={handleLoan} className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <div className="font-semibold text-amber-700 text-sm flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4" /> استعارة موثقة
                  </div>
                  <div className="bg-amber-100 rounded-lg p-2 text-xs text-amber-700">
                    ⚠ ستُسجَّل كدين على مشروع "{projects.find(p => p.id === Number(projectId))?.name}"
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-amber-700 mb-1.5">استعر من مشروع <span className="text-red-500">*</span></label>
                    <select value={loanProjectId} onChange={e => setLoanProj(e.target.value ? Number(e.target.value) : '')} className="select" required>
                      <option value="">— اختر المشروع المُقرض —</option>
                      {projects.filter(p => p.id !== Number(projectId)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    {loanRows.map((row) => (
                      <div key={row.id} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <MaterialSearchInput materials={materials.filter(m => m.qty > 0)} value={row.mat?.name || ''}
                            onChange={(name, unit, matId) => {
                              const m = materials.find(x => x.id === matId)
                              setLoanRows(r => r.map(x => x.id === row.id ? { ...x, mat: m || null } : x))
                            }} />
                        </div>
                        <input type="number" value={row.qty} min="1"
                          onChange={e => setLoanRows(r => r.map(x => x.id === row.id ? { ...x, qty: Number(e.target.value) } : x))}
                          className="w-20 input text-sm text-center" />
                        {row.mat && <span className="h-9 flex items-center text-xs text-gray-500">{row.mat.unit}</span>}
                        {loanRows.length > 1 && (
                          <button type="button" onClick={() => setLoanRows(r => r.filter(x => x.id !== row.id))}
                            className="w-9 h-9 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setLoanRows(r => [...r, { id: Date.now(), mat: null, qty: 1 }])}
                      className="btn btn-ghost btn-sm w-full border border-dashed border-amber-300 text-amber-600">
                      <Plus className="w-3.5 h-3.5" /> إضافة مادة
                    </button>
                  </div>
                  <button type="submit" disabled={saving} className="btn w-full justify-center gap-2" style={{background:'#e6820a', color:'white'}}>
                    {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                    تسجيل الاستعارة
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {!showLoan && projectId && projectMaterials.length > 0 && (
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button onClick={handleSubmit} disabled={saving || Object.values(checkedRows).filter(r => r.checked).length === 0}
              className="btn btn-primary" style={{background:'rgb(239 68 68)'}}>
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              تأكيد الصرف ({Object.values(checkedRows).filter(r => r.checked).length} مادة)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── نافذة استيراد Excel ──────────────────────────────────────────
function ImportModal({ warehouses, onClose, onImport }: {
  warehouses: Warehouse[]; onClose: () => void
  onImport: (rows: Partial<Material>[]) => Promise<void>
}) {
  const [saving, setSaving]         = useState(false)
  const [warehouseId, setWarehouse] = useState(warehouses[0]?.id || 0)
  const [preview, setPreview]       = useState<Partial<Material>[]>([])
  const [error, setError]           = useState('')
  const fileRef                     = useRef<HTMLInputElement>(null)

  // تحميل نموذج Excel جاهز
  function downloadTemplate() {
    const esc = (s: any) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    let xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>'
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
    xml += '<Styles>'
    xml += '<Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1a56db" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>'
    xml += '<Style ss:ID="ex"><Interior ss:Color="#fef9c3" ss:Pattern="Solid"/><Font ss:Italic="1" ss:Color="#92400e"/></Style>'
    xml += '<Style ss:ID="req"><Interior ss:Color="#fef2f2" ss:Pattern="Solid"/><Font ss:Color="#dc2626"/></Style>'
    xml += '</Styles>'
    xml += '<Worksheet ss:Name="المواد">'
    xml += '<Table ss:DefaultColumnWidth="120">'
    // رأس الأعمدة
    const headers = [
      { label: 'اسم المادة *', style: 'req' },
      { label: 'رقم الكتالوج *', style: 'req' },
      { label: 'SEC Number', style: 'h' },
      { label: 'الوحدة', style: 'h' },
      { label: 'الكمية', style: 'h' },
      { label: 'حد الأمان', style: 'h' },
      { label: 'المصدر (كهرباء/خاص)', style: 'h' },
      { label: 'الموقع الداخلي', style: 'h' },
    ]
    xml += '<Row>' + headers.map(h => `<Cell ss:StyleID="${h.style}"><Data ss:Type="String">${esc(h.label)}</Data></Cell>`).join('') + '</Row>'
    // أمثلة
    const examples = [
      ['كابل نحاسي 16mm', 'CAB-016', 'SEC-123456', 'متر', '100', '10', 'كهرباء', 'رف A1'],
      ['قاطع تلقائي 63A', 'MCB-063', 'SEC-789012', 'قطعة', '50', '5', 'كهرباء', 'رف B2'],
      ['خوذة سلامة', 'SAF-HLM', '', 'قطعة', '20', '5', 'خاص', 'قسم السلامة'],
    ]
    examples.forEach(ex => {
      xml += '<Row ss:StyleID="ex">' + ex.map(v => `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`).join('') + '</Row>'
    })
    xml += '</Table>'
    // ورقة تعليمات
    xml += '<Worksheet ss:Name="تعليمات">'
    xml += '<Table>'
    const instructions = [
      ['التعليمات', ''],
      ['', ''],
      ['الحقول المطلوبة (بالأحمر):', ''],
      ['اسم المادة', 'اسم المادة كما سيظهر في النظام'],
      ['رقم الكتالوج', 'رقم مرجعي فريد للمادة'],
      ['', ''],
      ['الحقول الاختيارية:', ''],
      ['SEC Number', 'رقم المادة في شركة الكهرباء (إلزامي لمواد الكهرباء)'],
      ['الوحدة', 'مثال: متر، قطعة، كجم، لتر، رول، علبة'],
      ['الكمية', 'الكمية الابتدائية (رقم)'],
      ['حد الأمان', 'الكمية الدنيا قبل التنبيه (رقم)'],
      ['المصدر', 'كهرباء أو خاص'],
      ['الموقع الداخلي', 'مثال: رف A3، قسم الكابلات'],
    ]
    instructions.forEach(([k, v]) => {
      xml += `<Row><Cell><Data ss:Type="String">${esc(k)}</Data></Cell><Cell><Data ss:Type="String">${esc(v)}</Data></Cell></Row>`
    })
    xml += '</Table></Worksheet>'
    xml += '</Workbook>'
    const blob = new Blob(['\uFEFF' + xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'نموذج-استيراد-المواد.xls'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  function parseExcel(text: string): Partial<Material>[] {
    // دعم CSV و Excel (النص المحول)
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) throw new Error('الملف فارغ أو لا يحتوي على بيانات')
    // تحديد الفاصل (tab لـ Excel، comma لـ CSV)
    const sep = lines[0].includes('\t') ? '\t' : ','
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase())
    return lines.slice(1).map(line => {
      const vals = line.split(sep).map(v => v.trim().replace(/^["']|["']$/g, ''))
      const row: any = {}
      headers.forEach((h, i) => { row[h] = vals[i] || '' })
      return {
        name:       row['اسم المادة *'] || row['اسم المادة'] || row['name'] || '',
        catalog_no: row['رقم الكتالوج *'] || row['رقم الكتالوج'] || row['catalog_no'] || '',
        sec_number: row['sec number'] || row['sec_number'] || row['sec'] || undefined,
        unit:       row['الوحدة'] || row['unit'] || 'قطعة',
        qty:        Number(row['الكمية'] || row['qty'] || 0),
        reorder:    Number(row['حد الأمان'] || row['reorder'] || 5),
        source:     (row['المصدر (كهرباء/خاص)'] || row['المصدر'] || row['source'] || 'خاص') as any,
        location:   row['الموقع الداخلي'] || row['location'] || undefined,
      } as any
    }).filter(r => r.name && r.catalog_no)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = ev => {
      try { setPreview(parseExcel(ev.target?.result as string)) }
      catch (err: any) { setError(err.message) }
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleImport() {
    if (preview.length === 0) return
    setSaving(true)
    await onImport(preview.map(r => ({ ...r, warehouse_id: Number(warehouseId) })))
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-500" />استيراد مواد من Excel</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body">
          {/* خطوات الاستيراد */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="font-semibold text-blue-700 text-sm mb-3">📋 خطوات الاستيراد</div>
            <div className="space-y-2 text-sm text-blue-600">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <span>حمّل النموذج الجاهز من الزر أدناه</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <span>أضف المواد في ورقة "المواد" واحفظ الملف</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                <span>ارفع الملف وتحقق من المعاينة ثم استورد</span>
              </div>
            </div>
            <button onClick={downloadTemplate}
              className="mt-3 btn btn-sm gap-2 bg-blue-600 hover:bg-blue-700 text-white w-full justify-center">
              <Download className="w-4 h-4" /> تحميل النموذج الجاهز (Excel)
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">المستودع الهدف</label>
            <select value={warehouseId} onChange={e => setWarehouse(Number(e.target.value))} className="select">
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div>
            <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx,.txt" className="hidden" onChange={handleFile} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 hover:border-primary-400 rounded-xl p-6 text-center transition-all hover:bg-primary-50/30">
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <div className="text-sm font-medium text-gray-600">اضغط لاختيار ملف Excel أو CSV</div>
              <div className="text-xs text-gray-400 mt-1">.xls / .xlsx / .csv</div>
            </button>
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">⚠ {error}</div>}

          {preview.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {preview.length} مادة جاهزة للاستيراد
              </div>
              <div className="border border-gray-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-right px-3 py-2">المادة</th>
                      <th className="text-right px-3 py-2">الكود</th>
                      <th className="text-center px-3 py-2">الكمية</th>
                      <th className="text-center px-3 py-2">المصدر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-3 py-1.5 font-medium">{r.name}</td>
                        <td className="px-3 py-1.5 font-mono text-gray-500">{r.catalog_no}</td>
                        <td className="px-3 py-1.5 text-center">{r.qty} {r.unit}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`badge text-xs ${(r as any).source === 'كهرباء' ? 'badge-blue' : 'badge-green'}`}>
                            {(r as any).source || 'خاص'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleImport} disabled={saving || preview.length === 0} className="btn btn-primary">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
            استيراد {preview.length > 0 ? `${preview.length} مادة` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── نافذة تحويل مواد بين مستودعات ─────────────────────────────────
function TransferModal({ materials, warehouses, projects, onClose, onSave }: {
  materials: Material[]; warehouses: Warehouse[]
  projects: { id: number; name: string }[]
  onClose: () => void
  onSave: (rows: { mat: Material; qty: number }[], fromWh: Warehouse, toWh: Warehouse, projectName: string, confirmCode: string) => Promise<void>
}) {
  const [saving, setSaving]         = useState(false)
  const [fromWhId, setFromWh]       = useState<number|''>('')
  const [toWhId, setToWh]           = useState<number|''>('')
  const [projectId, setProject]     = useState<number|''>('')
  const [confirmCode, setConfirm]   = useState('')
  const [rows, setRows]             = useState<{ id: number; mat: Material|null; qty: number }[]>([{ id: 1, mat: null, qty: 1 }])
  const fromWarehouse = warehouses.find(w => w.id === Number(fromWhId))
  const toWarehouse   = warehouses.find(w => w.id === Number(toWhId))
  const selectedProject = projects.find(p => p.id === Number(projectId))
  function addRow() { setRows(r => [...r, { id: Date.now(), mat: null, qty: 1 }]) }
  function removeRow(id: number) { setRows(r => r.filter(x => x.id !== id)) }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fromWhId || !toWhId) { toast.error('يجب اختيار المستودعين'); return }
    if (fromWhId === toWhId) { toast.error('المستودعان يجب أن يكونا مختلفين'); return }
    const valid = rows.filter(r => r.mat && r.qty > 0)
    if (valid.length === 0) { toast.error('أضف مادة واحدة على الأقل'); return }
    setSaving(true)
    await onSave(valid as { mat: Material; qty: number }[], fromWarehouse!, toWarehouse!, selectedProject?.name || '', confirmCode)
    setSaving(false)
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-blue-500" />تحويل مواد بين المستودعات</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">من مستودع <span className="text-red-500">*</span></label>
                <select value={fromWhId} onChange={e => setFromWh(e.target.value ? Number(e.target.value) : '')} className="select" required>
                  <option value="">— اختر —</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">إلى مستودع <span className="text-red-500">*</span></label>
                <select value={toWhId} onChange={e => setToWh(e.target.value ? Number(e.target.value) : '')} className="select" required>
                  <option value="">— اختر —</option>
                  {warehouses.filter(w => w.id !== Number(fromWhId)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            {fromWarehouse && toWarehouse && (
              <div className="flex items-center justify-center gap-3 py-1">
                <span className="badge badge-blue px-3 py-1">{fromWarehouse.name}</span>
                <ArrowLeftRight className="w-5 h-5 text-blue-500" />
                <span className="badge badge-green px-3 py-1">{toWarehouse.name}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع المرتبط</label>
                <select value={projectId} onChange={e => setProject(e.target.value ? Number(e.target.value) : '')} className="select">
                  <option value="">— بدون مشروع —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {selectedProject && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">تأكيد رقم المشروع</label>
                  <input value={confirmCode} onChange={e => setConfirm(e.target.value)} className="input" placeholder={`${selectedProject.id}`} dir="ltr" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">المواد المحوَّلة</label>
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={row.id} className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-6 h-9 flex items-center justify-center text-xs text-gray-400">{i+1}</div>
                    <div className="flex-1">
                      <MaterialSearchInput
                        materials={materials.filter(m => !fromWhId || m.warehouse_id === Number(fromWhId))}
                        value={row.mat?.name || ''}
                        onChange={(name, unit, matId) => {
                          const m = materials.find(x => x.id === matId)
                          setRows(r => r.map(x => x.id === row.id ? { ...x, mat: m || null } : x))
                        }} />
                    </div>
                    <input type="number" value={row.qty} min="1" max={row.mat?.qty}
                      onChange={e => setRows(r => r.map(x => x.id === row.id ? { ...x, qty: Number(e.target.value) } : x))}
                      className="w-20 input text-sm text-center flex-shrink-0" />
                    {row.mat && <div className="w-8 flex-shrink-0 h-9 flex items-center text-xs text-gray-500">{row.mat.unit}</div>}
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(row.id)} className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addRow} className="mt-2 btn btn-ghost btn-sm w-full border border-dashed border-gray-300">
                <Plus className="w-3.5 h-3.5" /> إضافة مادة
              </button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{background:'#1a56db'}}>
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
              تأكيد التحويل
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── نافذة طلب شراء مواد ────────────────────────────────────────────
function PurchaseRequestModal({ materials, warehouses, projects, onClose, onSave }: {
  materials: Material[]; warehouses: Warehouse[]
  projects: { id: number; name: string }[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [saving, setSaving]     = useState(false)
  const [purpose, setPurpose]   = useState<'تالف'|'خاص'|'أخرى'>('تالف')
  const [warehouseId, setWh]    = useState(warehouses[0]?.id || 0)
  const [projectId, setProject] = useState<number|''>('')
  const [vendor, setVendor]     = useState('')
  const [notes, setNotes]       = useState('')
  const [rows, setRows]         = useState<{ id: number; matName: string; qty: number; unit: string; reason: string }[]>([{ id: 1, matName: '', qty: 1, unit: 'قطعة', reason: '' }])
  const UNITS = ['قطعة','متر','كجم','لتر','علبة','رول']
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valid = rows.filter(r => r.matName.trim() && r.qty > 0)
    if (valid.length === 0) { toast.error('أضف مادة واحدة على الأقل'); return }
    setSaving(true)
    await onSave({ purpose, warehouseId, projectId: projectId || null, vendor, notes, rows: valid })
    setSaving(false)
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div><h3 className="font-bold text-gray-800 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-purple-500" />طلب شراء مواد</h3></div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">سبب الشراء</label>
              <div className="grid grid-cols-3 gap-2">
                {([{v:'تالف',l:'🔧 استبدال تالف',c:'border-red-400 bg-red-50 text-red-700'},{v:'خاص',l:'🛡️ مواد خاصة',c:'border-purple-400 bg-purple-50 text-purple-700'},{v:'أخرى',l:'📦 أخرى',c:'border-gray-400 bg-gray-50 text-gray-700'}] as const).map(t => (
                  <button key={t.v} type="button" onClick={() => setPurpose(t.v)}
                    className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${purpose === t.v ? t.c : 'border-gray-200 text-gray-500'}`}>{t.l}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المستودع الهدف</label>
                <select value={warehouseId} onChange={e => setWh(Number(e.target.value))} className="select">
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المشروع (اختياري)</label>
                <select value={projectId} onChange={e => setProject(e.target.value ? Number(e.target.value) : '')} className="select">
                  <option value="">— بدون مشروع —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المورد المقترح</label>
              <input value={vendor} onChange={e => setVendor(e.target.value)} className="input" placeholder="اختياري" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">المواد المطلوبة</label>
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={row.id} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-1 h-9 flex items-center justify-center text-xs text-gray-400">{i+1}</div>
                    <div className="col-span-4"><input value={row.matName} onChange={e => setRows(r => r.map(x => x.id === row.id ? { ...x, matName: e.target.value } : x))} className="input text-sm" placeholder="اسم المادة" /></div>
                    <div className="col-span-2"><input type="number" value={row.qty} min="1" onChange={e => setRows(r => r.map(x => x.id === row.id ? { ...x, qty: Number(e.target.value) } : x))} className="input text-sm text-center" /></div>
                    <div className="col-span-2"><select value={row.unit} onChange={e => setRows(r => r.map(x => x.id === row.id ? { ...x, unit: e.target.value } : x))} className="select text-sm">{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                    <div className="col-span-2"><input value={row.reason} onChange={e => setRows(r => r.map(x => x.id === row.id ? { ...x, reason: e.target.value } : x))} className="input text-sm" placeholder="السبب" /></div>
                    <div className="col-span-1">{rows.length > 1 && <button type="button" onClick={() => setRows(r => r.filter(x => x.id !== row.id))} className="w-9 h-9 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg"><X className="w-4 h-4" /></button>}</div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setRows(r => [...r, { id: Date.now(), matName: '', qty: 1, unit: 'قطعة', reason: '' }])} className="mt-2 btn btn-ghost btn-sm w-full border border-dashed border-gray-300"><Plus className="w-3.5 h-3.5" /> إضافة مادة</button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input min-h-[60px] resize-none" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{background:'#8b5cf6'}}>
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              إرسال طلب الشراء
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── نافذة جرد المستودع ──────────────────────────────────────────────
function InventoryCheckModal({ warehouses, tenant, activeBranch, onClose, onSave }: {
  warehouses: Warehouse[]; tenant: any; activeBranch: any
  onClose: () => void
  onSave: (warehouseId: number, items: { matId: number; matName: string; systemQty: number; actualQty: number; unit: string }[]) => Promise<void>
}) {
  const [saving, setSaving]   = useState(false)
  const [warehouseId, setWh]  = useState(warehouses[0]?.id || 0)
  const [loading, setLoading] = useState(false)
  const [items, setItems]     = useState<{ matId: number; matName: string; systemQty: number; actualQty: number; unit: string }[]>([])

  async function loadWarehouseMaterials(whId: number) {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const { data } = await supabase.from('materials').select('id, name, qty, unit')
      .eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).eq('warehouse_id', whId).order('name')
    setItems((data || []).map((m: any) => ({ matId: m.id, matName: m.name, systemQty: m.qty, actualQty: m.qty, unit: m.unit })))
    setLoading(false)
  }

  useEffect(() => { if (warehouseId) loadWarehouseMaterials(warehouseId) }, [warehouseId])

  const hasDiscrepancy = items.some(i => i.actualQty !== i.systemQty)
  const discrepancyCount = items.filter(i => i.actualQty !== i.systemQty).length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(warehouseId, items)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div><h3 className="font-bold text-gray-800 flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-orange-500" />جرد المستودع</h3></div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">المستودع</label>
              <select value={warehouseId} onChange={e => { setWh(Number(e.target.value)); loadWarehouseMaterials(Number(e.target.value)) }} className="select">
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            {hasDiscrepancy && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-sm text-amber-700">يوجد {discrepancyCount} مادة فيها فارق</span>
              </div>
            )}
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-gray-400">لا توجد مواد في هذا المستودع</div>
            ) : (
              <div className="border border-gray-100 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600">المادة</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-blue-600">في النظام</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-emerald-600">الكمية الفعلية</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600">الفارق</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600">الوحدة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item, i) => {
                      const diff = item.actualQty - item.systemQty
                      return (
                        <tr key={item.matId} className={diff !== 0 ? 'bg-amber-50/40' : 'hover:bg-gray-50/50'}>
                          <td className="px-4 py-2.5 font-medium text-gray-800">{item.matName}</td>
                          <td className="px-4 py-2.5 text-center text-blue-600 font-bold">{item.systemQty}</td>
                          <td className="px-4 py-2.5 text-center">
                            <input type="number" min="0" value={item.actualQty}
                              onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, actualQty: Number(e.target.value) } : x))}
                              className={`w-20 input text-center text-sm py-1 ${diff !== 0 ? 'border-amber-400' : ''}`} />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {diff === 0 ? <span className="text-emerald-500 text-xs">✓</span>
                              : <span className={`font-bold text-sm ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{diff > 0 ? '+' : ''}{diff}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{item.unit}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <div className="text-xs text-gray-400 ml-auto">{discrepancyCount > 0 ? `⚠ ${discrepancyCount} مادة بها فارق` : '✓ كل المواد مطابقة'}</div>
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving || items.length === 0} className="btn btn-primary" style={{background:'#e6820a'}}>
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
              تأكيد الجرد
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// ── عرض مواد مستودع — جدول مع Pagination وفلاتر أعمدة ──────────────
function WarehouseMaterialsTable({ warehouse, canEdit, onAdd, onEdit, onDelete, onBack }: {
  warehouse: Warehouse; canEdit: boolean
  onAdd: () => void; onEdit: (m: Material) => void
  onDelete: (m: Material) => void; onBack: () => void
}) {
  const { tenant, activeBranch } = useStore()
  const [materials, setMaterials]   = useState<Material[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [srcFilter, setSrc]         = useState<'الكل'|'كهرباء'|'خاص'>('الكل')
  const [statusFilter, setStatus]   = useState<'الكل'|'طبيعي'|'منخفض'|'نفدت'>('الكل')
  const [sortCol, setSortCol]       = useState<string>('name')
  const [sortDir, setSortDir]       = useState<'asc'|'desc'>('asc')
  const [selected, setSelected]     = useState<Set<number>>(new Set())
  const [deleting, setDeleting]     = useState(false)
  const searchTimeout               = useRef<any>(null)

  useEffect(() => { loadMaterials(1) }, [warehouse.id, srcFilter, statusFilter, sortCol, sortDir])
  useEffect(() => {
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => loadMaterials(1), 400)
    return () => clearTimeout(searchTimeout.current)
  }, [search])

  async function loadMaterials(p: number) {
    if (!tenant || !activeBranch) return
    setLoading(true)
    let query = supabase
      .from('materials')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .eq('branch_id', activeBranch.id)
      .eq('warehouse_id', warehouse.id)

    if (search) query = query.or(`name.ilike.%${search}%,catalog_no.ilike.%${search}%,sec_number.ilike.%${search}%`)
    if (srcFilter !== 'الكل') query = query.eq('source', srcFilter)
    if (statusFilter === 'نفدت') query = query.lte('qty', 0).eq('source', 'خاص')
    else if (statusFilter === 'منخفض') query = query.gt('qty', 0).lte('qty', 10).eq('source', 'خاص')
    else if (statusFilter === 'طبيعي') query = query.gt('qty', 10)

    const from = (p - 1) * PAGE_SIZE
    query = query.range(from, from + PAGE_SIZE - 1).order(sortCol, { ascending: sortDir === 'asc' })

    const { data, count } = await query
    setMaterials(data || [])
    setTotal(count || 0)
    setPage(p)
    setSelected(new Set())
    setLoading(false)
  }

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function toggleSelect(id: number) {
    setSelected(prev => { const s = new Set<number>(); prev.forEach(v => s.add(v)); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function toggleAll() {
    if (selected.size === materials.length) setSelected(new Set<number>())
    else { const s = new Set<number>(); materials.forEach(m => s.add(m.id)); setSelected(s) }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`حذف ${selected.size} مادة؟ هذا الإجراء لا يمكن التراجع عنه`)) return
    setDeleting(true)
    const ids = Array.from ? Array.from(selected) : ([] as number[]).concat(...[selected] as any)
    for (let i = 0; i < ids.length; i++) {
      await supabase.from('materials').delete().eq('id', ids[i])
    }
    setDeleting(false)
    setSelected(new Set())
    await loadMaterials(page)
    toast.success(`تم حذف ${selected.size} مادة ✅`)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const lowCount   = materials.filter(m => m.qty <= m.reorder).length

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <span className="text-gray-300 text-xs">↕</span>
    return <span className="text-primary-500 text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="btn btn-ghost btn-sm">
          <ArrowRight className="w-4 h-4" /> العودة
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <WarehouseIcon className="w-5 h-5 text-primary-500" />
            {warehouse.name}
          </h1>
          <p className="text-sm text-gray-400">
            {total} مادة
            {(warehouse as any).stock_type && <span className="mr-2 badge badge-blue text-xs">{(warehouse as any).stock_type}</span>}
            {lowCount > 0 && <span className="text-amber-500 mr-2">· {lowCount} منخفض</span>}
            {loading && <span className="w-3 h-3 border border-gray-300 border-t-gray-500 rounded-full animate-spin inline-block mr-1" />}
          </p>
        </div>
        {canEdit && (
          <button onClick={onAdd} className="btn btn-primary btn-sm">
            <Plus className="w-4 h-4" /> إضافة مادة
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input pr-9 text-sm" placeholder="بحث بالاسم أو الكود أو SEC..." />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['الكل','كهرباء','خاص'] as const).map(s => (
            <button key={s} onClick={() => setSrc(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${srcFilter === s ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400'}`}>
              {s === 'كهرباء' ? '⚡ SEC' : s === 'خاص' ? '🏢 خاص' : 'الكل'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['الكل','طبيعي','منخفض','نفدت'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${statusFilter === s ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400'}`}>
              {s === 'طبيعي' ? '✓ طبيعي' : s === 'منخفض' ? '⚠ منخفض' : s === 'نفدت' ? '⛔ نفدت' : 'الكل'}
            </button>
          ))}
        </div>
        {selected.size > 0 && canEdit && (
          <button onClick={handleBulkDelete} disabled={deleting}
            className="btn btn-sm gap-1.5 bg-red-500 hover:bg-red-600 text-white">
            {deleting ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            حذف {selected.size} مادة
          </button>
        )}
      </div>

      {/* الجدول */}
      {loading && materials.length === 0 ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
      ) : materials.length === 0 ? (
        <div className="card p-16 text-center">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">لا توجد مواد</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input type="checkbox"
                      checked={materials.length > 0 && selected.size === materials.length}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded cursor-pointer" />
                  </th>
                  <th onClick={() => toggleSort('source')} className="cursor-pointer hover:text-primary-600 select-none">
                    المصدر <SortIcon col="source" />
                  </th>
                  <th onClick={() => toggleSort('catalog_no')} className="cursor-pointer hover:text-primary-600 select-none">
                    الكود / SEC <SortIcon col="catalog_no" />
                  </th>
                  <th onClick={() => toggleSort('name')} className="cursor-pointer hover:text-primary-600 select-none">
                    المادة <SortIcon col="name" />
                  </th>
                  <th>الموقع</th>
                  <th onClick={() => toggleSort('qty')} className="cursor-pointer hover:text-primary-600 select-none">
                    الكمية <SortIcon col="qty" />
                  </th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {materials.map(m => {
                  const isLow   = m.qty <= m.reorder && m.qty > 0
                  const isEmpty = m.qty <= 0
                  return (
                    <tr key={m.id} className={selected.has(m.id) ? 'bg-primary-50/30' : ''}>
                      <td className="text-center">
                        <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)}
                          className="w-4 h-4 rounded cursor-pointer" />
                      </td>
                      <td>
                        <span className={`badge text-xs ${m.source === 'كهرباء' ? 'badge-blue' : 'badge-green'}`}>
                          {m.source === 'كهرباء' ? '⚡ SEC' : '🏢 خاص'}
                        </span>
                      </td>
                      <td>
                        <div className="font-mono text-xs text-gray-600">{m.catalog_no}</div>
                        {m.sec_number && <div className="text-xs text-blue-500 font-mono">{m.sec_number}</div>}
                      </td>
                      <td>
                        <div className="font-medium text-gray-800 text-sm">{m.name}</div>
                        {m.sku && <div className="text-xs text-gray-400">{m.sku}</div>}
                      </td>
                      <td className="text-gray-400 text-xs">{(m as any).location || '—'}</td>
                      <td className={`font-bold text-sm ${isEmpty ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-800'}`}>
                        {m.qty} <span className="text-gray-400 font-normal text-xs">{m.unit}</span>
                      </td>
                      <td>
                        <span className={`badge ${isEmpty ? 'badge-red' : isLow ? 'badge-amber' : 'badge-green'}`}>
                          {isEmpty ? '⛔ نفدت' : isLow ? '⚠ منخفض' : '✓ طبيعي'}
                        </span>
                      </td>
                      <td>
                        {canEdit && (
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => onEdit(m)} className="btn btn-ghost btn-xs"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onDelete(m)} className="btn btn-ghost btn-xs text-red-400 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between card p-3">
              <div className="text-sm text-gray-500">
                {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, total)} من {total} مادة
              </div>
              <div className="flex gap-1">
                <button onClick={() => loadMaterials(page-1)} disabled={page === 1}
                  className="btn btn-ghost btn-xs disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                  return (
                    <button key={p} onClick={() => loadMaterials(p)}
                      className={`btn btn-xs ${p === page ? 'btn-primary' : 'btn-ghost'}`}>
                      {p}
                    </button>
                  )
                })}
                <button onClick={() => loadMaterials(page+1)} disabled={page === totalPages}
                  className="btn btn-ghost btn-xs disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── الصفحة الرئيسية ───────────────────────────────────────────────
export default function InventoryPage() {
  const { tenant, activeBranch, materials, setMaterials, warehouses, setWarehouses, projects, currentUser } = useStore()
  const [loading, setLoading]       = useState(warehouses.length === 0)
  const [activeTab, setActiveTab]   = useState<'warehouses'|'ledger'|'byproject'>('warehouses')
  const [ledger, setLedger]         = useState<StockLedger[]>([])
  const [selectedWh, setSelectedWh] = useState<Warehouse|null>(null)
  // stats للكروت
  const [stats, setStats]           = useState({ total: 0, low: 0, empty: 0, sec: 0 })
  // modals
  const [showMatModal, setMatModal] = useState(false)
  const [editMat, setEditMat]       = useState<Material|null>(null)
  const [showWhModal, setWhModal]   = useState(false)
  const [showReceive, setReceive]   = useState(false)
  const [showDispatch, setDispatch] = useState(false)
  const [showImport, setImport]     = useState(false)
  const [showTransfer, setTransfer] = useState(false)
  const [showPurchase, setPurchase] = useState(false)
  const [showCheckModal, setCheckModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [lastReceiptData, setLastReceiptData] = useState<any>(null)
  const [lastDispatchData, setLastDispatchData] = useState<any>(null)
  const [projectLedger, setProjectLedger]     = useState<any[]>([])
  const [loadingProject, setLoadingProject]   = useState(false)

  const canEdit = currentUser?.permissions?.includes('inventory')

  useEffect(() => { loadData() }, [tenant?.id, activeBranch?.id])

  async function loadData() {
    if (!tenant || !activeBranch) return
    if (warehouses.length === 0) setLoading(true)
    // نجلب المستودعات فقط — المواد تُجلب عند فتح المستودع
    const { data: wData } = await warehousesApi.getAll(tenant.id, activeBranch.id)
    setWarehouses(wData || [])
    // نجلب إحصائيات المواد فقط (بدون تحميل المواد كلها)
    const { count: totalCount } = await supabase.from('materials').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id)
    const { count: lowCount }   = await supabase.from('materials').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).eq('source', 'خاص').filter('qty', 'lte', 'reorder')
    const { count: emptyCount } = await supabase.from('materials').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).eq('source', 'خاص').lte('qty', 0)
    const { count: secCount }   = await supabase.from('materials').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('branch_id', activeBranch.id).eq('source', 'كهرباء')
    setStats({ total: totalCount||0, low: lowCount||0, empty: emptyCount||0, sec: secCount||0 })
    // ملاحظة: low و empty تعتمد على المواد الخاصة فقط (source != كهرباء)
    setLoading(false)
  }

  async function loadLedger(force = false) {
    if (!tenant || !activeBranch) return
    if (!force && ledger.length > 0) return
    const { data } = await ledgerApi.getRecent(tenant.id, activeBranch.id)
    setLedger(data || [])
  }

  async function handleSaveMat(data: Partial<Material>) {
    if (!tenant || !activeBranch) return
    const { error } = await materialsApi.upsert({ ...data, tenant_id: tenant.id, branch_id: activeBranch.id })
    if (error) { toast.error('حدث خطأ في الحفظ'); return }
    await loadData()
    setMatModal(false); setEditMat(null)
    toast.success(editMat ? 'تم التعديل ✅' : 'تمت الإضافة ✅')
  }

  async function handleSaveWarehouse(data: Partial<Warehouse>) {
    if (!tenant || !activeBranch) return
    const { error } = await warehousesApi.upsert({ ...data, tenant_id: tenant.id, branch_id: activeBranch.id })
    if (error) { toast.error('حدث خطأ'); return }
    await loadData(); setWhModal(false)
    toast.success('تم إضافة المستودع ✅')
  }

  async function handleDelete(m: Material) {
    if (!confirm(`حذف "${m.name}"؟`)) return
    await materialsApi.delete(m.id)
    await loadData()
    toast.success('تم الحذف')
  }

  async function handleImport(rows: Partial<Material>[]) {
    if (!tenant || !activeBranch) return
    let success = 0
    for (const row of rows) {
      const { error } = await materialsApi.upsert({ ...row, tenant_id: tenant.id, branch_id: activeBranch.id })
      if (!error) success++
    }
    await loadData(); setImport(false)
    toast.success(`تم استيراد ${success} مادة ✅`)
  }

  async function handleReceive(rows: { mat: Material; qty: number; projectId: number|'' }[], vendor: string, reservationNo: string, exitPermitNo: string) {
    if (!tenant || !activeBranch) return
    for (const row of rows) {
      const newQty = row.mat.qty + row.qty
      const wh = warehouses.find(w => w.id === row.mat.warehouse_id)
      const projectName = (projects||[]).find(p => p.id === Number(row.projectId))?.name
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: 'توريد', mat_name: row.mat.name, unit: row.mat.unit,
        qty: row.qty, qty_before: row.mat.qty, qty_after: newQty,
        wh_name: wh?.name||'', vendor_name: vendor||undefined,
        project_name: projectName, clearance_no: exitPermitNo||undefined,
        doc_code: reservationNo||undefined,
      })
      await materialsApi.upsert({ ...row.mat, qty: newQty })
    }
    await loadData(); setReceive(false); await loadLedger(true)
    // حفظ بيانات للطباعة
    setLastReceiptData({
      type: 'receive', vendor, reservationNo, exitPermitNo,
      rows: rows.map(r => ({ name: r.mat.name, qty: r.qty, unit: r.mat.unit, project: (projects||[]).find(p=>p.id===Number(r.projectId))?.name||'—' })),
      date: new Date().toLocaleDateString('ar-EG'),
    })
    toast.success(`تم تسجيل استلام ${rows.length} مادة ✅`)
  }

  async function handleDispatch(rows: { mat: Material; qty: number; checked: boolean }[], projectName: string, note: string) {
    if (!tenant || !activeBranch) return
    for (const row of rows) {
      const newQty = row.mat.qty - row.qty
      const wh = warehouses.find(w => w.id === row.mat.warehouse_id)
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: 'صرف', mat_name: row.mat.name, unit: row.mat.unit,
        qty: row.qty, qty_before: row.mat.qty, qty_after: newQty,
        wh_name: wh?.name||'', project_name: projectName, dispatch_note: note||undefined
      })
      await materialsApi.upsert({ ...row.mat, qty: newQty })
    }
    await loadData(); setDispatch(false); await loadLedger(true)
    setLastDispatchData({
      type: 'dispatch', projectName,
      rows: rows.map(r => ({ name: r.mat.name, qty: r.qty, unit: r.mat.unit })),
      date: new Date().toLocaleDateString('ar-EG'), note,
    })
    toast.success(`تم صرف ${rows.length} مادة للمشروع "${projectName}" ✅`)
  }

  async function handleLoan(rows: { mat: Material; qty: number }[], fromProject: string, toProject: string, note: string) {
    if (!tenant || !activeBranch) return
    for (const row of rows) {
      const newQty = row.mat.qty - row.qty
      if (newQty < 0) { toast.error(`رصيد "${row.mat.name}" غير كافٍ`); return }
      const wh = warehouses.find(w => w.id === row.mat.warehouse_id)
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: 'صرف', mat_name: row.mat.name, unit: row.mat.unit,
        qty: row.qty, qty_before: row.mat.qty, qty_after: newQty,
        wh_name: wh?.name||'', project_name: toProject,
        dispatch_note: `استعارة من مشروع: ${fromProject}${note ? ' — '+note : ''}`,
        loan_from_project: fromProject, loan_to_project: toProject, is_loan: true,
      } as any)
      await materialsApi.upsert({ ...row.mat, qty: newQty })
    }
    await loadData(); setDispatch(false); await loadLedger(true)
    toast.success(`تم تسجيل استعارة ${rows.length} مادة ✅`)
  }

  const projectsList = (projects||[]).map(p => ({ id: p.id, name: p.name }))

  async function loadProjectLedger(projectName: string) {
    if (!tenant || !activeBranch || !projectName) { setProjectLedger([]); return }
    setLoadingProject(true)
    const { data } = await supabase
      .from('stock_ledger')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('project_name', projectName)
      .order('created_at', { ascending: false })
    setProjectLedger(data || [])
    setLoadingProject(false)
  }

  async function handleTransfer(rows: { mat: Material; qty: number }[], fromWh: Warehouse, toWh: Warehouse, projectName: string, confirmCode: string) {
    if (!tenant || !activeBranch) return
    for (const row of rows) {
      const newQty = row.mat.qty - row.qty
      if (newQty < 0) { toast.error(`رصيد "${row.mat.name}" غير كافٍ`); return }
      // تسجيل خروج من المستودع الأول
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: 'نقل مخزني', mat_name: row.mat.name, unit: row.mat.unit,
        qty: row.qty, qty_before: row.mat.qty, qty_after: newQty,
        wh_name: fromWh.name, project_name: projectName || undefined,
        dispatch_note: `تحويل إلى: ${toWh.name}`,
      })
      // تحديث الكمية في المستودع الأول
      await materialsApi.upsert({ ...row.mat, qty: newQty })
      // إضافة للمستودع الثاني (نفس المادة بمستودع مختلف)
      const { data: existMat } = await supabase.from('materials').select('*')
        .eq('tenant_id', tenant.id).eq('warehouse_id', toWh.id).eq('name', row.mat.name).single()
      if (existMat) {
        await materialsApi.upsert({ ...existMat, qty: existMat.qty + row.qty })
      } else {
        await materialsApi.upsert({ ...row.mat, id: undefined, warehouse_id: toWh.id, qty: row.qty } as any)
      }
    }
    await loadData(); setTransfer(false); await loadLedger(true)
    toast.success(`تم تحويل ${rows.length} مادة من "${fromWh.name}" إلى "${toWh.name}" ✅`)
  }

  async function handlePurchaseRequest(data: any) {
    if (!tenant || !activeBranch) return
    // نحفظ طلب الشراء في جدول purchases
    const items = data.rows.map((r: any) => `${r.matName} x ${r.qty} ${r.unit}${r.reason ? ' ('+r.reason+')' : ''}`).join('\n')
    const { error } = await supabase.from('purchases').insert({
      tenant_id: tenant.id, branch_id: activeBranch.id,
      vendor: data.vendor || undefined,
      items, notes: `${data.purpose}${data.notes ? ' — '+data.notes : ''}`,
      status: 'طلب شراء', date: new Date().toISOString().split('T')[0],
      project_id: data.projectId || undefined,
    })
    if (error) { toast.error('حدث خطأ في الحفظ'); return }
    setPurchase(false)
    toast.success('تم إرسال طلب الشراء ✅')
  }

  async function handleInventoryCheck(warehouseId: number, items: { matId: number; matName: string; systemQty: number; actualQty: number; unit: string }[]) {
    if (!tenant || !activeBranch) return
    const changed = items.filter(i => i.actualQty !== i.systemQty)
    for (const item of changed) {
      const diff = item.actualQty - item.systemQty
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: diff > 0 ? 'توريد' : 'صرف',
        mat_name: item.matName, unit: item.unit,
        qty: Math.abs(diff), qty_before: item.systemQty, qty_after: item.actualQty,
        wh_name: warehouses.find(w => w.id === warehouseId)?.name || '',
        dispatch_note: 'تسوية جرد',
      })
      await supabase.from('materials').update({ qty: item.actualQty }).eq('id', item.matId)
    }
    await loadData(); setCheckModal(false); await loadLedger(true)
    toast.success(`تم تأكيد الجرد — ${changed.length} مادة تم تسويتها ✅`)
  }

  // ── عرض مستودع محدد ──
  if (selectedWh) {
    return (
      <>
        <WarehouseMaterialsTable
          warehouse={selectedWh} canEdit={!!canEdit}
          onBack={() => { setSelectedWh(null); loadData() }}
          onAdd={() => { setEditMat(null); setMatModal(true) }}
          onEdit={(m) => { setEditMat(m); setMatModal(true) }}
          onDelete={handleDelete}
        />
        {showMatModal && (
          <MaterialModal mat={editMat} warehouses={warehouses}
            onClose={() => { setMatModal(false); setEditMat(null) }}
            onSave={handleSaveMat} />
        )}
      </>
    )
  }

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-500" />
            إدارة المخزون
          </h1>
          <p className="text-gray-400 text-sm mt-0.5 flex items-center gap-2">
            {warehouses.length} مستودع · {stats.total} مادة
            {loading && <span className="w-3 h-3 border border-gray-300 border-t-gray-500 rounded-full animate-spin inline-block" />}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setWhModal(true)} className="btn btn-ghost btn-sm border border-gray-200 gap-1.5">
              <WarehouseIcon className="w-4 h-4" /> مستودع
            </button>
            <button onClick={() => setImport(true)} className="btn btn-ghost btn-sm border border-emerald-200 text-emerald-600 hover:bg-emerald-50 gap-1.5">
              <FileSpreadsheet className="w-4 h-4" /> استيراد
            </button>
            <button onClick={() => { setEditMat(null); setMatModal(true) }} className="btn btn-primary btn-sm gap-1.5">
              <Plus className="w-4 h-4" /> إضافة مادة
            </button>
          </div>
        )}
      </div>

      {/* KPIs — تظهر فوراً */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
          <div className="text-xs text-gray-400 mt-0.5">إجمالي المواد</div>
        </div>
        <div className={`card p-4 text-center ${stats.low>0?'border-amber-200 bg-amber-50/50':''}`}>
          <div className={`text-2xl font-bold ${stats.low>0?'text-amber-600':'text-gray-800'}`}>{stats.low}</div>
          <div className="text-xs text-gray-400 mt-0.5">خاص — تحت حد الأمان</div>
        </div>
        <div className={`card p-4 text-center ${stats.empty>0?'border-red-200 bg-red-50/50':''}`}>
          <div className={`text-2xl font-bold ${stats.empty>0?'text-red-600':'text-gray-800'}`}>{stats.empty}</div>
          <div className="text-xs text-gray-400 mt-0.5">خاص — نفدت</div>
        </div>
        <div className="card p-4 text-center border-blue-100 bg-blue-50/30">
          <div className="text-2xl font-bold text-blue-600">{stats.sec}</div>
          <div className="text-xs text-gray-400 mt-0.5">⚡ مواد SEC</div>
        </div>
      </div>

      {/* تابات العمليات الكبيرة */}
      {canEdit && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { id:'receive',  icon:<ArrowDownToLine className="w-6 h-6"/>, label:'استلام مواد',       sub:'توريد جديد',            color:'bg-emerald-500 hover:bg-emerald-600', onClick:()=>setReceive(true) },
            { id:'dispatch', icon:<ArrowUpFromLine className="w-6 h-6"/>,  label:'صرف مواد',         sub:'للمشاريع',              color:'bg-red-500 hover:bg-red-600',         onClick:()=>setDispatch(true) },
            { id:'transfer', icon:<ArrowLeftRight className="w-6 h-6"/>,   label:'تحويل',            sub:'بين المستودعات',        color:'bg-blue-500 hover:bg-blue-600',       onClick:()=>setTransfer(true) },
            { id:'purchase', icon:<ShoppingCart className="w-6 h-6"/>,     label:'طلب شراء',         sub:'مواد تالفة أو خاصة',   color:'bg-purple-500 hover:bg-purple-600',   onClick:()=>setPurchase(true) },
            { id:'check',    icon:<ClipboardCheck className="w-6 h-6"/>,   label:'جرد مستودع',       sub:'مطابقة الكميات',        color:'bg-orange-500 hover:bg-orange-600',   onClick:()=>setCheckModal(true) },
          ].map(op => (
            <button key={op.id} onClick={op.onClick}
              className={`${op.color} text-white rounded-2xl p-4 flex items-center gap-3 transition-all hover:shadow-lg active:scale-95`}>
              <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                {op.icon}
              </div>
              <div className="text-right">
                <div className="font-bold text-sm">{op.label}</div>
                <div className="text-xs text-white/70">{op.sub}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id:'warehouses', label:'🏭 المستودعات' },
          { id:'ledger',     label:'📋 سجل الحركات',   onSelect: () => loadLedger() },
          { id:'byproject',  label:'📊 مواد المشاريع', onSelect: () => loadLedger() },
        ].map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id as any); (t as any).onSelect?.() }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab===t.id?'bg-white shadow-sm text-primary-600':'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* بطاقات المستودعات */}
      {activeTab === 'warehouses' && (
        loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
        ) : warehouses.length === 0 ? (
          <div className="card p-16 text-center">
            <WarehouseIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 mb-3">لا توجد مستودعات</p>
            {canEdit && <button onClick={() => setWhModal(true)} className="btn btn-primary btn-sm mx-auto"><Plus className="w-4 h-4" /> إضافة مستودع</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {warehouses.map(wh => (
              <div key={wh.id} className="card p-5 transition-all hover:shadow-lg">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <WarehouseIcon className="w-6 h-6 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">{wh.name}</h3>
                      {wh.location && <p className="text-xs text-gray-400 mt-0.5">📍 {wh.location}</p>}
                      {(wh as any).stock_type && (
                        <span className={`badge text-xs mt-0.5 ${(wh as any).stock_type === 'SEC' ? 'badge-blue' : (wh as any).stock_type === 'خاص' ? 'badge-green' : 'badge-gray'}`}>
                          {(wh as any).stock_type === 'SEC' ? '⚡ مواد SEC' : (wh as any).stock_type === 'خاص' ? '🏢 مواد خاصة' : '🏭 مختلط'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedWh(wh)} className="btn btn-primary w-full justify-between gap-2">
                  <Eye className="w-4 h-4" />
                  <span className="flex-1 text-center">عرض المواد</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* سجل الحركات */}
      {activeTab === 'ledger' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>النوع</th><th>المادة</th><th>الكمية</th>
                <th>المستودع</th><th>المشروع</th>
                <th>رقم الحجز</th><th>إذن الخروج</th>
                <th>المورد / الملاحظة</th><th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">لا توجد حركات</td></tr>
              ) : ledger.map(l => (
                <tr key={l.id}>
                  <td>
                    <span className={`badge ${TX_COLORS[l.type]||'badge-gray'}`}>{l.type}</span>
                    {(l as any).is_loan && <span className="badge badge-amber text-xs mr-1">🔄</span>}
                  </td>
                  <td className="font-medium text-gray-800 text-sm">{l.mat_name}</td>
                  <td className="font-bold text-sm">{l.qty} {l.unit}</td>
                  <td className="text-gray-500 text-sm">{l.wh_name}</td>
                  <td className="text-gray-500 text-sm">{l.project_name||'—'}</td>
                  <td className="text-gray-500 text-xs font-mono">{(l as any).doc_code||'—'}</td>
                  <td className="text-gray-500 text-xs font-mono">{(l as any).clearance_no||'—'}</td>
                  <td className="text-gray-500 text-sm">{(l as any).vendor_name||(l as any).dispatch_note||'—'}</td>
                  <td className="text-gray-400 text-xs">{formatDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* مواد المشاريع */}
      {activeTab === 'byproject' && (() => {
        // حساب مواد المشروع من projectLedger
        const matMap: Record<string,{matName:string;unit:string;totalIn:number;totalOut:number;net:number}> = {}
        projectLedger.forEach(l => {
          if (!matMap[l.mat_name]) matMap[l.mat_name] = { matName:l.mat_name, unit:l.unit, totalIn:0, totalOut:0, net:0 }
          const isIn = l.type === 'توريد'
          if (isIn) matMap[l.mat_name].totalIn += l.qty
          else matMap[l.mat_name].totalOut += l.qty
          matMap[l.mat_name].net = matMap[l.mat_name].totalIn - matMap[l.mat_name].totalOut
        })
        const mats = Object.values(matMap)

        return (
          <div className="space-y-4">
            {/* اختيار المشروع */}
            <div className="card p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm font-medium text-gray-700 flex-shrink-0">اختر مشروعاً:</label>
                <select
                  value={selectedProject}
                  onChange={e => { setSelectedProject(e.target.value); loadProjectLedger(e.target.value) }}
                  className="select flex-1 min-w-48">
                  <option value="">— اختر مشروعاً لعرض مواده —</option>
                  {(projects||[]).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
                {selectedProject && (
                  <button onClick={() => { setSelectedProject(''); setProjectLedger([]) }}
                    className="btn btn-ghost btn-sm text-gray-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* النتائج */}
            {!selectedProject ? (
              <div className="card p-12 text-center">
                <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400">اختر مشروعاً من القائمة أعلاه لعرض مواده</p>
              </div>
            ) : loadingProject ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
              </div>
            ) : mats.length === 0 ? (
              <div className="card p-12 text-center">
                <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد حركات مخزون لهذا المشروع</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                {/* رأس الجدول */}
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-primary-50/30">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📁</span>
                    <h3 className="font-bold text-primary-700">{selectedProject}</h3>
                    <span className="badge badge-blue text-xs">{mats.length} مادة</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>وارد: <span className="font-bold text-emerald-600">{mats.reduce((s,m)=>s+m.totalIn,0)}</span></span>
                      <span>صادر: <span className="font-bold text-red-600">{mats.reduce((s,m)=>s+m.totalOut,0)}</span></span>
                      <span>الرصيد: <span className="font-bold text-blue-600">{mats.reduce((s,m)=>s+m.net,0)}</span></span>
                    </div>
                    <button
                      onClick={() => printInventoryReport(
                        `عهدة مشروع: ${selectedProject}`,
                        'مواد المشروع',
                        (tenant as any)?.name || 'وثيق ERP',
                        ['المادة','الوارد','الصادر','الرصيد','الوحدة'],
                        mats.map(m => [m.matName, m.totalIn, m.totalOut, m.net, m.unit])
                      )}
                      className="btn btn-ghost btn-xs gap-1 border border-gray-200 hover:border-primary-300 hover:text-primary-600">
                      🖨️ طباعة
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600">المادة</th>
                        <th className="text-center px-4 py-2 text-xs font-semibold text-emerald-600">وارد</th>
                        <th className="text-center px-4 py-2 text-xs font-semibold text-red-600">صادر</th>
                        <th className="text-center px-4 py-2 text-xs font-semibold text-blue-600">الرصيد</th>
                        <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">الوحدة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {mats.map((m,i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{m.matName}</td>
                          <td className="px-4 py-2.5 text-center text-emerald-600 font-bold">{m.totalIn||'—'}</td>
                          <td className="px-4 py-2.5 text-center text-red-600 font-bold">{m.totalOut||'—'}</td>
                          <td className={`px-4 py-2.5 text-center font-bold ${m.net<0?'text-red-600':m.net===0?'text-gray-400':'text-blue-600'}`}>{m.net}</td>
                          <td className="px-4 py-2.5 text-center text-gray-400">{m.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary-50 border-t-2 border-primary-100">
                        <td className="px-4 py-2 font-bold text-primary-700 text-sm">الإجمالي</td>
                        <td className="px-4 py-2 text-center font-bold text-emerald-600">{mats.reduce((s,m)=>s+m.totalIn,0)}</td>
                        <td className="px-4 py-2 text-center font-bold text-red-600">{mats.reduce((s,m)=>s+m.totalOut,0)}</td>
                        <td className="px-4 py-2 text-center font-bold text-blue-600">{mats.reduce((s,m)=>s+m.net,0)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Modals */}
      {showMatModal && <MaterialModal mat={editMat} warehouses={warehouses} onClose={() => { setMatModal(false); setEditMat(null) }} onSave={handleSaveMat} />}
      {showWhModal  && <WarehouseModal onClose={() => setWhModal(false)} onSave={handleSaveWarehouse} />}
      {showImport   && <ImportModal warehouses={warehouses} onClose={() => setImport(false)} onImport={handleImport} />}
      {showReceive  && <ReceiveModal materials={materials} warehouses={warehouses} projects={projectsList} onClose={() => setReceive(false)} onSave={handleReceive} />}
      {/* وصل الاستلام */}
      {lastReceiptData && (
        <div className="modal-overlay" onClick={() => setLastReceiptData(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">✅ تم الاستلام بنجاح</h3>
              <button onClick={() => setLastReceiptData(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="modal-body">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {lastReceiptData.vendor && <div><span className="text-gray-500">المورد:</span> <span className="font-medium">{lastReceiptData.vendor}</span></div>}
                  {lastReceiptData.reservationNo && <div><span className="text-gray-500">رقم الحجز:</span> <span className="font-medium font-mono">{lastReceiptData.reservationNo}</span></div>}
                  {lastReceiptData.exitPermitNo && <div><span className="text-gray-500">إذن الخروج:</span> <span className="font-medium font-mono">{lastReceiptData.exitPermitNo}</span></div>}
                  <div><span className="text-gray-500">التاريخ:</span> <span className="font-medium">{lastReceiptData.date}</span></div>
                </div>
              </div>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">المادة</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">الكمية</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">الوحدة</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">المشروع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lastReceiptData.rows.map((r: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                        <td className="px-3 py-2 text-center font-bold text-emerald-600">{r.qty}</td>
                        <td className="px-3 py-2 text-center text-gray-500">{r.unit}</td>
                        <td className="px-3 py-2 text-gray-500">{r.project}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setLastReceiptData(null)} className="btn btn-ghost">إغلاق</button>
              <button onClick={() => printInventoryReport(
                'وصل استلام مواد',
                `${lastReceiptData.vendor ? 'المورد: ' + lastReceiptData.vendor : ''} ${lastReceiptData.reservationNo ? '| رقم الحجز: ' + lastReceiptData.reservationNo : ''}`,
                (tenant as any)?.name || 'وثيق ERP',
                ['المادة','الكمية','الوحدة','المشروع'],
                lastReceiptData.rows.map((r: any) => [r.name, r.qty, r.unit, r.project])
              )} className="btn btn-primary gap-2">
                🖨️ طباعة وصل الاستلام
              </button>
            </div>
          </div>
        </div>
      )}
      {showDispatch && <DispatchModal materials={materials} projects={projectsList} onClose={() => setDispatch(false)} onSave={handleDispatch} onLoan={handleLoan} />}
      {/* وصل الصرف */}
      {lastDispatchData && (
        <div className="modal-overlay" onClick={() => setLastDispatchData(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">✅ تم الصرف بنجاح</h3>
              <button onClick={() => setLastDispatchData(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="modal-body">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">المشروع:</span> <span className="font-bold text-red-700">{lastDispatchData.projectName}</span></div>
                  <div><span className="text-gray-500">التاريخ:</span> <span className="font-medium">{lastDispatchData.date}</span></div>
                  {lastDispatchData.note && <div className="col-span-2"><span className="text-gray-500">ملاحظة:</span> <span className="font-medium">{lastDispatchData.note}</span></div>}
                </div>
              </div>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">المادة</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">الكمية المصروفة</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">الوحدة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lastDispatchData.rows.map((r: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                        <td className="px-3 py-2 text-center font-bold text-red-600">{r.qty}</td>
                        <td className="px-3 py-2 text-center text-gray-500">{r.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setLastDispatchData(null)} className="btn btn-ghost">إغلاق</button>
              <button onClick={() => printInventoryReport(
                'وصل صرف مواد',
                `المشروع: ${lastDispatchData.projectName}${lastDispatchData.note ? ' | ' + lastDispatchData.note : ''}`,
                (tenant as any)?.name || 'وثيق ERP',
                ['المادة','الكمية المصروفة','الوحدة'],
                lastDispatchData.rows.map((r: any) => [r.name, r.qty, r.unit])
              )} className="btn btn-primary gap-2" style={{background:'#ef4444'}}>
                🖨️ طباعة وصل الصرف
              </button>
            </div>
          </div>
        </div>
      )}
      {showTransfer && <TransferModal materials={materials} warehouses={warehouses} projects={projectsList} onClose={() => setTransfer(false)} onSave={handleTransfer} />}
      {showPurchase && <PurchaseRequestModal materials={materials} warehouses={warehouses} projects={projectsList} onClose={() => setPurchase(false)} onSave={handlePurchaseRequest} />}
      {showCheckModal && <InventoryCheckModal warehouses={warehouses} tenant={tenant} activeBranch={activeBranch} onClose={() => setCheckModal(false)} onSave={handleInventoryCheck} />}
    </div>
  )
}
