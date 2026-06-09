'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { projectsApi } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, daysUntil } from '@/lib/utils'
import {
  ArrowRight, Pencil, Upload, CheckCircle2, Clock, AlertTriangle,
  Package, TrendingDown, TrendingUp, ArrowLeftRight,
  Paperclip, Trash2, Download, FileText, Image, File, X
} from 'lucide-react'
import type { Project } from '@/types'
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

// مستندات كل مرحلة — اختيارية للتنظيم
const PHASE_DOCS: Record<string, { category: string; example: string; icon: string }[]> = {
  'التخطيط': [
    { category: 'مخططات المشروع',  example: 'مخطط الكهرباء، المخططات الهندسية',           icon: '📐' },
    { category: 'تصريح الحفر',     example: 'تصريح الحفر الصادر من البلدية أو الجهة المختصة', icon: '🪛' },
  ],
  'التنفيذ': [
    { category: 'تصاريح العمل',         example: 'تصاريح الدخول للموقع، تصاريح الرفع',        icon: '📋' },
    { category: 'إجراءات العمل الآمنة', example: 'JSA، MSDS، خطة السلامة',                    icon: '🦺' },
    { category: 'صور الموقع',           example: 'صور قبل البدء وأثناء التنفيذ',              icon: '📷' },
    { category: 'مستندات الاختبار',     example: 'نتائج الاختبارات والفحوصات',               icon: '🔬' },
    { category: 'طلبات الفصل',          example: 'طلبات فصل الكهرباء الصادرة للشركة',        icon: '⚡' },
  ],
  'الإغلاق': [
    { category: 'أعمال البلدية',         example: 'شهادة إتمام الأعمال البلدية',              icon: '🏛️' },
    { category: 'إخلاء طرف البلدية',    example: 'وثيقة إخلاء الطرف الصادرة من البلدية',    icon: '✅' },
    { category: 'المستخلص',             example: 'المستخلص النهائي المعتمد',                 icon: '📄' },
  ],
}

// أنواع المشاريع بأسماء واضحة
const PROJECT_TYPE_NAMES: Record<string, string> = {
  '801':   'مشاريع الربط الكهربائي 801',
  '802':   'مشاريع التوزيع 802',
  '405':   'مشاريع كهرباء 405',
  '441':   'مشاريع المحولات 441',
  '442':   'محطات التوزيع 442',
  '805':   'مشاريع النقل 805',
  'O&M':   'صيانة وتشغيل O&M',
  'EPC':   'هندسة وتوريد وتنفيذ EPC',
  'CIVIL': 'أعمال مدنية',
  'OTHER': 'أخرى',
}

function fileIcon(type: string) {
  if (type?.startsWith('image/')) return <Image style={{ width: '16px', height: '16px', color: '#0ea77b' }} />
  if (type?.includes('pdf'))      return <FileText style={{ width: '16px', height: '16px', color: '#c81e1e' }} />
  return <File style={{ width: '16px', height: '16px', color: '#1a56db' }} />
}

function formatSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ══════════════════════════════════════
// تاب المرفقات — مقسّمة حسب مراحل المشروع
// ══════════════════════════════════════
function AttachmentsTab({ project, tenant }: { project: Project; tenant: any }) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading,    setLoading]      = useState(false)
  const [uploading,  setUploading]    = useState(false)
  const [activePhase,setActivePhase]  = useState<string>('التخطيط')
  const [dragOver,   setDragOver]     = useState(false)

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
    const withUrls = await Promise.all((data || []).map(async (a: Attachment) => {
      const { data: urlData } = await supabase.storage
        .from('project-attachments')
        .createSignedUrl(a.file_path, 3600)
      return { ...a, public_url: urlData?.signedUrl }
    }))
    setAttachments(withUrls)
    setLoading(false)
  }

  async function handleUpload(files: FileList | null, category: string) {
    if (!files || !tenant) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const filePath = `${tenant.id}/${project.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('project-attachments').upload(filePath, file)
      if (uploadError) { toast.error(`خطأ في رفع ${file.name}`); continue }
      const { error: dbError } = await supabase.from('project_attachments').insert({
        tenant_id: tenant.id, project_id: project.id,
        file_name: file.name, file_path: filePath,
        file_size: file.size, file_type: file.type,
        category: `${activePhase} — ${category}`,
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

  const phases = Object.keys(PHASE_DOCS)
  const PHASE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    'التخطيط': { bg: '#eff6ff', color: '#1a56db', border: '#bfdbfe' },
    'التنفيذ': { bg: '#fffbeb', color: '#e6820a', border: '#fde68a' },
    'الإغلاق': { bg: '#ecfdf5', color: '#0ea77b', border: '#bbf7d0' },
  }

  return (
    <div className="space-y-4">

      {/* تبويبات المراحل */}
      <div style={{ display: 'flex', gap: '6px', background: '#f3f4f6', padding: '5px', borderRadius: '12px', width: 'fit-content' }}>
        {phases.map(phase => {
          const phaseAttachments = attachments.filter(a => a.category.startsWith(phase))
          const pc = PHASE_COLORS[phase]
          return (
            <button key={phase} onClick={() => setActivePhase(phase)}
              style={{
                padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.2s',
                background: activePhase === phase ? pc.color : 'transparent',
                color:      activePhase === phase ? 'white'   : 'var(--text3)',
                boxShadow:  activePhase === phase ? `0 2px 8px ${pc.color}44` : 'none',
              }}>
              {phase === 'التخطيط' ? '📋' : phase === 'التنفيذ' ? '🔄' : '🔒'} {phase}
              {phaseAttachments.length > 0 && (
                <span style={{ marginRight: '6px', background: activePhase === phase ? 'rgba(255,255,255,0.3)' : pc.bg, color: activePhase === phase ? 'white' : pc.color, borderRadius: '10px', padding: '1px 7px', fontSize: '0.7rem' }}>
                  {phaseAttachments.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* فئات المرحلة الحالية */}
      {PHASE_DOCS[activePhase]?.map(doc => {
        const pc = PHASE_COLORS[activePhase]
        const catKey = `${activePhase} — ${doc.category}`
        const catAttachments = attachments.filter(a => a.category === catKey)

        return (
          <div key={doc.category} className="card" style={{ overflow: 'hidden', border: `1px solid ${pc.border}` }}>
            {/* رأس الفئة */}
            <div style={{ padding: '12px 16px', background: pc.bg, borderBottom: `1px solid ${pc.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: pc.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{doc.icon}</span> {doc.category}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>
                  مثال: {doc.example}
                </div>
              </div>
              {/* زر رفع */}
              <label style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
                <input type="file" multiple style={{ display: 'none' }}
                  onChange={e => handleUpload(e.target.files, doc.category)}
                  disabled={uploading} />
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 12px', borderRadius: '8px',
                  background: uploading ? '#9ca3af' : pc.color,
                  color: 'white', fontSize: '0.78rem', fontWeight: 600,
                }}>
                  <Upload style={{ width: '13px', height: '13px' }} />
                  {uploading ? 'جاري...' : 'رفع'}
                </span>
              </label>
            </div>

            {/* الملفات */}
            {catAttachments.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem' }}>
                لا توجد ملفات — اضغط "رفع" لإضافة مستند
              </div>
            ) : (
              catAttachments.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid var(--bg2)' }}>
                  {fileIcon(a.file_type)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.file_name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                      {formatSize(a.file_size)} · {a.created_at?.split('T')[0]}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {a.public_url && (
                      <a href={a.public_url} target="_blank" rel="noopener noreferrer"
                        style={{ padding: '5px 10px', borderRadius: '7px', border: `1px solid ${pc.border}`, background: pc.bg, color: pc.color, fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Download style={{ width: '12px', height: '12px' }} /> فتح
                      </a>
                    )}
                    <button onClick={() => handleDelete(a)}
                      style={{ padding: '5px 8px', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fff5f5', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Trash2 style={{ width: '12px', height: '12px' }} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )
      })}

      {/* إجمالي */}
      {attachments.length > 0 && (
        <div style={{ fontSize: '0.78rem', color: '#9ca3af', textAlign: 'center' }}>
          {attachments.length} ملف إجمالاً · {formatSize(attachments.reduce((s, a) => s + (a.file_size || 0), 0))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════
// مكوّن تحديث نسبة الإنجاز — مُصلح
// ══════════════════════════════════════
function ProgressUpdater({ project, tenant, onRefresh }: { project: Project; tenant: any; onRefresh: () => void }) {
  const [progress, setProgress] = useState(project.progress)
  const [saving, setSaving]     = useState(false)

  // مزامنة قيمة الـ slider مع المشروع عند تغييره
  useEffect(() => { setProgress(project.progress) }, [project.progress])

  async function handleSave() {
    if (!tenant) return
    setSaving(true)
    const now = new Date().toLocaleDateString('ar-EG')
    const history = [...(project.history || []), `${now}: تحديث نسبة الإنجاز إلى ${progress}%`]

    // ✅ استخدام update مباشرة بدل upsert لتجنب مشكلة branch_id
    const { error } = await supabase
      .from('projects')
      .update({ progress, history, updated_at: new Date().toISOString() })
      .eq('id', project.id)

    if (error) {
      toast.error('خطأ في الحفظ: ' + error.message)
      setSaving(false)
      return
    }

    // تسجيل في سجل الإنجاز للتتبع
    await supabase.from('project_progress_logs').insert({
      project_id: project.id,
      tenant_id:  tenant.id,
      progress,
      notes: `تحديث يدوي إلى ${progress}%`,
    }).then(() => {})

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
        <div style={{
          height: '100%', borderRadius: '6px',
          width: `${progress}%`, transition: 'width 0.2s',
          background: progress >= 100 ? '#0ea77b' : progress >= 60 ? '#1a56db' : '#e6820a'
        }} />
      </div>
      {progress !== project.progress && (
        <button onClick={handleSave} disabled={saving}
          className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end' }}>
          {saving
            ? <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            : null}
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
  const [activeTab, setActiveTab]     = useState<'info'|'attachments'|'visits'|'inventory'|'history'>('info')
  const [inventoryData, setInventoryData] = useState<any[]>([])
  const [loadingInv, setLoadingInv]   = useState(false)
  const [visitsData,  setVisitsData]  = useState<any[]>([])
  const [loadingVis,  setLoadingVis]  = useState(false)
  const canEdit = currentUser?.permissions?.includes('projects_edit')
  const days    = daysUntil(project.end_date)
  const isLate  = days !== null && days < 0 && project.progress < 100





  async function loadVisits() {
    if (!tenant || loadingVis) return
    setLoadingVis(true)
    const { data } = await supabase
      .from('visits')
      .select('*')
      .eq('project_id', project.id)
      .eq('tenant_id', tenant.id)
      .order('date', { ascending: false })
    setVisitsData(data || [])
    setLoadingVis(false)
  }

  async function loadInventory() {
    if (!tenant || loadingInv) return
    setLoadingInv(true)
    const { data } = await supabase.from('stock_ledger')
      .select('*').eq('project_name', project.name)
      .order('created_at', { ascending: false })
    const ledgerData = data || []
    const matMap: Record<string, any> = {}
    ledgerData.forEach((l: any) => {
      if (!matMap[l.mat_name]) matMap[l.mat_name] = { name: l.mat_name, unit: l.unit, totalIn: 0, totalOut: 0, loans: 0 }
      if (l.type === 'توريد')               matMap[l.mat_name].totalIn  += l.qty
      if (l.type === 'صرف' && !l.is_loan)   matMap[l.mat_name].totalOut += l.qty
      if (l.is_loan)                         matMap[l.mat_name].loans    += l.qty
    })
    setInventoryData(Object.values(matMap))
    setLoadingInv(false)
  }

  const TABS = [
    { id: 'info',        label: '📋 المعلومات'  },
    { id: 'attachments', label: '📎 المرفقات'   },
    { id: 'visits',      label: '🔍 الزيارات'   },
    { id: 'inventory',   label: '📦 المخزون'    },
    { id: 'history',     label: '📜 السجل'       },
  ]

  return (
    <div className="space-y-5 fade-in">
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={onBack} className="btn btn-ghost btn-sm">
          <ArrowRight style={{ width: '16px', height: '16px' }} /> العودة
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {project.name}
          </h1>
          <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>
            {project.code || ''} {project.type ? `· ${PROJECT_TYPE_NAMES[project.type] || project.type}` : ''}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => onEdit(project)} className="btn btn-ghost btn-sm">
            <Pencil style={{ width: '14px', height: '14px' }} /> تعديل
          </button>
        )}
      </div>

      {/* Progress banner */}
      <div className={`card p-4 ${isLate ? 'border-red-200' : ''}`} style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#6b7280' }}>نسبة الإنجاز</span>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: project.progress >= 100 ? '#0ea77b' : '#1a56db' }}>
            {project.progress}%
          </span>
        </div>
        <div style={{ height: '10px', background: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '6px',
            width: `${project.progress}%`, transition: 'width 0.4s',
            background: project.progress >= 100 ? '#0ea77b' : isLate ? '#c81e1e' : '#1a56db'
          }} />
        </div>
        {days !== null && (
          <div style={{ marginTop: '6px', fontSize: '0.75rem', color: isLate ? '#c81e1e' : '#9ca3af' }}>
            {isLate
              ? `⚠️ متأخر ${Math.abs(days)} يوم`
              : days === 0 ? '⏰ تسليم اليوم'
              : `📅 متبقي ${days} يوم`}
          </div>
        )}
      </div>



      {/* التابات */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => { setActiveTab(t.id as any); if (t.id === 'inventory') loadInventory(); if (t.id === 'visits') loadVisits() }}
            style={{
              padding: '10px 18px', fontSize: '0.875rem', fontWeight: 600,
              border: 'none', background: 'none', cursor: 'pointer',
              color:         activeTab === t.id ? 'var(--primary)' : 'var(--text3)',
              borderBottom:  activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom:  '-2px', whiteSpace: 'nowrap',
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
                { label: 'رقم المشروع',      value: project.code },
                { label: 'نوع المشروع',      value: PROJECT_TYPE_NAMES[project.type || ''] || project.type },
                { label: 'الجهة المنفذة',    value: (project as any).client_name || (project as any).client },
                { label: 'الحالة',            value: project.status },
                { label: 'المهندس المسؤول',  value: project.engineer },
                { label: 'موقع المشروع',     value: (project as any).location },
                { label: 'قيمة المشروع',     value: project.value ? formatCurrency(project.value) : null },
                { label: 'تاريخ البداية',    value: formatDate(project.start_date) },
                { label: 'تاريخ التسليم',    value: formatDate(project.end_date) },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '3px' }}>{label}</div>
                  <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{value}</div>
                </div>
              ) : null)}
            </div>
            {(project as any).description && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '6px' }}>وصف المشروع</div>
                <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>{(project as any).description}</p>
              </div>
            )}
          </div>

          {/* تحديث نسبة الإنجاز */}
          {canEdit && (
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📊</span> تحديث نسبة الإنجاز
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


      {/* Tab: الزيارات */}
      {activeTab === 'visits' && (
        <div className="space-y-4">
          {loadingVis ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div style={{ width: '24px', height: '24px', border: '3px solid var(--border)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : visitsData.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🔍</div>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>لا توجد زيارات مسجلة لهذا المشروع</div>
              <div style={{ fontSize: '0.8rem' }}>أضف الزيارات من صفحة الزيارات الميدانية</div>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              {/* إحصاءات سريعة */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
                {[
                  { label: 'إجمالي الزيارات', value: visitsData.length,                                                              color: '#1a56db', bg: '#eff6ff' },
                  { label: 'مطابق',            value: visitsData.filter(v => v.specs === 'مطابق').length,                             color: '#0ea77b', bg: '#ecfdf5' },
                  { label: 'غير مطابق',        value: visitsData.filter(v => v.specs === 'غير مطابق').length,                        color: '#c81e1e', bg: '#fef2f2' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '12px 16px', background: s.bg, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* جدول الزيارات */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['التاريخ', 'النوع', 'المهندس', 'النتيجة', 'الحالة', 'ملاحظات'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visitsData.map((v: any) => (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{v.date}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600, background: '#eff6ff', color: '#1a56db' }}>
                            {v.type === 'جودة' ? '🔍' : v.type === 'سلامة' ? '🦺' : v.type === 'كهربائية' ? '⚡' : '🏗️'} {v.type}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>{v.engineer || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600,
                            background: v.specs === 'مطابق' ? '#ecfdf5' : '#fef2f2',
                            color:      v.specs === 'مطابق' ? '#0ea77b' : '#c81e1e',
                          }}>
                            {v.specs === 'مطابق' ? '✅' : '⚠️'} {v.specs}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{v.status || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: المخزون */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {loadingInv ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div style={{ width: '24px', height: '24px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : inventoryData.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              <Package style={{ width: '32px', height: '32px', margin: '0 auto 8px', opacity: 0.3 }} />
              <div>لا توجد حركات مخزون مرتبطة بهذا المشروع</div>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['المادة', 'الوحدة', 'وارد', 'صادر', 'عهدة', 'الرصيد'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventoryData.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--bg2)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{m.name}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{m.unit}</td>
                      <td style={{ padding: '10px 14px', color: '#0ea77b', fontWeight: 600 }}>{m.totalIn}</td>
                      <td style={{ padding: '10px 14px', color: '#c81e1e', fontWeight: 600 }}>{m.totalOut}</td>
                      <td style={{ padding: '10px 14px', color: '#e6820a', fontWeight: 600 }}>{m.loans}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{m.totalIn - m.totalOut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: السجل */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: '16px' }}>
          {(!project.history || project.history.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>لا توجد سجلات</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...project.history].reverse().map((entry, i) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: '8px',
                  background: i === 0 ? '#eff6ff' : '#fafafa',
                  border: `1px solid ${i === 0 ? '#bfdbfe' : '#f3f4f6'}`,
                  fontSize: '0.82rem', color: '#374151',
                }}>
                  {entry}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
