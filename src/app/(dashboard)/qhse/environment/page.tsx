'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  Leaf, Award, Trash2, Zap, AlertTriangle,
  ClipboardCheck, Plus, X, Save, ChevronDown, ChevronUp
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ──────────────────────────────────────────────────
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ar-SA') : '—'
const fmtNum  = (n: number) => (n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const WASTE_TYPES     = ['كهربائية (WEEE)', 'كيميائية / خطرة', 'معادن وخردة', 'ورق وكرتون', 'نفايات عامة', 'بلاستيك', 'زيوت محروقة', 'أخرى']
const DISPOSAL_METHODS = ['إعادة تدوير', 'نقل لجهة معتمدة', 'حرق معتمد', 'دفن صحي', 'بيع كخردة']
const RESOURCE_TYPES  = ['كهرباء', 'مياه', 'وقود (ديزل)', 'وقود (بنزين)', 'غاز طبيعي', 'غاز LPG']
const RESOURCE_UNITS  = { 'كهرباء': 'كيلوواط/ساعة', 'مياه': 'م³', 'وقود (ديزل)': 'لتر', 'وقود (بنزين)': 'لتر', 'غاز طبيعي': 'م³', 'غاز LPG': 'كجم' }
const COMPLIANCE_CATS = ['ترخيص بيئي', 'تصريح صرف', 'اشتراط نظامي', 'معيار دولي', 'متطلب محلي']

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    'ممتثل':          ['#d1fae5', '#065f46'],
    'غير ممتثل':     ['#fee2e2', '#b91c1c'],
    'قيد التجديد':   ['#fef3c7', '#92400e'],
    'معالج':          ['#d1fae5', '#065f46'],
    'معلق':           ['#fef3c7', '#92400e'],
    'سارية':          ['#d1fae5', '#065f46'],
    'قاربت':          ['#fef3c7', '#92400e'],
    'منتهية':         ['#fee2e2', '#b91c1c'],
  }
  const [bg, color] = map[status] || ['#f3f4f6', '#374151']
  return <span style={{ background: bg, color, padding: '2px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{status}</span>
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: wide ? 700 : 580, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: open ? '1px solid #e9ecef' : 'none', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
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
export default function EnvironmentPage() {
  const { tenant, activeBranch } = useStore()
  const router = useRouter()
  const tid = tenant?.id
  const bid = activeBranch?.id

  const [certs,       setCerts]      = useState<any[]>([])
  const [waste,       setWaste]      = useState<any[]>([])
  const [energy,      setEnergy]     = useState<any[]>([])
  const [compliance,  setCompliance] = useState<any[]>([])
  const [envVisits,   setEnvVisits]  = useState<any[]>([])
  const [envIncidents,setEnvInc]     = useState<any[]>([])
  const [loading,     setLoading]    = useState(true)

  // Modals
  const [showCertModal,       setShowCertModal]       = useState(false)
  const [showWasteModal,      setShowWasteModal]      = useState(false)
  const [showEnergyModal,     setShowEnergyModal]     = useState(false)
  const [showComplianceModal, setShowComplianceModal] = useState(false)
  const [editCert,            setEditCert]            = useState<any>(null)
  const [editWaste,           setEditWaste]           = useState<any>(null)
  const [editCompliance,      setEditCompliance]      = useState<any>(null)

  // نموذج الشهادة
  const [certForm, setCertForm] = useState({
    category: 'environment', type: 'ISO 14001', name: '',
    cert_no: '', issuer: '', issue_date: '', expiry_date: '', notify_days: 60, notes: '',
  })

  // نموذج النفايات
  const [wasteForm, setWasteForm] = useState({
    waste_date: '', waste_type: 'نفايات عامة', description: '',
    quantity: '', unit: 'كجم', disposal_method: 'إعادة تدوير',
    disposal_party: '', cert_number: '', project_name: '',
    cost: '', notes: '', status: 'معالج',
  })

  // نموذج الطاقة
  const [energyForm, setEnergyForm] = useState({
    record_date: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    resource_type: 'كهرباء', quantity: '', unit: 'كيلوواط/ساعة',
    cost: '', meter_reading: '', source: '', location: '', notes: '',
  })

  // نموذج الامتثال
  const [complianceForm, setComplianceForm] = useState({
    requirement: '', category: 'ترخيص بيئي', authority: '',
    description: '', due_date: '', status: 'ممتثل',
    evidence: '', responsible: '', notes: '',
  })

  const loadData = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    try {
      const [c, w, e, comp, v, inc] = await Promise.all([
        supabase.from('qhse_certs').select('*').eq('tenant_id', tid).eq('category', 'environment').order('expiry_date'),
        supabase.from('qhse_waste_records').select('*').eq('tenant_id', tid).order('waste_date', { ascending: false }),
        supabase.from('qhse_energy_records').select('*').eq('tenant_id', tid).order('year', { ascending: false }).order('month', { ascending: false }),
        supabase.from('qhse_compliance').select('*').eq('tenant_id', tid).order('due_date'),
        supabase.from('visits').select('*').eq('tenant_id', tid).eq('branch_id', bid).eq('type', 'بيئة').order('date', { ascending: false }),
        supabase.from('qhse_incidents').select('*').eq('tenant_id', tid).eq('type', 'بيئي').order('date', { ascending: false }),
      ])
      setCerts(c.data || [])
      setWaste(w.data || [])
      setEnergy(e.data || [])
      setCompliance(comp.data || [])
      setEnvVisits(v.data || [])
      setEnvInc(inc.data || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }, [tid, bid])

  useEffect(() => { loadData() }, [loadData])

  // ── حفظ الشهادة ──
  async function saveCert() {
    if (!certForm.name || !certForm.expiry_date) { toast.error('يرجى تعبئة الاسم وتاريخ الانتهاء'); return }
    const payload = { ...certForm, tenant_id: tid, branch_id: bid }
    const { error } = editCert
      ? await supabase.from('qhse_certs').update(payload).eq('id', editCert.id)
      : await supabase.from('qhse_certs').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('✅ تم حفظ الشهادة')
    setShowCertModal(false); setEditCert(null)
    setCertForm({ category:'environment',type:'ISO 14001',name:'',cert_no:'',issuer:'',issue_date:'',expiry_date:'',notify_days:60,notes:'' })
    loadData()
  }

  // ── حفظ النفايات ──
  async function saveWaste() {
    if (!wasteForm.waste_date || !wasteForm.waste_type || !wasteForm.quantity) { toast.error('يرجى تعبئة التاريخ والنوع والكمية'); return }
    const payload = { ...wasteForm, quantity: Number(wasteForm.quantity), cost: wasteForm.cost ? Number(wasteForm.cost) : null, tenant_id: tid, branch_id: bid }
    const { error } = editWaste
      ? await supabase.from('qhse_waste_records').update(payload).eq('id', editWaste.id)
      : await supabase.from('qhse_waste_records').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('✅ تم تسجيل النفايات')
    setShowWasteModal(false); setEditWaste(null)
    setWasteForm({ waste_date:'',waste_type:'نفايات عامة',description:'',quantity:'',unit:'كجم',disposal_method:'إعادة تدوير',disposal_party:'',cert_number:'',project_name:'',cost:'',notes:'',status:'معالج' })
    loadData()
  }

  // ── حفظ استهلاك الطاقة ──
  async function saveEnergy() {
    if (!energyForm.record_date || !energyForm.resource_type || !energyForm.quantity) { toast.error('يرجى تعبئة التاريخ والنوع والكمية'); return }
    const payload = {
      ...energyForm,
      quantity: Number(energyForm.quantity),
      cost: energyForm.cost ? Number(energyForm.cost) : null,
      meter_reading: energyForm.meter_reading ? Number(energyForm.meter_reading) : null,
      tenant_id: tid, branch_id: bid,
    }
    const { error } = await supabase.from('qhse_energy_records').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('✅ تم تسجيل الاستهلاك')
    setShowEnergyModal(false)
    setEnergyForm({ record_date:'',month:new Date().getMonth()+1,year:new Date().getFullYear(),resource_type:'كهرباء',quantity:'',unit:'كيلوواط/ساعة',cost:'',meter_reading:'',source:'',location:'',notes:'' })
    loadData()
  }

  // ── حفظ متطلب الامتثال ──
  async function saveCompliance() {
    if (!complianceForm.requirement) { toast.error('يرجى إدخال المتطلب'); return }
    const payload = { ...complianceForm, tenant_id: tid, branch_id: bid }
    const { error } = editCompliance
      ? await supabase.from('qhse_compliance').update(payload).eq('id', editCompliance.id)
      : await supabase.from('qhse_compliance').insert(payload)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('✅ تم حفظ متطلب الامتثال')
    setShowComplianceModal(false); setEditCompliance(null)
    setComplianceForm({ requirement:'',category:'ترخيص بيئي',authority:'',description:'',due_date:'',status:'ممتثل',evidence:'',responsible:'',notes:'' })
    loadData()
  }

  const iCert = (k: string, v: any) => setCertForm(f => ({ ...f, [k]: v }))
  const iWaste = (k: string, v: any) => setWasteForm(f => ({ ...f, [k]: v }))
  const iEnergy = (k: string, v: any) => setEnergyForm(f => ({ ...f, [k]: v }))
  const iComp = (k: string, v: any) => setComplianceForm(f => ({ ...f, [k]: v }))

  // ── إحصاءات ──
  const expiredCerts      = certs.filter(c => c.expiry_date && new Date(c.expiry_date) < new Date()).length
  const nonCompliant      = compliance.filter(c => c.status === 'غير ممتثل').length
  const pendingRenewal    = compliance.filter(c => c.status === 'قيد التجديد').length
  const totalWasteKg      = waste.reduce((s, w) => s + (w.unit === 'كجم' ? Number(w.quantity || 0) : Number(w.quantity || 0) * (w.unit === 'طن' ? 1000 : 1)), 0)
  const thisMonthEnergy   = energy.filter(e => e.month === new Date().getMonth() + 1 && e.year === new Date().getFullYear())
  const electricityMTD    = thisMonthEnergy.filter(e => e.resource_type === 'كهرباء').reduce((s, e) => s + Number(e.quantity || 0), 0)

  // ── ملخص الطاقة الشهري ──
  const energyByMonth = (() => {
    const map: Record<string, Record<string, number>> = {}
    energy.forEach(e => {
      const key = `${e.year}-${String(e.month).padStart(2, '0')}`
      if (!map[key]) map[key] = {}
      if (!map[key][e.resource_type]) map[key][e.resource_type] = 0
      map[key][e.resource_type] += Number(e.quantity || 0)
    })
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
  })()

  // ── ملخص النفايات حسب النوع ──
  const wasteByType = (() => {
    const map: Record<string, number> = {}
    waste.forEach(w => {
      if (!map[w.waste_type]) map[w.waste_type] = 0
      map[w.waste_type] += Number(w.quantity || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  })()

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
          <Leaf size={20} style={{ color: '#059669' }} />
          إدارة البيئة (ENV)
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: 2 }}>
          شهادات البيئة، إدارة النفايات، استهلاك الطاقة، والامتثال البيئي
        </p>
      </div>

      {/* شريط ملخص */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        {[
          { label: 'شهادة منتهية',    val: expiredCerts,   color: expiredCerts > 0 ? '#dc2626' : '#059669',   bg: expiredCerts > 0 ? '#fef2f2' : '#f0fdf4' },
          { label: 'غير ممتثل',       val: nonCompliant,   color: nonCompliant > 0 ? '#dc2626' : '#059669',   bg: nonCompliant > 0 ? '#fef2f2' : '#f0fdf4' },
          { label: 'قيد التجديد',     val: pendingRenewal, color: pendingRenewal > 0 ? '#d97706' : '#059669', bg: pendingRenewal > 0 ? '#fffbeb' : '#f0fdf4' },
          { label: 'إجمالي النفايات (كجم)', val: Math.round(totalWasteKg), color: '#059669', bg: '#f0fdf4' },
          { label: 'كهرباء هذا الشهر (kWh)', val: Math.round(electricityMTD), color: '#1d4ed8', bg: '#eff6ff' },
        ].map(item => (
          <div key={item.label} style={{ background: item.bg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${item.color}30` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.val.toLocaleString('ar-SA')}</div>
            <div style={{ fontSize: '0.72rem', color: '#374151', fontWeight: 500, marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* ══ شهادات البيئة ══ */}
      <Section title="🏆 شهادات البيئة" icon={Award} color="#059669"
        action={
          <button onClick={() => setShowCertModal(true)} className="btn btn-primary btn-sm gap-1.5">
            <Plus size={14} /> إضافة شهادة
          </button>
        }>
        {certs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 36, color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
            <div style={{ fontWeight: 600 }}>لا توجد شهادات بيئية مضافة</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>أضف ISO 14001 وغيرها من الشهادات البيئية</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12, padding: 16 }}>
            {certs.map((cert: any) => {
              const days = cert.expiry_date ? Math.ceil((new Date(cert.expiry_date).getTime() - Date.now()) / 86400000) : null
              const isExpired = days !== null && days < 0
              const isSoon    = days !== null && days >= 0 && days <= 90
              return (
                <div key={cert.id} style={{ borderRadius: 12, padding: 16, border: '1px solid', borderColor: isExpired ? '#fecaca' : isSoon ? '#fde68a' : '#bbf7d0', background: isExpired ? '#fef2f2' : isSoon ? '#fffbeb' : '#f0fdf4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{cert.name || cert.type}</div>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>{cert.type}</div>
                    </div>
                    <StatusBadge status={isExpired ? 'منتهية' : isSoon ? 'قاربت' : 'سارية'} />
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {cert.cert_no  && <div>📋 رقم: <strong>{cert.cert_no}</strong></div>}
                    {cert.issuer   && <div>🏢 الجهة: <strong>{cert.issuer}</strong></div>}
                    <div>⏰ الانتهاء: <strong style={{ color: isExpired ? '#b91c1c' : isSoon ? '#92400e' : '#065f46' }}>{fmtDate(cert.expiry_date)}</strong></div>
                    {days !== null && <div style={{ fontWeight: 700, color: isExpired ? '#b91c1c' : isSoon ? '#92400e' : '#059669' }}>
                      {isExpired ? `⚠️ منتهية منذ ${Math.abs(days)} يوم` : `✅ تنتهي بعد ${days} يوم`}
                    </div>}
                  </div>
                  <button onClick={() => { setEditCert(cert); setCertForm({ category:cert.category,type:cert.type||'',name:cert.name||'',cert_no:cert.cert_no||'',issuer:cert.issuer||'',issue_date:cert.issue_date||'',expiry_date:cert.expiry_date||'',notify_days:cert.notify_days||60,notes:cert.notes||'' }); setShowCertModal(true) }}
                    style={{ marginTop: 10, background: 'none', border: '1px solid #e9ecef', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: '#6b7280', width: '100%' }}>
                    تعديل
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* ══ إدارة النفايات ══ */}
      <Section title="🗑️ إدارة النفايات" icon={Trash2} color="#6b7280"
        action={
          <button onClick={() => setShowWasteModal(true)} className="btn btn-primary btn-sm gap-1.5">
            <Plus size={14} /> تسجيل نفايات
          </button>
        }>
        <div style={{ padding: 16 }}>
          {/* ملخص حسب النوع */}
          {wasteByType.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#374151', marginBottom: 10 }}>توزيع النفايات حسب النوع</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
                {wasteByType.map(([type, qty]) => (
                  <div key={type} style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px', border: '1px solid #e9ecef' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 3 }}>{type}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{qty.toLocaleString('ar-SA')} كجم</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* جدول السجلات */}
          {waste.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🗑️</div>
              <div style={{ fontWeight: 600 }}>لا توجد سجلات نفايات</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    {['التاريخ','النوع','الكمية','طريقة التخلص','الجهة','المشروع','شهادة التخلص','الحالة',''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e9ecef', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {waste.map((w: any, i: number) => (
                    <tr key={w.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '9px 12px', color: '#6b7280' }}>{fmtDate(w.waste_date)}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 500 }}>{w.waste_type}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{fmtNum(w.quantity)} {w.unit}</td>
                      <td style={{ padding: '9px 12px', color: '#6b7280' }}>{w.disposal_method || '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#6b7280' }}>{w.disposal_party || '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#6b7280' }}>{w.project_name || '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#6b7280' }}>{w.cert_number || '—'}</td>
                      <td style={{ padding: '9px 12px' }}><StatusBadge status={w.status} /></td>
                      <td style={{ padding: '9px 12px' }}>
                        <button onClick={() => { setEditWaste(w); setWasteForm({ waste_date:w.waste_date,waste_type:w.waste_type,description:w.description||'',quantity:String(w.quantity),unit:w.unit,disposal_method:w.disposal_method||'إعادة تدوير',disposal_party:w.disposal_party||'',cert_number:w.cert_number||'',project_name:w.project_name||'',cost:String(w.cost||''),notes:w.notes||'',status:w.status }); setShowWasteModal(true) }}
                          style={{ background: 'none', border: '1px solid #e9ecef', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: '#6b7280' }}>تعديل</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      {/* ══ استهلاك الطاقة ══ */}
      <Section title="⚡ استهلاك الطاقة والموارد" icon={Zap} color="#f59e0b"
        action={
          <button onClick={() => setShowEnergyModal(true)} className="btn btn-primary btn-sm gap-1.5">
            <Plus size={14} /> تسجيل استهلاك
          </button>
        }>
        <div style={{ padding: 16 }}>
          {/* ملخص شهري */}
          {energyByMonth.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#374151', marginBottom: 10 }}>الاستهلاك الشهري (آخر 6 أشهر)</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e9ecef' }}>الشهر</th>
                      {['كهرباء (kWh)', 'مياه (م³)', 'وقود (لتر)'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e9ecef', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {energyByMonth.map(([month, data]) => (
                      <tr key={month} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{month}</td>
                        <td style={{ padding: '8px 12px', color: '#1d4ed8' }}>{(data['كهرباء'] || 0).toLocaleString('ar-SA')}</td>
                        <td style={{ padding: '8px 12px', color: '#0891b2' }}>{(data['مياه'] || 0).toLocaleString('ar-SA')}</td>
                        <td style={{ padding: '8px 12px', color: '#d97706' }}>{((data['وقود (ديزل)'] || 0) + (data['وقود (بنزين)'] || 0)).toLocaleString('ar-SA')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {energy.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>⚡</div>
              <div style={{ fontWeight: 600 }}>لا توجد سجلات استهلاك</div>
            </div>
          )}
        </div>
      </Section>

      {/* ══ الامتثال البيئي ══ */}
      <Section title="📋 الامتثال البيئي" icon={ClipboardCheck} color="#7c3aed"
        action={
          <button onClick={() => setShowComplianceModal(true)} className="btn btn-primary btn-sm gap-1.5">
            <Plus size={14} /> إضافة متطلب
          </button>
        }>
        {compliance.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 36, color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 600 }}>لا توجد متطلبات امتثال مضافة</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>أضف التراخيص البيئية والاشتراطات النظامية</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['المتطلب','التصنيف','الجهة','تاريخ الاستحقاق','المسؤول','الحالة',''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e9ecef', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compliance.map((c: any, i: number) => {
                  const overdue = c.due_date && new Date(c.due_date) < new Date() && c.status !== 'ممتثل'
                  return (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{c.requirement}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ background: '#f3e8ff', color: '#7c3aed', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{c.category}</span>
                      </td>
                      <td style={{ padding: '9px 12px', color: '#6b7280' }}>{c.authority || '—'}</td>
                      <td style={{ padding: '9px 12px', color: overdue ? '#b91c1c' : '#6b7280', fontWeight: overdue ? 700 : 400 }}>
                        {fmtDate(c.due_date)} {overdue && '⚠️'}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#6b7280' }}>{c.responsible || '—'}</td>
                      <td style={{ padding: '9px 12px' }}><StatusBadge status={c.status} /></td>
                      <td style={{ padding: '9px 12px' }}>
                        <button onClick={() => { setEditCompliance(c); setComplianceForm({ requirement:c.requirement,category:c.category,authority:c.authority||'',description:c.description||'',due_date:c.due_date||'',status:c.status,evidence:c.evidence||'',responsible:c.responsible||'',notes:c.notes||'' }); setShowComplianceModal(true) }}
                          style={{ background: 'none', border: '1px solid #e9ecef', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: '#6b7280' }}>تعديل</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ══ الحوادث البيئية ══ */}
      <Section title="⚠️ الحوادث البيئية" icon={AlertTriangle} color="#dc2626"
        action={
          <button onClick={() => router.push('/qhse/safety')} className="btn btn-ghost btn-sm gap-1.5 border border-gray-200">
            <Plus size={14} /> تسجيل حادثة
          </button>
        }>
        {envIncidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 36, color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 600 }}>لا توجد حوادث بيئية مسجلة</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>سجّل الحوادث من صفحة السلامة واختر النوع "بيئي"</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['التاريخ','الموقع','الخطورة','الوصف','الإجراء','الحالة'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e9ecef' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {envIncidents.map((inc: any, i: number) => (
                  <tr key={inc.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{fmtDate(inc.date)}</td>
                    <td style={{ padding: '9px 12px' }}>{inc.location || '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ background: inc.severity === 'عالية' ? '#fee2e2' : inc.severity === 'متوسطة' ? '#fef3c7' : '#d1fae5', color: inc.severity === 'عالية' ? '#b91c1c' : inc.severity === 'متوسطة' ? '#92400e' : '#065f46', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{inc.severity}</span>
                    </td>
                    <td style={{ padding: '9px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>{inc.description || '—'}</td>
                    <td style={{ padding: '9px 12px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>{inc.action || '—'}</td>
                    <td style={{ padding: '9px 12px' }}><StatusBadge status={inc.status === 'مفتوح' ? 'غير ممتثل' : 'ممتثل'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ══ زيارات البيئة ══ */}
      <Section title="🌿 الزيارات البيئية الميدانية" icon={Leaf} color="#059669"
        action={
          <button onClick={() => router.push('/visits')} className="btn btn-ghost btn-sm gap-1.5 border border-gray-200">
            <Plus size={14} /> إضافة زيارة
          </button>
        }>
        {envVisits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 36, color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🌿</div>
            <div style={{ fontWeight: 600 }}>لا توجد زيارات بيئية مسجلة</div>
            <button onClick={() => router.push('/visits')} style={{ marginTop: 10, padding: '6px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#059669' }}>انتقل لصفحة الزيارات</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['التاريخ','المهندس','الموقع','النتيجة','NCR','تاريخ الإغلاق'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e9ecef' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {envVisits.map((v: any, i: number) => (
                  <tr key={v.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{fmtDate(v.date)}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 500 }}>{v.engineer}</td>
                    <td style={{ padding: '9px 12px' }}>{v.location || '—'}</td>
                    <td style={{ padding: '9px 12px' }}><StatusBadge status={v.specs === 'مطابق' ? 'ممتثل' : 'غير ممتثل'} /></td>
                    <td style={{ padding: '9px 12px' }}>{v.specs === 'غير مطابق' ? <StatusBadge status={v.resolved_report ? 'ممتثل' : 'غير ممتثل'} /> : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>}</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{v.resolved_date ? fmtDate(v.resolved_date) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ════ Modals ════ */}

      {/* Modal الشهادة */}
      {showCertModal && (
        <Modal title={editCert ? 'تعديل الشهادة' : 'إضافة شهادة بيئية'} onClose={() => { setShowCertModal(false); setEditCert(null) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع المعيار</label>
                <select value={certForm.type} onChange={e => { iCert('type', e.target.value); if (!certForm.name) iCert('name', e.target.value) }} className="input">
                  {['ISO 14001', 'ISO 50001', 'EMAS', 'Green Star', 'أخرى'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الشهادة *</label>
                <input value={certForm.name} onChange={e => iCert('name', e.target.value)} className="input" placeholder="مثال: شهادة ISO 14001:2015" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الشهادة</label>
                <input value={certForm.cert_no} onChange={e => iCert('cert_no', e.target.value)} className="input" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الجهة المانحة</label>
                <input value={certForm.issuer} onChange={e => iCert('issuer', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الإصدار</label>
                <input type="date" value={certForm.issue_date} onChange={e => iCert('issue_date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الانتهاء *</label>
                <input type="date" value={certForm.expiry_date} onChange={e => iCert('expiry_date', e.target.value)} className="input" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCertModal(false); setEditCert(null) }} className="btn btn-ghost btn-sm">إلغاء</button>
              <button onClick={saveCert} className="btn btn-primary btn-sm gap-1.5"><Save size={14} /> حفظ</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal النفايات */}
      {showWasteModal && (
        <Modal title={editWaste ? 'تعديل سجل النفايات' : 'تسجيل نفايات جديدة'} onClose={() => { setShowWasteModal(false); setEditWaste(null) }} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ *</label>
                <input type="date" value={wasteForm.waste_date} onChange={e => iWaste('waste_date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع النفايات *</label>
                <select value={wasteForm.waste_type} onChange={e => iWaste('waste_type', e.target.value)} className="input">
                  {WASTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 2 }}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الكمية *</label>
                  <input type="number" value={wasteForm.quantity} onChange={e => iWaste('quantity', e.target.value)} className="input" min={0} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الوحدة</label>
                  <select value={wasteForm.unit} onChange={e => iWaste('unit', e.target.value)} className="input">
                    {['كجم', 'طن', 'لتر', 'م³', 'عبوة'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">طريقة التخلص</label>
                <select value={wasteForm.disposal_method} onChange={e => iWaste('disposal_method', e.target.value)} className="input">
                  {DISPOSAL_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الجهة المتخلصة</label>
                <input value={wasteForm.disposal_party} onChange={e => iWaste('disposal_party', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم شهادة التخلص</label>
                <input value={wasteForm.cert_number} onChange={e => iWaste('cert_number', e.target.value)} className="input" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المشروع</label>
                <input value={wasteForm.project_name} onChange={e => iWaste('project_name', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التكلفة (ر.س)</label>
                <input type="number" value={wasteForm.cost} onChange={e => iWaste('cost', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                <select value={wasteForm.status} onChange={e => iWaste('status', e.target.value)} className="input">
                  <option value="معالج">معالج</option>
                  <option value="معلق">معلق</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
              <textarea value={wasteForm.notes} onChange={e => iWaste('notes', e.target.value)} className="input" rows={2} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowWasteModal(false); setEditWaste(null) }} className="btn btn-ghost btn-sm">إلغاء</button>
              <button onClick={saveWaste} className="btn btn-primary btn-sm gap-1.5"><Save size={14} /> حفظ</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal استهلاك الطاقة */}
      {showEnergyModal && (
        <Modal title="تسجيل استهلاك طاقة وموارد" onClose={() => setShowEnergyModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ *</label>
                <input type="date" value={energyForm.record_date} onChange={e => { iEnergy('record_date', e.target.value); const d = new Date(e.target.value); iEnergy('month', d.getMonth()+1); iEnergy('year', d.getFullYear()) }} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع المورد *</label>
                <select value={energyForm.resource_type} onChange={e => { iEnergy('resource_type', e.target.value); iEnergy('unit', (RESOURCE_UNITS as any)[e.target.value] || '') }} className="input">
                  {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية *</label>
                <input type="number" value={energyForm.quantity} onChange={e => iEnergy('quantity', e.target.value)} className="input" min={0} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوحدة</label>
                <input value={energyForm.unit} onChange={e => iEnergy('unit', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التكلفة (ر.س)</label>
                <input type="number" value={energyForm.cost} onChange={e => iEnergy('cost', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">قراءة العداد</label>
                <input type="number" value={energyForm.meter_reading} onChange={e => iEnergy('meter_reading', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المصدر / المورد</label>
                <input value={energyForm.source} onChange={e => iEnergy('source', e.target.value)} className="input" placeholder="شركة الكهرباء / محطة وقود..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الموقع / المشروع</label>
                <input value={energyForm.location} onChange={e => iEnergy('location', e.target.value)} className="input" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEnergyModal(false)} className="btn btn-ghost btn-sm">إلغاء</button>
              <button onClick={saveEnergy} className="btn btn-primary btn-sm gap-1.5"><Save size={14} /> حفظ</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal الامتثال */}
      {showComplianceModal && (
        <Modal title={editCompliance ? 'تعديل متطلب الامتثال' : 'إضافة متطلب امتثال بيئي'} onClose={() => { setShowComplianceModal(false); setEditCompliance(null) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المتطلب *</label>
              <input value={complianceForm.requirement} onChange={e => iComp('requirement', e.target.value)} className="input" placeholder="مثال: ترخيص تشغيل بيئي من وزارة البيئة" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التصنيف</label>
                <select value={complianceForm.category} onChange={e => iComp('category', e.target.value)} className="input">
                  {COMPLIANCE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الجهة المنظمة</label>
                <input value={complianceForm.authority} onChange={e => iComp('authority', e.target.value)} className="input" placeholder="وزارة البيئة / البلدية..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الاستحقاق / التجديد</label>
                <input type="date" value={complianceForm.due_date} onChange={e => iComp('due_date', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المسؤول</label>
                <input value={complianceForm.responsible} onChange={e => iComp('responsible', e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                <select value={complianceForm.status} onChange={e => iComp('status', e.target.value)} className="input">
                  <option value="ممتثل">ممتثل</option>
                  <option value="قيد التجديد">قيد التجديد</option>
                  <option value="غير ممتثل">غير ممتثل</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الوثيقة / الرابط</label>
                <input value={complianceForm.evidence} onChange={e => iComp('evidence', e.target.value)} className="input" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
              <textarea value={complianceForm.description} onChange={e => iComp('description', e.target.value)} className="input" rows={2} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowComplianceModal(false); setEditCompliance(null) }} className="btn btn-ghost btn-sm">إلغاء</button>
              <button onClick={saveCompliance} className="btn btn-primary btn-sm gap-1.5"><Save size={14} /> حفظ</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
