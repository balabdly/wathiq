'use client'
import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  CheckCircle, ClipboardCheck, Award, TrendingUp,
  Plus, X, Save, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ──────────────────────────────────────────────────
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ar-SA') : '—'
const fmtDays = (d: string) => {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

const STANDARDS = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'ISO 50001', 'OHSAS 18001', 'ISO 17025', 'أخرى']
const AUDIT_TYPES = ['داخلي', 'خارجي', 'طرف ثالث (Third Party)']
const RESULTS = ['مطابق', 'غير مطابق جزئياً', 'غير مطابق']

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    'مطابق':                ['#d1fae5', '#065f46'],
    'غير مطابق جزئياً':   ['#fef3c7', '#92400e'],
    'غير مطابق':           ['#fee2e2', '#b91c1c'],
    'مفتوح':               ['#fef3c7', '#92400e'],
    'مغلق':                ['#d1fae5', '#065f46'],
    'قيد المعالجة':        ['#eff6ff', '#1d4ed8'],
    'سارية':               ['#d1fae5', '#065f46'],
    'قاربت':               ['#fef3c7', '#92400e'],
    'منتهية':              ['#fee2e2', '#b91c1c'],
  }
  const [bg, color] = map[status] || ['#f3f4f6', '#374151']
  return (
    <span style={{ background: bg, color, padding: '2px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: wide ? 760 : 600, maxHeight: '90vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e9ecef', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, color, children, action }: {
  title: string; icon: any; color: string; children: React.ReactNode; action?: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="card overflow-hidden">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: open ? '1px solid #e9ecef' : 'none', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={17} style={{ color }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
          {action}
          <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      {open && <div>{children}</div>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
export default function QualityPage() {
  const { tenant, activeBranch } = useStore()
  const router = useRouter()
  const tid = tenant?.id
  const bid = activeBranch?.id

  const [audits,       setAudits]      = useState<any[]>([])
  const [certs,        setCerts]       = useState<any[]>([])
  const [qualityVisits,setQVisits]     = useState<any[]>([])
  const [loading,      setLoading]     = useState(true)

  // Modals
  const [showAuditModal,  setShowAuditModal]  = useState(false)
  const [showCertModal,   setShowCertModal]   = useState(false)
  const [showActionModal, setShowActionModal] = useState(false)
  const [editAudit,       setEditAudit]       = useState<any>(null)
  const [editCert,        setEditCert]        = useState<any>(null)
  const [viewAudit,       setViewAudit]       = useState<any>(null)

  // نماذج
  const [auditForm, setAuditForm] = useState({
    audit_type: 'داخلي', audit_no: '', date: '', auditor: '',
    org_name: '', standard: 'ISO 9001', scope: '',
    result: 'مطابق', major_nc: 0, minor_nc: 0,
    observations: '', corrective: '', followup_date: '',
    status: 'مفتوح', notes: '',
  })
  const [certForm, setCertForm] = useState({
    category: 'quality', type: 'ISO 9001', name: '',
    cert_no: '', issuer: '', issue_date: '',
    expiry_date: '', notify_days: 60, notes: '',
  })
  const [actionForm, setActionForm] = useState({
    audit_id: '', type: 'تصحيحي', description: '',
    root_cause: '', action: '', responsible: '',
    due_date: '', status: 'مفتوح', notes: '',
  })

  const loadData = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    try {
      const [a, c, v] = await Promise.all([
        supabase.from('qhse_audits').select('*').eq('tenant_id', tid).order('date', { ascending: false }),
        supabase.from('qhse_certs').select('*').eq('tenant_id', tid).in('category', ['quality']).order('expiry_date'),
        supabase.from('visits').select('*').eq('tenant_id', tid).eq('branch_id', bid).eq('type', 'جودة').order('date', { ascending: false }),
      ])
      setAudits(a.data || [])
      setCerts(c.data || [])
      setQVisits(v.data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [tid, bid])

  useEffect(() => { loadData() }, [loadData])

  // ── حفظ التدقيق ──
  async function saveAudit() {
    if (!auditForm.date || !auditForm.auditor || !auditForm.standard) {
      toast.error('يرجى تعبئة التاريخ والمدقق والمعيار'); return
    }
    const payload = {
      ...auditForm,
      major_nc: Number(auditForm.major_nc),
      minor_nc: Number(auditForm.minor_nc),
      tenant_id: tid, branch_id: bid,
    }
    const { error } = editAudit
      ? await supabase.from('qhse_audits').update(payload).eq('id', editAudit.id)
      : await supabase.from('qhse_audits').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success(editAudit ? '✅ تم تحديث التدقيق' : '✅ تم تسجيل التدقيق')
    setShowAuditModal(false); setEditAudit(null)
    resetAuditForm(); loadData()
  }

  // ── حفظ الشهادة ──
  async function saveCert() {
    if (!certForm.name || !certForm.expiry_date) {
      toast.error('يرجى تعبئة اسم الشهادة وتاريخ الانتهاء'); return
    }
    const payload = { ...certForm, tenant_id: tid, branch_id: bid }
    const { error } = editCert
      ? await supabase.from('qhse_certs').update(payload).eq('id', editCert.id)
      : await supabase.from('qhse_certs').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('✅ تم حفظ الشهادة')
    setShowCertModal(false); setEditCert(null)
    resetCertForm(); loadData()
  }

  // ── تحديث حالة التدقيق ──
  async function updateAuditStatus(id: number, status: string) {
    const { error } = await supabase.from('qhse_audits').update({ status }).eq('id', id)
    if (error) { toast.error('خطأ'); return }
    toast.success('تم تحديث الحالة')
    loadData()
  }

  const resetAuditForm = () => setAuditForm({ audit_type:'داخلي',audit_no:'',date:'',auditor:'',org_name:'',standard:'ISO 9001',scope:'',result:'مطابق',major_nc:0,minor_nc:0,observations:'',corrective:'',followup_date:'',status:'مفتوح',notes:'' })
  const resetCertForm  = () => setCertForm({ category:'quality',type:'ISO 9001',name:'',cert_no:'',issuer:'',issue_date:'',expiry_date:'',notify_days:60,notes:'' })

  const iA = (k: string, v: any) => setAuditForm(f => ({ ...f, [k]: v }))
  const iC = (k: string, v: any) => setCertForm(f => ({ ...f, [k]: v }))

  // ── إحصاءات سريعة ──
  const openAudits    = audits.filter(a => a.status === 'مفتوح').length
  const totalNC       = audits.reduce((s, a) => s + Number(a.major_nc || 0) + Number(a.minor_nc || 0), 0)
  const pendingNCR    = audits.filter(a => (a.major_nc > 0 || a.minor_nc > 0) && a.status !== 'مغلق').length
  const expiredCerts  = certs.filter(c => c.expiry_date && new Date(c.expiry_date) < new Date()).length
  const pendingVisits = qualityVisits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 fade-in" dir="rtl">

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={20} style={{ color: 'var(--primary)' }} />
          إدارة الجودة (QC)
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: 2 }}>
          شهادات الجودة، التدقيق الداخلي والخارجي، سجل عدم المطابقة، وزيارات الجودة
        </p>
      </div>

      {/* شريط ملخص سريع */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {[
          { label: 'تدقيق مفتوح',       val: openAudits,    color: openAudits > 0 ? '#dc2626' : '#059669',    bg: openAudits > 0 ? '#fef2f2' : '#f0fdf4' },
          { label: 'إجمالي NC',          val: totalNC,       color: totalNC > 0 ? '#d97706' : '#059669',       bg: totalNC > 0 ? '#fffbeb' : '#f0fdf4' },
          { label: 'NCR معلقة',          val: pendingNCR,    color: pendingNCR > 0 ? '#dc2626' : '#059669',    bg: pendingNCR > 0 ? '#fef2f2' : '#f0fdf4' },
          { label: 'شهادة منتهية',       val: expiredCerts,  color: expiredCerts > 0 ? '#dc2626' : '#059669',  bg: expiredCerts > 0 ? '#fef2f2' : '#f0fdf4' },
          { label: 'زيارات جودة معلقة', val: pendingVisits, color: pendingVisits > 0 ? '#d97706' : '#059669', bg: pendingVisits > 0 ? '#fffbeb' : '#f0fdf4' },
        ].map(item => (
          <div key={item.label} style={{ background: item.bg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${item.color}30` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.val}</div>
            <div style={{ fontSize: '0.75rem', color: '#374151', fontWeight: 500, marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* ══ شهادات الجودة ══ */}
      <Section title="🏆 شهادات الجودة" icon={Award} color="#f59e0b"
        action={
          <button onClick={() => setShowCertModal(true)} className="btn btn-primary btn-sm gap-1.5">
            <Plus size={14} /> إضافة شهادة
          </button>
        }>
        {certs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 36, color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
            <div style={{ fontWeight: 600 }}>لا توجد شهادات جودة مضافة</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>أضف شهادات ISO والاعتمادات الخاصة بالشركة</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, padding: 16 }}>
            {certs.map((cert: any) => {
              const days = fmtDays(cert.expiry_date)
              const isExpired = days !== null && days < 0
              const isSoon    = days !== null && days >= 0 && days <= 90
              const statusStr = isExpired ? 'منتهية' : isSoon ? 'قاربت' : 'سارية'
              return (
                <div key={cert.id} style={{
                  borderRadius: 12, padding: 16, border: '1px solid',
                  borderColor: isExpired ? '#fecaca' : isSoon ? '#fde68a' : '#bbf7d0',
                  background: isExpired ? '#fef2f2' : isSoon ? '#fffbeb' : '#f0fdf4',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{cert.name || cert.type}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{cert.type}</div>
                    </div>
                    <StatusBadge status={statusStr} />
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {cert.cert_no  && <div>📋 رقم الشهادة: <strong>{cert.cert_no}</strong></div>}
                    {cert.issuer   && <div>🏢 الجهة المانحة: <strong>{cert.issuer}</strong></div>}
                    {cert.issue_date && <div>📅 تاريخ الإصدار: <strong>{fmtDate(cert.issue_date)}</strong></div>}
                    <div>⏰ تاريخ الانتهاء: <strong style={{ color: isExpired ? '#b91c1c' : isSoon ? '#92400e' : '#065f46' }}>{fmtDate(cert.expiry_date)}</strong></div>
                    {days !== null && (
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: isExpired ? '#b91c1c' : isSoon ? '#92400e' : '#059669', marginTop: 4 }}>
                        {isExpired ? `⚠️ منتهية منذ ${Math.abs(days)} يوم` : `✅ تنتهي بعد ${days} يوم`}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setEditCert(cert); setCertForm({ category:cert.category,type:cert.type||'',name:cert.name||'',cert_no:cert.cert_no||'',issuer:cert.issuer||'',issue_date:cert.issue_date||'',expiry_date:cert.expiry_date||'',notify_days:cert.notify_days||60,notes:cert.notes||'' }); setShowCertModal(true) }}
                    style={{ marginTop: 12, background: 'none', border: '1px solid #e9ecef', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: '#6b7280', width: '100%' }}>
                    تعديل
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* ══ التدقيق ══ */}
      <Section title="🔍 جلسات التدقيق الداخلي والخارجي" icon={ClipboardCheck} color="#1a56db"
        action={
          <button onClick={() => { resetAuditForm(); setShowAuditModal(true) }} className="btn btn-primary btn-sm gap-1.5">
            <Plus size={14} /> تسجيل تدقيق
          </button>
        }>
        {audits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 36, color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
            <div style={{ fontWeight: 600 }}>لا توجد جلسات تدقيق مسجلة</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['رقم التدقيق','النوع','المعيار','التاريخ','المدقق','النتيجة','Major NC','Minor NC','المتابعة','الحالة',''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e9ecef', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audits.map((audit: any, i: number) => (
                  <tr key={audit.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1a56db' }}>{audit.audit_no || `#${audit.id}`}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ background: audit.audit_type === 'داخلي' ? '#eff6ff' : '#f5f3ff', color: audit.audit_type === 'داخلي' ? '#1d4ed8' : '#7c3aed', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                        {audit.audit_type}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 500 }}>{audit.standard}</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{fmtDate(audit.date)}</td>
                    <td style={{ padding: '9px 12px' }}>{audit.auditor}</td>
                    <td style={{ padding: '9px 12px' }}><StatusBadge status={audit.result} /></td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      {audit.major_nc > 0
                        ? <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{audit.major_nc}</span>
                        : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      {audit.minor_nc > 0
                        ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{audit.minor_nc}</span>
                        : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 12px', color: audit.followup_date && new Date(audit.followup_date) < new Date() && audit.status !== 'مغلق' ? '#b91c1c' : '#6b7280' }}>
                      {fmtDate(audit.followup_date)}
                    </td>
                    <td style={{ padding: '9px 12px' }}><StatusBadge status={audit.status} /></td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => setViewAudit(audit)}
                          style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: '#1d4ed8' }}>
                          عرض
                        </button>
                        <button
                          onClick={() => { setEditAudit(audit); setAuditForm({ audit_type:audit.audit_type,audit_no:audit.audit_no||'',date:audit.date,auditor:audit.auditor,org_name:audit.org_name||'',standard:audit.standard,scope:audit.scope||'',result:audit.result,major_nc:audit.major_nc||0,minor_nc:audit.minor_nc||0,observations:audit.observations||'',corrective:audit.corrective||'',followup_date:audit.followup_date||'',status:audit.status,notes:audit.notes||'' }); setShowAuditModal(true) }}
                          style={{ background: 'none', border: '1px solid #e9ecef', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: '#6b7280' }}>
                          تعديل
                        </button>
                        {audit.status !== 'مغلق' && (
                          <button
                            onClick={() => updateAuditStatus(audit.id, 'مغلق')}
                            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: '#065f46' }}>
                            إغلاق
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ══ سجل NCR ══ */}
      <Section title="📋 سجل عدم المطابقة (NCR)" icon={AlertTriangle} color="#dc2626">
        {audits.filter(a => a.major_nc > 0 || a.minor_nc > 0).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 36, color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 600 }}>لا توجد مخالفات مسجلة</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['رقم التدقيق','المعيار','التاريخ','نوع NC','الملاحظات','الإجراء التصحيحي','تاريخ المتابعة','الحالة'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e9ecef', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audits.filter(a => a.major_nc > 0 || a.minor_nc > 0).map((audit: any, i: number) => (
                  <React.Fragment key={audit.id}>
                    {audit.major_nc > 0 && (
                      <tr style={{ background: i % 2 === 0 ? '#fff5f5' : '#fef2f2' }}>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1a56db' }}>{audit.audit_no || `#${audit.id}`}</td>
                        <td style={{ padding: '9px 12px', fontWeight: 500 }}>{audit.standard}</td>
                        <td style={{ padding: '9px 12px', color: '#6b7280' }}>{fmtDate(audit.date)}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>Major NC ({audit.major_nc})</span>
                        </td>
                        <td style={{ padding: '9px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>{audit.observations || '—'}</td>
                        <td style={{ padding: '9px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>{audit.corrective || '—'}</td>
                        <td style={{ padding: '9px 12px', color: audit.followup_date && new Date(audit.followup_date) < new Date() && audit.status !== 'مغلق' ? '#b91c1c' : '#6b7280' }}>{fmtDate(audit.followup_date)}</td>
                        <td style={{ padding: '9px 12px' }}><StatusBadge status={audit.status} /></td>
                      </tr>
                    )}
                    {audit.minor_nc > 0 && (
                      <tr style={{ background: i % 2 === 0 ? '#fffdf0' : '#fffbeb' }}>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1a56db' }}>{audit.audit_no || `#${audit.id}`}</td>
                        <td style={{ padding: '9px 12px', fontWeight: 500 }}>{audit.standard}</td>
                        <td style={{ padding: '9px 12px', color: '#6b7280' }}>{fmtDate(audit.date)}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>Minor NC ({audit.minor_nc})</span>
                        </td>
                        <td style={{ padding: '9px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>{audit.observations || '—'}</td>
                        <td style={{ padding: '9px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>{audit.corrective || '—'}</td>
                        <td style={{ padding: '9px 12px', color: '#6b7280' }}>{fmtDate(audit.followup_date)}</td>
                        <td style={{ padding: '9px 12px' }}><StatusBadge status={audit.status} /></td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ══ زيارات الجودة ══ */}
      <Section title="🔎 زيارات الجودة الميدانية" icon={CheckCircle} color="#059669"
        action={
          <button onClick={() => router.push('/visits')} className="btn btn-ghost btn-sm gap-1.5 border border-gray-200">
            <Plus size={14} /> إضافة زيارة
          </button>
        }>
        {qualityVisits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 36, color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔎</div>
            <div style={{ fontWeight: 600 }}>لا توجد زيارات جودة مسجلة</div>
            <button onClick={() => router.push('/visits')} style={{ marginTop: 10, padding: '6px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#059669' }}>
              انتقل لصفحة الزيارات
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['التاريخ','المهندس','الموقع','النتيجة','NCR','الإجراء التصحيحي','تاريخ الإغلاق'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e9ecef', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qualityVisits.map((v: any, i: number) => (
                  <tr key={v.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{fmtDate(v.date)}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 500 }}>{v.engineer}</td>
                    <td style={{ padding: '9px 12px' }}>{v.location || '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <StatusBadge status={v.specs === 'مطابق' ? 'مطابق' : 'غير مطابق'} />
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {v.specs === 'غير مطابق'
                        ? <StatusBadge status={v.resolved_report ? 'مغلق' : 'مفتوح'} />
                        : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>{v.corrective || '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{v.resolved_date ? fmtDate(v.resolved_date) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ══ إجراءات التحسين ══ */}
      <Section title="📈 إجراءات التحسين المستمر (CAPA)" icon={TrendingUp} color="#7c3aed">
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: 'إجراء تصحيحي (CA)', desc: 'معالجة مخالفة موجودة', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
              { label: 'إجراء وقائي (PA)',   desc: 'منع وقوع مخالفة محتملة', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
              { label: 'فرصة تحسين (OFI)',   desc: 'تحسين الأداء العام',    color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
            ].map(item => (
              <div key={item.label} style={{ padding: 14, borderRadius: 10, background: item.bg, border: `1px solid ${item.border}` }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: item.color, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 10 }}>{item.desc}</div>
                <button
                  onClick={() => { setActionForm(f => ({ ...f, type: item.label.includes('تصحيحي') ? 'تصحيحي' : item.label.includes('وقائي') ? 'وقائي' : 'تحسين' })); setShowActionModal(true) }}
                  style={{ background: 'white', border: `1px solid ${item.border}`, borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: item.color, fontWeight: 600 }}>
                  + إضافة
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: 14, background: '#f8f9fa', borderRadius: 10, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            سيظهر هنا سجل إجراءات التحسين — قيد التطوير
          </div>
        </div>
      </Section>

      {/* ════ Modals ════ */}

      {/* Modal التدقيق */}
      {showAuditModal && (
        <Modal title={editAudit ? 'تعديل جلسة التدقيق' : 'تسجيل جلسة تدقيق جديدة'} onClose={() => { setShowAuditModal(false); setEditAudit(null) }} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع التدقيق *</label>
                <select value={auditForm.audit_type} onChange={e => iA('audit_type', e.target.value)} className="input">
                  {AUDIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المعيار *</label>
                <select value={auditForm.standard} onChange={e => iA('standard', e.target.value)} className="input">
                  {STANDARDS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم التدقيق</label>
                <input value={auditForm.audit_no} onChange={e => iA('audit_no', e.target.value)} className="input" dir="ltr" placeholder="AUD-2026-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ *</label>
                <input type="date" value={auditForm.date} onChange={e => iA('date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المدقق *</label>
                <input value={auditForm.auditor} onChange={e => iA('auditor', e.target.value)} className="input" placeholder="اسم المدقق" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الجهة المدققة</label>
                <input value={auditForm.org_name} onChange={e => iA('org_name', e.target.value)} className="input" placeholder="اسم الجهة (للخارجي)" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نطاق التدقيق</label>
              <input value={auditForm.scope} onChange={e => iA('scope', e.target.value)} className="input" placeholder="مثال: إجراءات الجودة في قسم التنفيذ" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">النتيجة</label>
                <select value={auditForm.result} onChange={e => iA('result', e.target.value)} className="input">
                  {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Major NC</label>
                <input type="number" value={auditForm.major_nc} onChange={e => iA('major_nc', Number(e.target.value))} className="input" min={0} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minor NC</label>
                <input type="number" value={auditForm.minor_nc} onChange={e => iA('minor_nc', Number(e.target.value))} className="input" min={0} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الملاحظات والمخالفات</label>
              <textarea value={auditForm.observations} onChange={e => iA('observations', e.target.value)} className="input" rows={3} placeholder="وصف المخالفات والملاحظات..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الإجراء التصحيحي المطلوب</label>
              <textarea value={auditForm.corrective} onChange={e => iA('corrective', e.target.value)} className="input" rows={2} placeholder="الإجراءات المطلوبة لإغلاق المخالفات..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ المتابعة</label>
                <input type="date" value={auditForm.followup_date} onChange={e => iA('followup_date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                <select value={auditForm.status} onChange={e => iA('status', e.target.value)} className="input">
                  <option value="مفتوح">مفتوح</option>
                  <option value="قيد المعالجة">قيد المعالجة</option>
                  <option value="مغلق">مغلق</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات إضافية</label>
              <textarea value={auditForm.notes} onChange={e => iA('notes', e.target.value)} className="input" rows={2} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAuditModal(false); setEditAudit(null) }} className="btn btn-ghost btn-sm">إلغاء</button>
              <button onClick={saveAudit} className="btn btn-primary btn-sm gap-1.5"><Save size={14} /> حفظ</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal الشهادة */}
      {showCertModal && (
        <Modal title={editCert ? 'تعديل الشهادة' : 'إضافة شهادة جودة'} onClose={() => { setShowCertModal(false); setEditCert(null) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع المعيار</label>
                <select value={certForm.type} onChange={e => { iC('type', e.target.value); if (!certForm.name) iC('name', e.target.value) }} className="input">
                  {STANDARDS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الشهادة *</label>
                <input value={certForm.name} onChange={e => iC('name', e.target.value)} className="input" placeholder="مثال: شهادة ISO 9001:2015" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الشهادة</label>
                <input value={certForm.cert_no} onChange={e => iC('cert_no', e.target.value)} className="input" dir="ltr" placeholder="CERT-0001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الجهة المانحة</label>
                <input value={certForm.issuer} onChange={e => iC('issuer', e.target.value)} className="input" placeholder="مثال: Bureau Veritas" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الإصدار</label>
                <input type="date" value={certForm.issue_date} onChange={e => iC('issue_date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الانتهاء *</label>
                <input type="date" value={certForm.expiry_date} onChange={e => iC('expiry_date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التنبيه قبل الانتهاء (يوم)</label>
                <input type="number" value={certForm.notify_days} onChange={e => iC('notify_days', Number(e.target.value))} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
              <textarea value={certForm.notes} onChange={e => iC('notes', e.target.value)} className="input" rows={2} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCertModal(false); setEditCert(null) }} className="btn btn-ghost btn-sm">إلغاء</button>
              <button onClick={saveCert} className="btn btn-primary btn-sm gap-1.5"><Save size={14} /> حفظ</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal عرض التدقيق */}
      {viewAudit && (
        <Modal title={`تفاصيل التدقيق — ${viewAudit.audit_no || '#' + viewAudit.id}`} onClose={() => setViewAudit(null)} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                ['نوع التدقيق', viewAudit.audit_type],
                ['المعيار', viewAudit.standard],
                ['التاريخ', fmtDate(viewAudit.date)],
                ['المدقق', viewAudit.auditor],
                ['الجهة', viewAudit.org_name || '—'],
                ['النتيجة', viewAudit.result],
                ['Major NC', viewAudit.major_nc || 0],
                ['Minor NC', viewAudit.minor_nc || 0],
                ['الحالة', viewAudit.status],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 3 }}>{k}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{v}</div>
                </div>
              ))}
            </div>
            {viewAudit.scope && <div><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>نطاق التدقيق</div><div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px', fontSize: '0.875rem' }}>{viewAudit.scope}</div></div>}
            {viewAudit.observations && <div><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>الملاحظات والمخالفات</div><div style={{ background: '#fff5f5', borderRadius: 8, padding: '10px 12px', fontSize: '0.875rem', border: '1px solid #fecaca' }}>{viewAudit.observations}</div></div>}
            {viewAudit.corrective && <div><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>الإجراء التصحيحي</div><div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px', fontSize: '0.875rem', border: '1px solid #bbf7d0' }}>{viewAudit.corrective}</div></div>}
            {viewAudit.followup_date && <div><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>تاريخ المتابعة</div><div style={{ fontWeight: 600 }}>{fmtDate(viewAudit.followup_date)}</div></div>}
          </div>
        </Modal>
      )}
    </div>
  )
}

// نحتاج React للـ Fragment
import React from 'react'
