'use client'
import { useEffect, useMemo, useState } from 'react'
import { FileText, Image, Paperclip, Send, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { TEAM_TYPE_STYLE, type TeamProjectLog } from '@/lib/project-teams'
import type { TeamsPageData, ProjectRow } from './types'
import { fmtDateTime } from './types'

export default function AssignedProjectsTab({ data }: { data: TeamsPageData }) {
  const { teams, projects, tenantId, canEdit, currentUserName, currentUserEmployeeId, reload } = data
  const [teamFilter, setTeamFilter] = useState<number | ''>('')
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null)
  const [logs, setLogs] = useState<TeamProjectLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  const assignedProjects = useMemo(() => {
    let list = projects.filter(p => p.team_id)
    if (teamFilter) list = list.filter(p => p.team_id === teamFilter)
    return list.sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
  }, [projects, teamFilter])

  useEffect(() => {
    if (selectedProject) loadLogs(selectedProject.id)
    else setLogs([])
  }, [selectedProject?.id])

  async function loadLogs(projectId: number) {
    setLoadingLogs(true)
    const { data: logRows } = await supabase
      .from('team_project_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
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
    if (!selectedProject || !selectedProject.team_id) return
    if (!notes.trim() && files.length === 0) { toast.error('اكتب ملاحظة أو أرفق ملفاً'); return }
    setSaving(true)
    const { data: logRow, error } = await supabase.from('team_project_logs').insert({
      tenant_id: tenantId,
      team_id: selectedProject.team_id,
      project_id: selectedProject.id,
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
      const filePath = `${tenantId}/team-logs/${selectedProject.team_id}/${selectedProject.id}/${Date.now()}_${file.name}`
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
    await loadLogs(selectedProject.id)
    setSaving(false)
  }

  const teamName = (tid: number) => teams.find(t => t.id === tid)?.name || '—'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '16px', alignItems: 'start' }}>
      {/* قائمة المشاريع */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '10px' }}>المشاريع المسندة ({assignedProjects.length})</div>
          <select value={teamFilter} onChange={e => setTeamFilter(e.target.value ? Number(e.target.value) : '')} className="select" style={{ fontSize: '0.82rem' }}>
            <option value="">كل الفرق</option>
            {teams.filter(t => t.is_active).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
          {assignedProjects.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>
              لا مشاريع مسندة — اسند من تبويب «الفرق النشطة»
            </div>
          ) : assignedProjects.map(p => {
            const isSel = selectedProject?.id === p.id
            const tStyle = TEAM_TYPE_STYLE[teams.find(t => t.id === p.team_id)?.team_type || ''] || TEAM_TYPE_STYLE['مختلط']
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p)}
                style={{
                  width: '100%', textAlign: 'right', padding: '14px 16px', border: 'none', cursor: 'pointer',
                  background: isSel ? '#eff6ff' : 'transparent',
                  borderRight: isSel ? '3px solid #1a56db' : '3px solid transparent',
                  borderBottom: '1px solid var(--bg2)', fontFamily: 'inherit',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.name}</div>
                <div style={{ fontSize: '0.68rem', color: tStyle.color, marginTop: '2px' }}>{teamName(p.team_id!)}</div>
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '4px' }}>
                    <span>{p.status}</span>
                    <span>{p.progress ?? 0}%</span>
                  </div>
                  <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.progress ?? 0}%`, background: '#1a56db', borderRadius: '4px' }} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* سجل العمل اليومي */}
      {!selectedProject ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
          اختر مشروعاً لعرض التفاصيل وسجل العمل اليومي
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>{selectedProject.name}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px', fontSize: '0.82rem', color: 'var(--text3)' }}>
              <span>👥 {teamName(selectedProject.team_id!)}</span>
              <span>📊 {selectedProject.progress ?? 0}% إنجاز</span>
              <span>📋 {selectedProject.status}</span>
              {selectedProject.engineer && <span>👤 {selectedProject.engineer}</span>}
            </div>
          </div>

          {canEdit && (
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '12px' }}>📝 تحديث يومي جديد</div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="input"
                placeholder="اكتب ملاحظات العمل اليومي، ما تم إنجازه، المعوقات..."
                style={{ minHeight: '90px', resize: 'vertical', marginBottom: '12px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#1a56db', fontWeight: 600 }}>
                  <Upload style={{ width: '16px', height: '16px' }} />
                  إرفاق صور/ملفات
                  <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }}
                    onChange={e => setFiles(Array.from(e.target.files || []))} />
                </label>
                {files.length > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{files.length} ملف محدد</span>
                )}
                <button onClick={submitLog} disabled={saving} className="btn btn-primary" style={{ marginRight: 'auto' }}>
                  <Send style={{ width: '14px', height: '14px' }} /> {saving ? 'جاري الحفظ...' : 'تسجيل'}
                </button>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: '18px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '16px' }}>📜 سجل العمل ({logs.length})</div>
            {loadingLogs ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)' }}>جاري التحميل...</div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text3)', fontSize: '0.82rem' }}>
                لا تحديثات مسجلة — ابدأ بتوثيق العمل اليومي
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {logs.map(log => (
                  <div key={log.id} style={{ padding: '14px 16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>👤 {log.author_name}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{fmtDateTime(log.created_at)}</span>
                    </div>
                    {log.notes && (
                      <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#374151', margin: '0 0 10px' }}>{log.notes}</p>
                    )}
                    {(log.files || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {(log.files || []).map(f => (
                          <a
                            key={f.id}
                            href={(f as { public_url?: string }).public_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '6px 10px', borderRadius: '8px', background: 'white',
                              border: '1px solid #e5e7eb', fontSize: '0.75rem', color: '#1a56db', textDecoration: 'none',
                            }}
                          >
                            {f.file_type?.startsWith('image/') ? <Image style={{ width: '13px', height: '13px' }} /> : f.file_type?.includes('pdf') ? <FileText style={{ width: '13px', height: '13px' }} /> : <Paperclip style={{ width: '13px', height: '13px' }} />}
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
      )}
    </div>
  )
}
