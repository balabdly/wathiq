'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { fetchProjectPlanning } from '@/lib/project-planning-service'
import { fetchBoqVersions } from '@/lib/pmc-service'
import { fetchTeamWithMembers } from '@/lib/project-teams'
import { phaseLabel } from '@/lib/sec-workflow'
import { formatDate, formatCurrency } from '@/lib/utils'
import {
  ArrowRight, Download, FileText, Image, File, ClipboardList, HardHat, Archive, Rocket,
} from 'lucide-react'
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

  useEffect(() => {
    if (!tenant) return
    loadAll()
  }, [tenant?.id, project.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [planRes, attachRes, visitsRes, boqRes, closureRes, logsRes, logCountRes, teamRes] = await Promise.all([
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
    ])

    setPlanning(planRes.planning)
    setClosure(closureRes.data)
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
            {p.code || '—'} · {phaseLabel(p.pmo_phase as any) || p.status} · عرض للاطلاع فقط
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>جاري التحميل...</div>
      ) : (
        <div className="card" style={{ padding: '20px' }}>
          {tab === 'initiation' && (
            <>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>مرحلة البدء</h3>
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
              {!execution ? (
                <p style={{ color: '#9ca3af', fontSize: '0.82rem' }}>لم يبدأ التنفيذ بعد</p>
              ) : (
                <>
                  <InfoRow label="الفريق" value={execution.team?.name} />
                  <InfoRow label="المهندس" value={execution.engineer} />
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
