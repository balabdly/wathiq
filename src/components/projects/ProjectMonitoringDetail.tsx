'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { fetchProjectPlanning } from '@/lib/project-planning-service'
import { fetchBoqVersions } from '@/lib/pmc-service'
import { fetchProjectTeamAssignments } from '@/lib/project-execution-service'
import { fetchTeamWithMembers } from '@/lib/project-teams'
import { lifecycleForPmoLabel } from '@/lib/project-lifecycle'
import {
  fetchProjectPhaseHistory,
  formatPhaseDuration,
  phaseHistoryLabel,
  type ProjectPhaseHistoryRow,
} from '@/lib/project-phase-history-service'
import { formatDate, formatCurrency } from '@/lib/utils'
import {
  ArrowRight, Download, FileText, Image, File, ClipboardList, HardHat, Archive, Rocket, Clock,
} from 'lucide-react'
import { formatTeamTypeLabel, ASSIGNMENT_STATUS_LABEL, ASSIGNMENT_STATUS_STYLE } from '@/lib/project-teams'
import type { ProjectTeamAssignment } from '@/lib/project-teams'
import type { Project } from '@/types'

type Attachment = {
  id: number; file_name: string; file_path: string
  file_size: number; file_type: string; category: string
  created_at: string; public_url?: string
}

const PHASE_TABS = [
  { id: 'initiation', label: 'البدء', icon: Rocket },
  { id: 'planning', label: 'التخطيط', icon: ClipboardList },
  { id: 'execution', label: 'التنفيذ', icon: HardHat },
  { id: 'close', label: 'الإغلاق', icon: Archive },
  { id: 'visits', label: 'الزيارات', icon: FileText },
] as const

type PhaseTab = typeof PHASE_TABS[number]['id']

const TAB_TO_LIFECYCLE: Record<Exclude<PhaseTab, 'visits'>, ProjectPhaseHistoryRow['lifecycle_phase']> = {
  initiation: 'initiation',
  planning: 'planning',
  execution: 'execution',
  close: 'closure',
}

