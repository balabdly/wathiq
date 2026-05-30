'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  Shield, Plus, Search, Upload, Trash2, Eye,
  FileText, AlertTriangle, CheckCircle2, Clock, X, Download
} from 'lucide-react'
import type { QhseDoc, QhseSection } from '@/types'
import toast from 'react-hot-toast'

const DEFAULT_CATEGORIES = ['سياسات', 'إجراءات', 'نماذج', 'تصاريح', 'شهادات', 'خطط الطوارئ']

function DocModal({ doc, categories, onClose, onSave }: {
  doc: QhseDoc | null
  categories: string[]
  onClose: () => void
  onSave: (data: Partial<QhseDoc>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [form, setForm] = useState({
    name:        doc?.name        || '',
    category:    doc?.category    || categories[0] || 'سياسات',
    doc_number:  doc?.doc_number  || '',
    issue_date:  doc?.issue_date  || '',
    expiry_date: doc?.expiry_date || '',
    notes:       doc?.notes       || '',
  })
  const [fileData, setFileData]   = useState<string | null>(null)
  const [fileName, setFileName]   = useState(doc?.file_name || '')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => { setFileData(ev.target?.result as string); setFileName(f.name) }
    reader.readAsDataURL(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await onSave({
      ...(doc ? { id: doc.id } : {}),
      name:        form.name,
      category:    newCat || form.category,
      doc_number:  form.doc_number  || undefined,
      issue_date:  form.issue_date  || undefined,
      expiry_date: form.expiry_date || undefined,
      notes:       form.notes       || undefined,
      file_url:    fileData         || doc?.file_url,
      file_name:   fileName         || undefined,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{doc ? 'تعديل وثيقة' : 'إضافة وثيقة'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الوثيقة <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: سياسة السلامة العامة" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">التصنيف</label>
                <select value={newCat || form.category} onChange={e => { if (e.target.value === '__new__') setNewCat(''); else { setNewCat(''); set('category', e.target.value) } }} className="select">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__new__">+ تصنيف جديد</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الوثيقة</label>
                <input value={form.doc_number} onChange={e => set('doc_number', e.target.value)} className="input" placeholder="مثال: QMS-001" />
              </div>
            </div>
            {newCat !== null && form.category === (newCat || form.category) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم التصنيف الجديد</label>
                <input value={newCat} onChange={e => setNewCat(e.target.value)} className="input" placeholder="اسم التصنيف" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الإصدار</label>
                <input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الانتهاء</label>
                <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الملف (اختياري)</label>
              <label className={`flex items-center gap-3 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${fileName ? 'border-primary-400 bg-primary-50/50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}>
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-500">{fileName || 'انقر لرفع ملف PDF أو صورة'}</span>
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFile} />
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input min-h-[70px] resize-none" placeholder="ملاحظات..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {doc ? 'حفظ التعديلات' : 'إضافة الوثيقة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function getDocStatus(doc: QhseDoc): 'expired' | 'soon' | 'valid' | 'none' {
  if (!doc.expiry_date) return 'none'
  const now = new Date(); now.setHours(0,0,0,0)
  const exp = new Date(doc.expiry_date); exp.setHours(0,0,0,0)
  const diff = Math.round((exp.getTime() - now.getTime()) / 86400000)
  if (diff < 0)   return 'expired'
  if (diff <= 30) return 'soon'
  return 'valid'
}

export default function QhsePage() {
  const { tenant, activeBranch, currentUser } = useStore()
  const [loading, setLoading]       = useState(true)
  const [docs, setDocs]             = useState<QhseDoc[]>([])
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState('')
  const [statusFilter, setStatus]   = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [editDoc, setEditDoc]       = useState<QhseDoc | null>(null)

  const canEdit = currentUser?.permissions?.includes('qhse')

  useEffect(() => { loadDocs() }, [tenant?.id, activeBranch?.id])

  async function loadDocs() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const { data } = await supabase
      .from('tenants')
      .select('qhse_section')
      .eq('id', tenant.id)
      .single()
    const section: QhseSection = data?.qhse_section || { docs: [], custom_categories: [] }
    setDocs(section.docs || [])
    const allCats = [...DEFAULT_CATEGORIES, ...(section.custom_categories || [])]
    setCategories(Array.from(new Set(allCats)))
    setLoading(false)
  }

  async function saveDocs(newDocs: QhseDoc[], newCats?: string[]) {
    if (!tenant) return
    const { data } = await supabase.from('tenants').select('qhse_section').eq('id', tenant.id).single()
    const section: QhseSection = data?.qhse_section || { docs: [], custom_categories: [] }
    const cats = newCats || section.custom_categories || []
    await supabase.from('tenants').update({
      qhse_section: { ...section, docs: newDocs, custom_categories: cats }
    }).eq('id', tenant.id)
    setDocs(newDocs)
  }

  async function handleSave(data: Partial<QhseDoc>) {
    const now = new Date().toISOString()
    let newDocs: QhseDoc[]
    let newCats = categories.filter(c => !DEFAULT_CATEGORIES.includes(c))
    if (data.category && !categories.includes(data.category)) {
      newCats = [...newCats, data.category]
      setCategories([...DEFAULT_CATEGORIES, ...newCats])
    }
    if (editDoc) {
      newDocs = docs.map(d => d.id === editDoc.id ? { ...d, ...data } as QhseDoc : d)
    } else {
      const newDoc: QhseDoc = {
        id: `doc_${Date.now()}`,
        added_by: currentUser?.name || '',
        added_at: now,
        ...data,
      } as QhseDoc
      newDocs = [newDoc, ...docs]
    }
    await saveDocs(newDocs, newCats)
    setShowModal(false)
    setEditDoc(null)
    toast.success(editDoc ? 'تم التعديل' : 'تمت الإضافة')
  }

  async function handleDelete(doc: QhseDoc) {
    if (!confirm(`حذف "${doc.name}"؟`)) return
    await saveDocs(docs.filter(d => d.id !== doc.id))
    toast.success('تم الحذف')
  }

  const filtered = docs.filter(d => {
    const q = search.toLowerCase()
    const matchS  = !q || d.name.toLowerCase().includes(q) || (d.doc_number||'').toLowerCase().includes(q)
    const matchC  = !catFilter    || d.category === catFilter
    const matchSt = !statusFilter || getDocStatus(d) === statusFilter
    return matchS && matchC && matchSt
  })

  const expiredCount  = docs.filter(d => getDocStatus(d) === 'expired').length
  const soonCount     = docs.filter(d => getDocStatus(d) === 'soon').length

  const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    expired: { label: 'منتهية', cls: 'badge-red' },
    soon:    { label: 'تنتهي قريباً', cls: 'badge-amber' },
    valid:   { label: 'سارية', cls: 'badge-green' },
    none:    { label: 'بلا تاريخ', cls: 'badge-gray' },
  }

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-500" />
            السلامة والجودة QHSE
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">{filtered.length} وثيقة</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditDoc(null); setShowModal(true) }} className="btn btn-primary">
            <Plus className="w-4 h-4" /> إضافة وثيقة
          </button>
        )}
      </div>

      {/* Alerts */}
      {(expiredCount > 0 || soonCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {expiredCount > 0 && (
            <div className="card p-4 border-red-200 bg-red-50/50 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm text-red-800">{expiredCount} وثيقة منتهية الصلاحية</div>
                <div className="text-xs text-red-600 mt-0.5">تحتاج تجديد فوري</div>
              </div>
            </div>
          )}
          {soonCount > 0 && (
            <div className="card p-4 border-amber-200 bg-amber-50/50 flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm text-amber-800">{soonCount} وثيقة تنتهي خلال 30 يوماً</div>
                <div className="text-xs text-amber-600 mt-0.5">يُنصح بالتجديد قريباً</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input pr-9 text-sm" placeholder="بحث بالاسم أو الرقم..." />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="select w-auto text-sm">
          <option value="">كل التصنيفات</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="select w-auto text-sm">
          <option value="">كل الحالات</option>
          <option value="expired">منتهية</option>
          <option value="soon">تنتهي قريباً</option>
          <option value="valid">سارية</option>
          <option value="none">بلا تاريخ</option>
        </select>
      </div>

      {/* Docs list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <Shield className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">لا توجد وثائق</p>
          {canEdit && (
            <button onClick={() => { setEditDoc(null); setShowModal(true) }} className="btn btn-primary mt-4 mx-auto">
              <Plus className="w-4 h-4" /> إضافة وثيقة
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(doc => {
            const st = getDocStatus(doc)
            const s  = STATUS_LABELS[st]
            return (
              <div key={doc.id} className={`card p-4 hover:shadow-md transition-all ${st === 'expired' ? 'border-red-200' : st === 'soon' ? 'border-amber-200' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="badge badge-blue text-xs">{doc.category}</span>
                      {doc.doc_number && <span className="badge badge-gray text-xs">{doc.doc_number}</span>}
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2">{doc.name}</h3>
                  </div>
                  <span className={`badge ${s.cls} text-xs flex-shrink-0`}>{s.label}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                  {doc.issue_date && (
                    <div><span className="text-gray-400">الإصدار</span><div className="font-medium text-gray-700">{formatDate(doc.issue_date)}</div></div>
                  )}
                  {doc.expiry_date && (
                    <div><span className="text-gray-400">الانتهاء</span><div className={`font-medium ${st === 'expired' ? 'text-red-600' : st === 'soon' ? 'text-amber-600' : 'text-gray-700'}`}>{formatDate(doc.expiry_date)}</div></div>
                  )}
                </div>

                {doc.notes && <p className="text-xs text-gray-400 line-clamp-2 mb-3">{doc.notes}</p>}

                <div className="flex gap-2 pt-3 border-t border-gray-50">
                  {doc.file_url && (
                    <a href={doc.file_url} download={doc.file_name} className="btn btn-ghost btn-sm flex-1 justify-center">
                      <Download className="w-3.5 h-3.5" /> تنزيل
                    </a>
                  )}
                  {canEdit && <>
                    <button onClick={() => { setEditDoc(doc); setShowModal(true) }} className="btn btn-ghost btn-sm px-2.5">
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(doc)} className="btn btn-ghost btn-sm px-2.5 text-red-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <DocModal
          doc={editDoc}
          categories={categories}
          onClose={() => { setShowModal(false); setEditDoc(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
