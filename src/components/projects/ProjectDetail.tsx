'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { projectsApi } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, daysUntil, PROJECT_STAGES } from '@/lib/utils'
import {
  ArrowRight, Pencil, Upload, CheckCircle2, Clock, AlertTriangle,
  Package, TrendingDown, TrendingUp, ArrowLeftRight,
  Paperclip, Trash2, Download, FileText, Image, File, X
} from 'lucide-react'
import type { Project, ProjectStage } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  project: Project; onBack: () => void
  onEdit: (p: Project) => void; onRefresh: () => void
}

type Attachment = {
  id: number; file_name: string; file_path: string
  file_size: number; file_type: string; category: string
  created_at: string; public_url?: string
}

const CATEGORIES = ['مخططات','رخصة بلدية','إخلاء بلدية','مستخلصات','فواتير','صور الموقع','أخرى']

// المستندات الإلزامية لإغلاق المشروع
const REQUIRED_DOCS = [
  { category: 'مخططات',     label: 'مخططات المشروع',  icon: '📐' },
  { category: 'رخصة بلدية', label: 'رخصة البلدية',     icon: '📋' },
  { category: 'إخلاء بلدية',label: 'إخلاء البلدية',    icon: '📋' },
  { category: 'مستخلصات',   label: 'المستخلص',          icon: '📄' },
  { category: 'فواتير',      label: 'الفاتورة',          icon: '🧾' },
]

function fileIcon(type: string) {
  if (type?.startsWith('image/')) return <Image style={{ width: '16px', height: '16px', color: '#0ea77b' }} />
  if (type?.includes('pdf')) return <FileText style={{ width: '16px', height: '16px', color: '#c81e1e' }} />
  return <File style={{ width: '16px', height: '16px', color: '#1a56db' }} />
}

function formatSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ══════════════════════════════════════
// تاب المرفقات
// ══════════════════════════════════════
function AttachmentsTab({ project, tenant }: { project: Project; tenant: any }) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading]         = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [category, setCategory]       = useState('أخرى')
  const [dragOver, setDragOver]       = useState(false)

  useEffect(() => { loadAttachments() }, [project.id])

  async function loadAttachments() {
    if (!tenant) return
    setLoading(true)
    const { data } = await supabase
      .from('project_attachments')
      .select('*')
      .eq('project_id', project.id)
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })

    // جلب الـ signed URLs
    const withUrls = await Promise.all((data || []).map(async (a: Attachment) => {
      const { data: urlData } = await supabase.storage
        .from('project-attachments')
        .createSignedUrl(a.file_path, 3600)
      return { ...a, public_url: urlData?.signedUrl }
    }))
    setAttachments(withUrls)
    setLoading(false)
  }

  async function handleUpload(files: FileList | null) {
    if (!files || !tenant) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const filePath = `${tenant.id}/${project.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('project-attachments')
        .upload(filePath, file)

      if (uploadError) { toast.error(`خطأ في رفع ${file.name}: ${uploadError.message}`); continue }

      const { error: dbError } = await supabase.from('project_attachments').insert({
        tenant_id: tenant.id,
        project_id: project.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        category,
      })
      if (dbError) toast.error(`خطأ في حفظ ${file.name}`)
      else toast.success(`✅ تم رفع ${file.name}`)
    }
    await loadAttachments()
    setUploading(false)
  }

  async function handleDelete(a: Attachment) {
    if (!confirm(`حذف "${a.file_name}"؟`)) return
    await supabase.storage.from('project-attachments').remove([a.file_path])
    await supabase.from('project_attachments').delete().eq('id', a.id)
    setAttachments(prev => prev.filter(x => x.id !== a.id))
    toast.success('تم الحذف')
  }

  // تجميع حسب الفئة
  const byCategory: Record<string, Attachment[]> = {}
  attachments.forEach(a => {
    if (!byCategory[a.category]) byCategory[a.category] = []
    byCategory[a.category].push(a)
  })

  return (
    <div className="space-y-4">
      {/* منطقة الرفع */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files) }}
        style={{
          border: `2px dashed ${dragOver ? '#1a56db' : '#d1d5db'}`,
          borderRadius: '12px', padding: '24px',
          textAlign: 'center', background: dragOver ? '#eff6ff' : '#fafafa',
          transition: 'all 0.2s',
        }}>
        <Upload style={{ width: '32px', height: '32px', color: dragOver ? '#1a56db' : '#9ca3af', margin: '0 auto 10px' }} />
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '12px' }}>
          اسحب الملفات هنا أو
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={category} onChange={e => setCategory(e.target.value)} className="select" style={{ width: 'auto' }}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={{ cursor: 'pointer' }}>
            <input type="file" multiple onChange={e => handleUpload(e.target.files)} style={{ display: 'none' }} />
            <span className="btn btn-primary" style={{ pointerEvents: 'none' }}>
              {uploading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload style={{ width: '15px', height: '15px' }} />}
              اختر ملفات
            </span>
          </label>
        </div>
      </div>

      {/* قائمة المرفقات */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : attachments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '0.875rem' }}>
          <Paperclip style={{ width: '36px', height: '36px', margin: '0 auto 8px' }} />
          لا توجد مرفقات بعد
        </div>
      ) : (
        Object.entries(byCategory).map(([cat, files]) => (
          <div key={cat}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Paperclip style={{ width: '13px', height: '13px' }} />
              {cat} ({files.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {files.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--bg2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ flexShrink: 0 }}>{fileIcon(a.file_type)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{a.file_name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{formatSize(a.file_size)} · {new Date(a.created_at).toLocaleDateString('ar-SA')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {a.public_url && (
                      <a href={a.public_url} target="_blank" rel="noopener noreferrer"
                        style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid #1a56db', background: '#eff6ff', color: '#1a56db', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Download style={{ width: '12px', height: '12px' }} /> فتح
                      </a>
                    )}
                    <button onClick={() => handleDelete(a)}
                      style={{ padding: '5px 8px', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fff5f5', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Trash2 style={{ width: '12px', height: '12px' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* إجمالي */}
      {attachments.length > 0 && (
        <div style={{ fontSize: '0.78rem', color: '#9ca3af', textAlign: 'center' }}>
          {attachments.length} ملف · {formatSize(attachments.reduce((s, a) => s + (a.file_size || 0), 0))} إجمالي
        </div>
      )}
    </div>
  )
}


// ══════════════════════════════════════
// مكوّن تحديث نسبة الإنجاز
// ══════════════════════════════════════
function ProgressUpdater({ project, tenant, onRefresh }: { project: Project; tenant: any; onRefresh: () => void }) {
  const [progress, setProgress] = useState(project.progress)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!tenant) return
    setSaving(true)
    const now = new Date().toLocaleDateString('ar-EG')
    const history = [...(project.history || []), `${now}: تحديث نسبة الإنجاز إلى ${progress}%`]
    await projectsApi.upsert({ id: project.id, tenant_id: tenant.id, progress, history })
    await onRefresh()
    setSaving(false)
    toast.success(`✅ تم تحديث الإنجاز إلى ${progress}%`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <input type="range" min="0" max="100" step="5" value={progress}
          onChange={e => setProgress(Number(e.target.value))}
          style={{ flex: 1 }} />
        <span style={{ fontWeight: 700, color: '#1a56db', fontSize: '1.1rem', minWidth: '48px', textAlign: 'center' }}>
          {progress}%
        </span>
      </div>
      <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '6px', width: `${progress}%`, transition: 'width 0.2s', background: progress >= 100 ? '#0ea77b' : '#1a56db' }} />
      </div>
      {progress !== project.progress && (
        <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end' }}>
          {saving ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          حفظ التحديث
        </button>
      )}
    </div>
  )
}

// ══════════════════════════════════════
// ProjectDetail الرئيسي
// ══════════════════════════════════════
export default function ProjectDetail({ project, onBack, onEdit, onRefresh }: Props) {
  const { currentUser, tenant } = useStore()
  const [activeTab, setActiveTab] = useState<'info'|'attachments'|'inventory'|'history'>('info')
  const [inventoryData, setInventoryData] = useState<any[]>([])
  const [loadingInv, setLoadingInv] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const canEdit = currentUser?.permissions?.includes('projects_edit')
  const days = daysUntil(project.end_date)
  const isLate = days !== null && days < 0 && project.progress < 100

  function getCurrentStageIndex() {
    const stages = project.stages || []
    // أولاً: ابحث عن مرحلة startedAt بدون done (المرحلة الحالية)
    for (let i = PROJECT_STAGES.length - 1; i >= 0; i--) {
      const s = stages.find(st => st.id === PROJECT_STAGES[i].id)
      if (s && s.startedAt && !s.done) return i
    }
    // ثانياً: ابحث عن آخر مرحلة مكتملة + 1
    for (let i = PROJECT_STAGES.length - 1; i >= 0; i--) {
      if (stages.find(s => s.id === PROJECT_STAGES[i].id && s.done)) {
        return Math.min(i + 1, PROJECT_STAGES.length - 1)
      }
    }
    return 0
  }

  const currentIdx = getCurrentStageIndex()

  async function advanceStage(idx: number, note?: string) {
    if (!tenant) return
    setAdvancing(true)
    const stage = PROJECT_STAGES[idx]
    const now = new Date().toLocaleDateString('ar-EG')

    // نسخ المراحل الحالية
    const stages = [...(project.stages || [])]

    // تعليم كل المراحل السابقة كمكتملة
    for (let i = 0; i < idx; i++) {
      const prevId = PROJECT_STAGES[i].id
      const prev = stages.find(s => s.id === prevId)
      if (!prev) stages.push({ id: prevId, done: true, completedAt: now })
      else { prev.done = true; if (!prev.completedAt) prev.completedAt = now }
    }

    // تعيين المرحلة الجديدة كـ current (غير مكتملة)
    const existing = stages.find(s => s.id === stage.id)
    if (existing) { existing.done = false; existing.startedAt = now }
    else stages.push({ id: stage.id, done: false, startedAt: now })

    const history = [...(project.history || []), `${now}: الانتقال إلى مرحلة "${stage.name}"${note ? ' — ' + note : ''}`]
    await projectsApi.upsert({ id: project.id, tenant_id: tenant.id, stages, progress: stage.pct, history })
    await onRefresh()
    setAdvancing(false)
    toast.success(`تم الانتقال إلى: ${stage.icon} ${stage.name}`)
  }

  async function uploadStageAttachment(stageId: string, file: File) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const stages = [...(project.stages || [])]
      const s = stages.find(st => st.id === stageId)
      if (!s) stages.push({ id: stageId, done: false, attachments: [{ name: file.name, data: e.target?.result as string }] })
      else {
        if (!s.attachments) s.attachments = []
        s.attachments.push({ name: file.name, data: e.target?.result as string })
        s.attach = file.name
      }
      if (!tenant) return
      await projectsApi.upsert({ id: project.id, tenant_id: tenant.id, stages })
      await onRefresh()
      toast.success(`تم رفع ${file.name}`)
    }
    reader.readAsDataURL(file)
  }

  async function loadInventory() {
    if (!tenant || loadingInv) return
    setLoadingInv(true)
    const { data } = await supabase.from('stock_ledger').select('*').eq('project_name', project.name).order('created_at', { ascending: false })
    const ledgerData = data || []
    const matMap: Record<string, any> = {}
    ledgerData.forEach((l: any) => {
      if (!matMap[l.mat_name]) matMap[l.mat_name] = { name: l.mat_name, unit: l.unit, totalIn: 0, totalOut: 0, loans: 0 }
      if (l.type === 'توريد') matMap[l.mat_name].totalIn += l.qty
      if (l.type === 'صرف' && !l.is_loan) matMap[l.mat_name].totalOut += l.qty
      if (l.is_loan) matMap[l.mat_name].loans += l.qty
    })
    setInventoryData(Object.values(matMap))
    setLoadingInv(false)
  }

  const TABS = [
    { id: 'info',        label: 'المعلومات' },
    { id: 'attachments', label: '📎 المرفقات' },
    { id: 'inventory',   label: '📦 المخزون' },
    { id: 'history',     label: 'السجل' },
  ]

  return (
    <div className="space-y-5 fade-in">
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={onBack} className="btn btn-ghost btn-sm">
          <ArrowRight style={{ width: '16px', height: '16px' }} /> العودة
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{project.name}</h1>
          <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>{project.code || ''} {project.type ? `· ${project.type}` : ''}</p>
        </div>
        {canEdit && (
          <button onClick={() => onEdit(project)} className="btn btn-ghost btn-sm">
            <Pencil style={{ width: '14px', height: '14px' }} /> تعديل
          </button>
        )}
      </div>

      {/* Progress banner */}
      <div className={`card p-4 ${isLate ? 'border-red-200' : ''}`} style={{ background: isLate ? '#fff5f5' : 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280' }}>
              {PROJECT_STAGES[currentIdx]?.icon} {PROJECT_STAGES[currentIdx]?.name}
            </span>
            {isLate && <span className="badge badge-red" style={{ fontSize: '0.72rem' }}>متأخر</span>}
          </div>
          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a56db' }}>{project.progress}%</span>
        </div>
        <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: '6px', transition: 'width 0.5s', width: `${project.progress}%`, background: project.progress >= 100 ? '#0ea77b' : isLate ? '#ef4444' : '#1a56db' }} />
        </div>
        {project.end_date && (
          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: isLate ? '#ef4444' : '#6b7280' }}>
            التسليم: {formatDate(project.end_date)}
            {days !== null && project.progress < 100 && (
              <span style={{ marginRight: '8px' }}>({isLate ? `متأخر ${Math.abs(days)} يوم` : days === 0 ? 'اليوم' : `${days} يوم متبقي`})</span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id as any); if (t.id === 'inventory') loadInventory() }}
            style={{
              padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap',
              background: activeTab === t.id ? 'var(--primary)' : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              borderBottom: activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: المعلومات */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { label: 'رقم المشروع',    value: project.code },
                { label: 'نوع المشروع',    value: project.type },
                { label: 'المهندس المسؤول',value: project.engineer },
                { label: 'الحالة',          value: project.status },
                { label: 'قيمة المشروع',   value: project.value ? formatCurrency(project.value) : null },
                { label: 'تاريخ البداية',  value: formatDate(project.start_date) },
                { label: 'تاريخ التسليم',  value: formatDate(project.end_date) },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '3px' }}>{label}</div>
                  <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{value}</div>
                </div>
              ) : null)}
            </div>
          </div>

          {/* تحديث نسبة الإنجاز */}
          {canEdit && (
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#1a56db' }}>📊</span> تحديث نسبة الإنجاز
              </div>
              <ProgressUpdater project={project} tenant={tenant} onRefresh={onRefresh} />
            </div>
          )}
        </div>
      )}



      {/* Tab: المرفقات */}
      {activeTab === 'attachments' && (
        <AttachmentsTab project={project} tenant={tenant} />
      )}

      {/* Tab: المخزون */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {loadingInv ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : inventoryData.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
              لا توجد حركات مخزون لهذا المشروع
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'إجمالي الوارد',   value: inventoryData.reduce((s,m)=>s+m.totalIn,0), color: '#0ea77b', icon: TrendingUp },
                  { label: 'إجمالي المصروف', value: inventoryData.reduce((s,m)=>s+m.totalOut,0), color: '#c81e1e', icon: TrendingDown },
                  { label: 'المتبقي (العهدة)', value: inventoryData.reduce((s,m)=>s+(m.totalIn-m.totalOut),0), color: '#1a56db', icon: Package },
                ].map(kpi => (
                  <div key={kpi.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>{kpi.label}</div>
                  </div>
                ))}
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                        {['المادة','وارد','صادر','المتبقي','مستعار','الوحدة','الحالة'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryData.map((m, i) => {
                        const remaining = m.totalIn - m.totalOut
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--bg2)' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>{m.name}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#0ea77b', fontWeight: 700 }}>{m.totalIn}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#c81e1e', fontWeight: 700 }}>{m.totalOut}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: remaining <= 0 ? '#9ca3af' : '#1a56db' }}>{remaining}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>{m.loans > 0 ? <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>🔄 {m.loans}</span> : '—'}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem' }}>{m.unit}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>{remaining <= 0 ? <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>✓ صُرف كله</span> : <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>📦 عهدة</span>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: السجل */}
      {activeTab === 'history' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {(project.history || []).length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>لا يوجد سجل بعد</div>
          ) : [...(project.history || [])].reverse().map((h, i) => (
            <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg2)', fontSize: '0.875rem', color: '#6b7280' }}>{h}</div>
          ))}
        </div>
      )}
    </div>
  )
}
