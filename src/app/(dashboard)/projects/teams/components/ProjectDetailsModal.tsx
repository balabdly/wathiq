'use client'
import { useEffect, useMemo, useState } from 'react'
import { FileText, Image, Paperclip, Send, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { TEAM_TYPE_STYLE, type TeamProjectLog } from '@/lib/project-teams'
import type { TeamsPageData, ProjectRow } from './types'
import { fmtDateTime } from './types'

export default function ProjectDetailsModal({
  project,
  data,
  onClose,
}: {
  project: ProjectRow
  data: TeamsPageData
  onClose: () => void
}) {
  const { teams, members, tenantId, canEdit, currentUserName, currentUserEmployeeId } = data
  const [logs, setLogs] = useState<TeamProjectLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  const team = teams.find(t => t.id === project.team_id)
  const tStyle = TEAM_TYPE_STYLE[team?.team_type || ''] || TEAM_TYPE_STYLE['مختلط']

  const canLog = useMemo(() => {
    if (canEdit) return true
    if (!project.team_id || !currentUserEmployeeId) return false
    if (team?.lead_id === currentUserEmployeeId) return true
    return (members[project.team_id] || []).some(m => m.employee_id === currentUserEmployeeId)
  }, [canEdit, project.team_id, currentUserEmployeeId, team, members])

  useEffect(() => {
    loadLogs()
  }, [project.id])

  async function loadLogs() {
    setLoadingLogs(true)
    const { data: logRows } = await supabase
      .from('team_project_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
    const rows = logRows || []
    const withFiles = await Promise.all(rows.map(async (log: TeamProjectLog) => {
      const { data: f } = await supabase.from('team_project_log_files').select('*').eq('log_id', log.id)
      const filesWithUrls = await Promise.all((f || []).map(async file => {
        const { data: urlData } = await supabase.storage.from('project-attachments').createSignedUrl(file.file_path, 3600)
        return { ...file, public_url: urlData?.signedUrl }
      }))
      return { ...log, files: filesWithUrls }
    }))
    setLogs(withFiles)
    setLoadingLogs(false)
  }

  async function submitLog() {
    if (!project.team_id) return
    if (!notes.trim() && files.length === 0) { toast.error('اكتب ملاحظة أو أرفق ملفاً'); return }
    setSaving(true)
    const { data: logRow, error } = await supabase.from('team_project_logs').insert({
      tenant_id: tenantId,
      team_id: project.team_id,
      project_id: project.id,
      author_id: currentUserEmployeeId || null,
      author_name: currentUserName,
      notes: notes.trim() || null,
    }).select('id').single()
    if (error || !logRow) {
      toast.error(error?.message || 'فشل الحفظ')
      setSaving(false)
      return
    }
    for (const file of files) {
      const filePath = `${tenantId}/team-logs/${project.team_id}/${project.id}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('project-attachments').upload(filePath, file)
      if (upErr) { toast.error(`فشل رفع ${file.name}`); continue }
      await supabase.from('team_project_log_files').insert({
        tenant_id: tenantId,
        log_id: logRow.id,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
      })
    }
    toast.success('✅ تم تسجيل التحديث')
    setNotes('')
    setFiles([])
    await loadLogs()
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div
        className="modal-box"
        style={{ maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <h3 style={{ fontWeight: 800, margin: 0, fontSize: '1rem' }}>{project.name}</h3>
            {project.code && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{project.code}</span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* ملخص المشروع */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.82rem' }}>
            <span style={{ padding: '4px 10px', borderRadius: '8px', background: tStyle.bg, color: tStyle.color, fontWeight: 600 }}>
              👥 {team?.name || '—'}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: '8px', background: '#f3f4f6', color: '#4b5563' }}>
              📋 {project.status || '—'}
            </span>
            {project.engineer && (
              <span style={{ padding: '4px 10px', borderRadius: '8px', background: '#f3f4f6', color: '#4b5563' }}>
                👤 {project.engineer}
              </span>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '6px' }}>
              <span>نسبة الإنجاز</span>
              <span style={{ fontWeight: 700, color: '#1a56db' }}>{project.progress ?? 0}%</span>
            </div>
            <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${project.progress ?? 0}%`, background: '#1a56db', borderRadius: '8px', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* نموذج تحديث يومي */}
          {canLog && (
            <div style={{ padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '10px' }}>📝 تحديث يومي جديد</div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="input"
                placeholder="اكتب ملاحظات العمل اليومي، ما تم إنجازه، المعوقات..."
                style={{ minHeight: '80px', resize: 'vertical', marginBottom: '10px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#1a56db', fontWeight: 600 }}>
                  <Upload style={{ width: '16px', height: '16px' }} />
                  إرفاق صور/ملفات
                  <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }}
                    onChange={e => setFiles(Array.from(e.target.files || []))} />
                </label>
                {files.length > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{files.length} ملف</span>
                )}
                <button onClick={submitLog} disabled={saving} className="btn btn-primary" style={{ marginRight: 'auto', fontSize: '0.82rem' }}>
                  <Send style={{ width: '14px', height: '14px' }} /> {saving ? 'جاري الحفظ...' : 'تسجيل'}
                </button>
              </div>
            </div>
          )}

          {/* سجل العمل */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '12px' }}>📜 سجل العمل ({logs.length})</div>
            {loadingLogs ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: '0.82rem' }}>جاري التحميل...</div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text3)', fontSize: '0.82rem', background: '#f9fafb', borderRadius: '10px' }}>
                لا تحديثات مسجلة بعد
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {logs.map(log => (
                  <div key={log.id} style={{ padding: '12px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>👤 {log.author_name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{fmtDateTime(log.created_at)}</span>
                    </div>
                    {log.notes && (
                      <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: '#374151', margin: '0 0 8px' }}>{log.notes}</p>
                    )}
                    {(log.files || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {(log.files || []).map(f => (
                          <a
                            key={f.id}
                            href={(f as { public_url?: string }).public_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '5px 9px', borderRadius: '7px', background: 'white',
                              border: '1px solid #e5e7eb', fontSize: '0.72rem', color: '#1a56db', textDecoration: 'none',
                            }}
                          >
                            {f.file_type?.startsWith('image/') ? <Image style={{ width: '12px', height: '12px' }} /> : f.file_type?.includes('pdf') ? <FileText style={{ width: '12px', height: '12px' }} /> : <Paperclip style={{ width: '12px', height: '12px' }} />}
                            {f.file_name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
