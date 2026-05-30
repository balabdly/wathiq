'use client'
import { useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { projectsApi } from '@/lib/db'
import { formatDate, formatCurrency, daysUntil, PROJECT_STAGES } from '@/lib/utils'
import { ArrowRight, Pencil, Upload, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import type { Project, ProjectStage } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  project: Project
  onBack: () => void
  onEdit: (p: Project) => void
  onRefresh: () => void
}

export default function ProjectDetail({ project, onBack, onEdit, onRefresh }: Props) {
  const { currentUser, tenant } = useStore()
  const [activeTab, setActiveTab] = useState<'info'|'stages'|'files'|'history'>('info')
  const [advancing, setAdvancing] = useState(false)
  const canEdit = currentUser?.permissions?.includes('projects_edit')
  const days = daysUntil(project.end_date)
  const isLate = days !== null && days < 0 && project.progress < 100

  function getCurrentStageIndex() {
    const stages = project.stages || []
    for (let i = PROJECT_STAGES.length - 1; i >= 0; i--) {
      if (stages.find(s => s.id === PROJECT_STAGES[i].id && s.done)) return Math.min(i + 1, PROJECT_STAGES.length - 1)
    }
    return 0
  }

  const currentIdx = getCurrentStageIndex()

  async function advanceStage(idx: number, attachName?: string, note?: string) {
    if (!tenant) return
    const stage = PROJECT_STAGES[idx]
    if (stage.requiresAttach && !attachName) {
      toast.error(`مرحلة "${stage.name}" تتطلب رفع مرفق`)
      return
    }
    setAdvancing(true)
    const now = new Date().toLocaleDateString('ar-EG')
    const stages = [...(project.stages || [])]

    // إكمال المرحلة السابقة
    if (idx > 0) {
      const prevId = PROJECT_STAGES[idx-1].id
      const prev = stages.find(s => s.id === prevId)
      if (!prev) stages.push({ id: prevId, done: true, completedAt: now })
      else prev.done = true
    }

    // تحديث المرحلة الجديدة
    const existing = stages.find(s => s.id === stage.id)
    if (existing) { existing.done = false; existing.note = note; existing.attach = attachName; existing.startedAt = now }
    else stages.push({ id: stage.id, done: false, note, attach: attachName, startedAt: now })

    const history = [...(project.history || []), `${now}: الانتقال إلى مرحلة "${stage.name}"${note ? ' — ' + note : ''}`]

    await projectsApi.upsert({
      id: project.id, tenant_id: tenant.id,
      stages, progress: stage.pct, history
    })
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

  const TABS = [
    { id: 'info',    label: 'المعلومات' },
    { id: 'stages',  label: 'مراحل التنفيذ' },
    { id: 'files',   label: 'المرفقات' },
    { id: 'history', label: 'السجل' },
  ]

  return (
    <div className="space-y-5 fade-in">
      {/* Back + header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="btn btn-ghost btn-sm">
          <ArrowRight className="w-4 h-4" /> العودة
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-800 truncate">{project.name}</h1>
          <p className="text-sm text-gray-400">{project.code || ''} {project.type ? `· ${project.type}` : ''}</p>
        </div>
        {canEdit && (
          <button onClick={() => onEdit(project)} className="btn btn-ghost btn-sm">
            <Pencil className="w-3.5 h-3.5" /> تعديل
          </button>
        )}
      </div>

      {/* Progress banner */}
      <div className={`card p-4 ${isLate ? 'border-red-200 bg-red-50/50' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">
              {PROJECT_STAGES[currentIdx]?.icon} {PROJECT_STAGES[currentIdx]?.name}
            </span>
            {isLate && <span className="badge badge-red text-xs">متأخر</span>}
          </div>
          <span className="text-lg font-bold text-primary-600">{project.progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${project.progress >= 100 ? 'bg-emerald-500' : isLate ? 'bg-red-400' : 'bg-primary-500'}`}
            style={{ width: `${project.progress}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {activeTab === 'info' && (
        <div className="card p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {[
              { label: 'المهندس المسؤول', value: project.engineer },
              { label: 'قيمة المشروع',    value: formatCurrency(project.value) },
              { label: 'الحالة',           value: project.status },
              { label: 'تاريخ البداية',   value: formatDate(project.start_date) },
              { label: 'تاريخ التسليم',   value: formatDate(project.end_date) },
              { label: 'المتبقي',
                value: days !== null && project.progress < 100
                  ? (isLate ? `متأخر ${Math.abs(days)} يوم` : `${days} يوم`)
                  : '—' },
            ].map(item => (
              <div key={item.label}>
                <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                <div className="font-semibold text-gray-800">{item.value || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stages tab */}
      {activeTab === 'stages' && (
        <div className="space-y-2">
          {PROJECT_STAGES.map((stage, idx) => {
            const stageData = (project.stages || []).find(s => s.id === stage.id)
            const isDone  = stageData?.done === true
            const isCurr  = idx === currentIdx
            const isNext  = idx === currentIdx + 1
            const isLocked = idx > currentIdx + 1

            return (
              <div key={stage.id}
                className={`card p-4 transition-all ${isDone ? 'border-emerald-200 bg-emerald-50/30' : isCurr ? 'border-primary-200 bg-primary-50/30 shadow-sm' : isLocked ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-sm
                    ${isDone ? 'bg-emerald-500' : isCurr ? 'bg-primary-500' : 'bg-gray-200'}`}>
                    {isDone ? <CheckCircle2 className="w-4 h-4 text-white" /> :
                     isCurr ? <Clock className="w-4 h-4 text-white" /> :
                     <span className="text-xs text-gray-500 font-bold">{idx+1}</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm ${isDone ? 'text-emerald-700' : isCurr ? 'text-primary-700' : 'text-gray-600'}`}>
                          {stage.icon} {stage.name}
                        </span>
                        {stage.requiresAttach && !isDone && (
                          <span className="badge badge-amber text-xs">يتطلب مرفق</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isDone && stageData?.completedAt && (
                          <span className="text-xs text-emerald-600">✓ {stageData.completedAt}</span>
                        )}
                        {/* زر إرفاق للمرحلة الحالية والسابقة */}
                        {canEdit && (isCurr || isDone) && (
                          <label className="btn btn-ghost btn-xs cursor-pointer">
                            <Upload className="w-3 h-3" /> إرفاق
                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              onChange={e => { const f = e.target.files?.[0]; if(f) uploadStageAttachment(stage.id, f) }} />
                          </label>
                        )}
                        {/* زر الانتقال */}
                        {canEdit && isCurr && (
                          <button
                            onClick={async () => {
                              if (idx === PROJECT_STAGES.length - 2) {
                                if (!confirm('إغلاق المشروع نهائياً؟')) return
                              }
                              const note = idx < PROJECT_STAGES.length - 1
                                ? prompt(`ملاحظة على مرحلة "${PROJECT_STAGES[idx+1]?.name}" (اختياري):`) || undefined
                                : undefined
                              await advanceStage(idx + 1, undefined, note)
                            }}
                            disabled={advancing}
                            className={`btn btn-sm ${idx >= PROJECT_STAGES.length - 2 ? 'btn-success' : 'btn-primary'}`}>
                            {advancing ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : null}
                            {idx >= PROJECT_STAGES.length - 2 ? '🏁 إغلاق المشروع' : 'الانتقال للتالية ←'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* مرفقات المرحلة */}
                    {stageData?.attachments && stageData.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {stageData.attachments.map((att, i) => (
                          <a key={i} href={att.data} download={att.name}
                            className="inline-flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-lg transition-colors">
                            📎 {att.name}
                          </a>
                        ))}
                      </div>
                    )}
                    {stageData?.note && (
                      <p className="text-xs text-gray-500 mt-1">{stageData.note}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="card divide-y divide-gray-50">
          {(project.history || []).length === 0 ? (
            <p className="p-8 text-center text-gray-400 text-sm">لا يوجد سجل بعد</p>
          ) : [...(project.history || [])].reverse().map((h, i) => (
            <div key={i} className="px-5 py-3 text-sm text-gray-600">{h}</div>
          ))}
        </div>
      )}
    </div>
  )
}