function PhaseTimingBlock({ rows, lifecycle }: { rows: ProjectPhaseHistoryRow[]; lifecycle: ProjectPhaseHistoryRow['lifecycle_phase'] }) {
  const matches = rows.filter(r => r.lifecycle_phase === lifecycle)
  if (!matches.length) {
    return (
      <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0 0 12px', padding: '8px 10px', background: '#f9fafb', borderRadius: '8px' }}>
        لم يصل المشروع إلى هذه المرحلة بعد
      </p>
    )
  }
  return (
    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {matches.map((row, idx) => (
        <div key={`${row.lifecycle_phase}-${row.entered_at}-${idx}`} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa', fontSize: '0.78rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <span><strong>دخول:</strong> {formatDate(row.entered_at)}</span>
            <span><strong>خروج:</strong> {row.exited_at ? formatDate(row.exited_at) : '— ما زال في المرحلة —'}</span>
            <span><strong>المدة:</strong> {formatPhaseDuration(row.entered_at, row.exited_at)}</span>
          </div>
          {row.synthetic && (
            <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#e6820a' }}>
              تقدير من تاريخ إنشاء المشروع — سيُحدَّث عند الانتقال بين المراحل
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function fileIcon(type: string) {
  if (type?.startsWith('image/')) return <Image style={{ width: '16px', height: '16px', color: '#0ea77b' }} />
  if (type?.includes('pdf')) return <FileText style={{ width: '16px', height: '16px', color: '#c81e1e' }} />
  return <File style={{ width: '16px', height: '16px', color: '#1a56db' }} />
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: '8px', fontSize: '0.82rem', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ color: '#6b7280', minWidth: '120px', fontWeight: 600 }}>{label}</span>
      <span style={{ flex: 1 }}>{value}</span>
    </div>
  )
}

function AttachmentsList({ items }: { items: Attachment[] }) {
  if (!items.length) {
    return <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>لا توجد مرفقات لهذه المرحلة</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
          {fileIcon(a.file_type)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{a.category}</div>
          </div>
          {a.public_url && (
            <a href={a.public_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: '0.72rem' }}>
              <Download style={{ width: '12px', height: '12px' }} /> فتح
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

export default function ProjectMonitoringDetail({
  project,
  onBack,
}: {
  project: Project
  onBack: () => void
}) {
  const { tenant } = useStore()
  const [tab, setTab] = useState<PhaseTab>('initiation')
  const [loading, setLoading] = useState(true)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [visits, setVisits] = useState<any[]>([])
  const [planning, setPlanning] = useState<any>(null)
  const [execution, setExecution] = useState<any>(null)
  const [closure, setClosure] = useState<any>(null)
  const [boqSummary, setBoqSummary] = useState({ materials: 0, works: 0, lines: 0 })
  const [teamAssignments, setTeamAssignments] = useState<ProjectTeamAssignment[]>([])
  const [phaseHistory, setPhaseHistory] = useState<ProjectPhaseHistoryRow[]>([])

  useEffect(() => {
    if (!tenant) return
    loadAll()
  }, [tenant?.id, project.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [planRes, attachRes, visitsRes, boqRes, closureRes, logsRes, logCountRes, teamRes, assignRes, historyRes] = await Promise.all([
      fetchProjectPlanning(tenant.id, project.id),
      supabase.from('project_attachments').select('*').eq('tenant_id', tenant.id).eq('project_id', project.id).order('created_at', { ascending: false }),
      supabase.from('visits').select('*').eq('tenant_id', tenant.id).eq('project_id', project.id).order('date', { ascending: false }),
      fetchBoqVersions(tenant.id, project.id),
      supabase.from('project_closure').select('*').eq('tenant_id', tenant.id).eq('project_id', project.id).maybeSingle(),
      supabase.from('team_project_logs').select('log_date, created_at').eq('tenant_id', tenant.id).eq('project_id', project.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('team_project_logs').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('project_id', project.id),
      (project as Project & { team_id?: number }).team_id
        ? fetchTeamWithMembers(supabase, tenant.id, (project as Project & { team_id?: number }).team_id!)
        : Promise.resolve({ team: null, members: [] }),
      fetchProjectTeamAssignments(tenant.id, project.id, (project as Project & { team_id?: number }).team_id),
      fetchProjectPhaseHistory(tenant.id, project.id, {
        pmo_phase: (project as Project & { pmo_phase?: string }).pmo_phase,
        created_at: project.created_at,
      }),
    ])

    setPlanning(planRes.planning)
    setClosure(closureRes.data)
    setTeamAssignments(assignRes)
    setPhaseHistory(historyRes)
    setExecution({
      team: teamRes.team,
      engineer: (project as Project & { engineer?: string }).engineer,
      logCount: logCountRes.count ?? 0,
      lastLogDate: logsRes.data?.[0]?.log_date || logsRes.data?.[0]?.created_at?.slice(0, 10),
    })

    const withUrls = await Promise.all((attachRes.data || []).map(async (a: Attachment) => {
      const { data: urlData } = await supabase.storage.from('project-attachments').createSignedUrl(a.file_path, 3600)
      return { ...a, public_url: urlData?.signedUrl }
    }))
    setAttachments(withUrls)
    setVisits(visitsRes.data || [])

    const active = (boqRes.data || []).find(v => v.status === 'ACTIVE') || (boqRes.data || [])[0]
    let mats = 0
    let works = 0
    for (const l of active?.lines || []) {
      const cat = l.line_category === 'MATERIAL' || l.notes?.includes('line_category:MATERIAL') ? 'MATERIAL' : 'WORK'
      if (cat === 'MATERIAL') mats++
      else works++
    }
    setBoqSummary({ materials: mats, works: works, lines: (active?.lines || []).length })
    setLoading(false)
  }

  const p = project as Project & {
    pmo_phase?: string
    estimated_value?: number
    responsible_consultant?: string
    client_name?: string
    description?: string
  }

  function filterAttachments(match: (cat: string) => boolean) {
    return attachments.filter(a => match(a.category || ''))
  }

  const initiationAtt = filterAttachments(c => c.startsWith('مرحلة البدء'))
  const planningAtt = filterAttachments(c =>
    !c.startsWith('مرحلة البدء') && (
      c.includes('تصريح') || c.includes('جودة') || c.includes('مقايسة') || c.includes('موافقة')
    ))
  const executionAtt = filterAttachments(c => c.includes('تنفيذ') || c.includes('team-logs'))
  const closeAtt = filterAttachments(c => c.includes('إغلاق') || c.includes('closure') || c.includes('مستخلص'))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={onBack} className="btn btn-ghost btn-sm">
          <ArrowRight style={{ width: '16px', height: '16px' }} /> العودة للمتابعة
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{p.name}</h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>
            {p.code || '—'} · {lifecycleForPmoLabel(p.pmo_phase)} · عرض للاطلاع فقط
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', background: '#f3f4f6', padding: '6px', borderRadius: '12px' }}>
        {PHASE_TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              style={{
                padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                background: active ? '#1a56db' : 'transparent', color: active ? 'white' : '#6b7280',
                fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
              <Icon style={{ width: '14px', height: '14px' }} /> {t.label}
            </button>
          )
        })}
      </div>

      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Clock style={{ width: '16px', height: '16px', color: '#1a56db' }} />
          <h3 style={{ margin: 0, fontSize: '0.9rem' }}>سجل مراحل المشروع</h3>
        </div>
        {loading ? (
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>جاري تحميل السجل...</p>
        ) : !phaseHistory.length ? (
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>لا يوجد سجل مراحل بعد</p>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['المرحلة', 'تاريخ الدخول', 'تاريخ الخروج', 'المدة'].map(h => (
                    <th key={h} style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#6b7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {phaseHistory.map((row, idx) => (
                  <tr key={`${row.lifecycle_phase}-${row.entered_at}-${idx}`} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{phaseHistoryLabel(row)}</td>
                    <td style={{ padding: '8px' }}>{formatDate(row.entered_at)}</td>
                    <td style={{ padding: '8px' }}>{row.exited_at ? formatDate(row.exited_at) : '—'}</td>
                    <td style={{ padding: '8px' }}>{formatPhaseDuration(row.entered_at, row.exited_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>جاري التحميل...</div>
      ) : (
        <div className="card" style={{ padding: '20px' }}>
          {tab === 'initiation' && (
            <>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>مرحلة البدء</h3>
              <PhaseTimingBlock rows={phaseHistory} lifecycle={TAB_TO_LIFECYCLE.initiation} />
              <InfoRow label="العميل" value={p.client_name} />
              <InfoRow label="نوع المشروع" value={p.type} />
              <InfoRow label="الاستشاري" value={p.responsible_consultant} />
              <InfoRow label="القيمة التقديرية" value={p.estimated_value ? formatCurrency(Number(p.estimated_value)) : undefined} />
              <InfoRow label="تاريخ البداية" value={p.start_date ? formatDate(p.start_date) : undefined} />
              <InfoRow label="تاريخ النهاية" value={p.end_date ? formatDate(p.end_date) : undefined} />
              <InfoRow label="الوصف" value={p.description} />
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '8px' }}>مرفقات البدء</div>
                <AttachmentsList items={initiationAtt} />
              </div>
            </>
          )}

          {tab === 'planning' && (
            <>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>مرحلة التخطيط</h3>
              <PhaseTimingBlock rows={phaseHistory} lifecycle={TAB_TO_LIFECYCLE.planning} />
              {!planning ? (
                <p style={{ color: '#9ca3af', fontSize: '0.82rem' }}>لم تبدأ التخطيط بعد</p>
              ) : (
                <>
                  <InfoRow label="حالة التخطيط" value={planning.planning_status === 'closed' ? 'معتمد' : 'نشط'} />
                  <InfoRow label="رقم الحجز" value={planning.material_reservation_number} />
                  <InfoRow label="تصريح البلدية" value={planning.permit_number} />
                  <InfoRow label="المقايسة" value={boqSummary.lines ? `${boqSummary.materials} مواد · ${boqSummary.works} أعمال` : '—'} />
                  {(planning as { estimate_total_note?: string }).estimate_total_note && (
                    <InfoRow label="ملاحظة المبلغ" value={(planning as { estimate_total_note?: string }).estimate_total_note} />
                  )}
                  {planning.boq_revision_approval_file_name && (
                    <InfoRow label="موافقة تعديل المقايسة" value={planning.boq_revision_approval_file_name} />
                  )}
                  <div style={{ marginTop: '12px' }}>
                    <Link href={`/projects/planning/${project.id}/boq`} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>
                      فتح المقايسة (للاطلاع)
                    </Link>
                  </div>
                </>
              )}
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '8px' }}>مرفقات التخطيط</div>
                <AttachmentsList items={planningAtt} />
              </div>
            </>
          )}

          {tab === 'execution' && (
            <>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>مرحلة التنفيذ</h3>
              <PhaseTimingBlock rows={phaseHistory} lifecycle={TAB_TO_LIFECYCLE.execution} />
              {!execution ? (
                <p style={{ color: '#9ca3af', fontSize: '0.82rem' }}>لم يبدأ التنفيذ بعد</p>
              ) : (
                <>
                  <InfoRow label="الفريق النشط" value={execution.team?.name} />
                  <InfoRow label="المهندس" value={execution.engineer} />
                  {teamAssignments.length > 0 && (
                    <div style={{ margin: '12px 0' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '8px' }}>تسلسل الفرق</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {teamAssignments.map((a, idx) => {
                          const st = ASSIGNMENT_STATUS_STYLE[a.status]
                          return (
                            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', padding: '6px 10px', borderRadius: '8px', background: st.bg }}>
                              <span style={{ fontWeight: 700, color: '#9ca3af' }}>{idx + 1}.</span>
                              <span style={{ flex: 1, fontWeight: 600 }}>{a.team?.name || '—'}</span>
                              <span style={{ fontSize: '0.68rem', color: st.color, fontWeight: 700 }}>{ASSIGNMENT_STATUS_LABEL[a.status]}</span>
                              {a.team && (
                                <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{formatTeamTypeLabel(a.team)}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <InfoRow label="سجلات يومية" value={String(execution.logCount ?? 0)} />
                  <InfoRow label="آخر سجل" value={execution.lastLogDate} />
                </>
              )}
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '8px' }}>مرفقات التنفيذ</div>
                <AttachmentsList items={executionAtt} />
              </div>
            </>
          )}

          {tab === 'close' && (
            <>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>مرحلة الإغلاق</h3>
              <PhaseTimingBlock rows={phaseHistory} lifecycle={TAB_TO_LIFECYCLE.close} />
              {!closure ? (
                <p style={{ color: '#9ca3af', fontSize: '0.82rem' }}>لم يُغلق المشروع بعد</p>
              ) : (
                <>
                  <InfoRow label="حالة الإغلاق" value={closure.closure_status} />
                  <InfoRow label="تاريخ الإغلاق" value={closure.closed_at?.split('T')[0]} />
                </>
              )}
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '8px' }}>مرفقات الإغلاق</div>
                <AttachmentsList items={closeAtt} />
              </div>
            </>
          )}

          {tab === 'visits' && (
            <>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>الزيارات المسجلة ({visits.length})</h3>
              {!visits.length ? (
                <p style={{ color: '#9ca3af', fontSize: '0.82rem' }}>لا توجد زيارات</p>
              ) : (
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['النوع', 'التاريخ', 'المهندس', 'الموقع', 'المطابقة', 'الحالة'].map(h => (
                          <th key={h} style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#6b7280' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visits.map(v => (
                        <tr key={v.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '8px' }}>{v.type || v.visit_type || '—'}</td>
                          <td style={{ padding: '8px' }}>{v.date || '—'}</td>
                          <td style={{ padding: '8px' }}>{v.engineer || '—'}</td>
                          <td style={{ padding: '8px' }}>{v.location || '—'}</td>
                          <td style={{ padding: '8px' }}>{v.specs || '—'}</td>
                          <td style={{ padding: '8px' }}>{v.status || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
