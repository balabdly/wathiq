'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  Users, ArrowRight, Pencil, FileText, Calendar, Clock,
  ShieldAlert, Banknote, BookOpen, AlertTriangle, Plus,
  Printer, Save, X, CheckCircle2, XCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

// ══════════════════════════════════════
// Types
// ══════════════════════════════════════
type HREmployee = {
  id: number; tenant_id: string; employee_id: number
  employee_number?: string
  first_name?: string; father_name?: string
  grandfather_name?: string; family_name?: string
  first_name_en?: string; family_name_en?: string
  national_id?: string; nationality: string; birth_date?: string
  gender: string; marital_status: string; hire_date?: string
  contract_type: string; job_title?: string; department?: string
  basic_salary: number; housing_allow: number; transport_allow: number; other_allow: number
  gosi_enrolled: boolean; gosi_pct: number
  iqama_number?: string; iqama_expiry?: string
  bank_name?: string; iban?: string; notes?: string
  is_active: boolean; direct_manager?: number
  employee?: { name: string; role: string }
}

const LETTER_TYPES = [
  { id: 'work',   label: 'خطاب عمل',      icon: '📋', desc: 'إثبات عمل الموظف في الشركة' },
  { id: 'salary', label: 'خطاب راتب',     icon: '💰', desc: 'تفاصيل الراتب والبدلات' },
  { id: 'exp',    label: 'شهادة خبرة',    icon: '🏅', desc: 'إثبات مدة الخدمة عند الانتهاء' },
  { id: 'custom', label: 'خطاب مخصص',     icon: '✏️', desc: 'محتوى حر بقالب الشركة' },
]

// ══════════════════════════════════════
// مودال إصدار الخطاب
// ══════════════════════════════════════
function LetterModal({ emp, tenant, onClose }: {
  emp: HREmployee; tenant: any; onClose: () => void
}) {
  const [type, setType] = useState('work')
  const [customTitle, setCustomTitle] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [addressedTo, setAddressedTo] = useState('من يهمه الأمر')
  const [generating, setGenerating] = useState(false)

  const empName = [emp.first_name, emp.father_name, emp.grandfather_name, emp.family_name].filter(Boolean).join(' ') || emp.first_name_en || '—'
  const totalSalary = emp.basic_salary + emp.housing_allow + emp.transport_allow + emp.other_allow
  const today = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })
  const refNo = `${tenant?.name?.slice(0,3) || 'HR'}-${Date.now().toString().slice(-6)}`

  // حساب مدة الخدمة
  function serviceYears() {
    if (!emp.hire_date) return '—'
    const hire = new Date(emp.hire_date)
    const now = new Date()
    const years = now.getFullYear() - hire.getFullYear()
    const months = now.getMonth() - hire.getMonth()
    if (months < 0) return `${years - 1} سنة و${12 + months} شهر`
    return months > 0 ? `${years} سنة و${months} شهر` : `${years} سنة`
  }

  function buildLetterBody(): string {
    if (type === 'work') return `
      <p style="line-height:2.2">
        نفيد بأن السيد / السيدة <strong>${empName}</strong>
        يعمل/تعمل لدى شركتنا بمسمى وظيفي <strong>${emp.job_title || '—'}</strong>
        في قسم <strong>${emp.department || '—'}</strong>،
        وذلك بتاريخ ${emp.hire_date ? formatDate(emp.hire_date) : '—'} حتى تاريخه.
      </p>
      <p style="line-height:2.2;margin-top:12px">
        وقد أُصدرت هذه الشهادة بناءً على طلبه/طلبها لتقديمها إلى ${addressedTo}،
        ولا تُعدّ تزكيةً بأي شكل من الأشكال.
      </p>`

    if (type === 'salary') return `
      <p style="line-height:2.2">
        نفيد بأن السيد / السيدة <strong>${empName}</strong>
        يعمل/تعمل لدى شركتنا بمسمى <strong>${emp.job_title || '—'}</strong>،
        ويتقاضى/تتقاضى الراتب الشهري التالي:
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb">البند</th>
            <th style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb">المبلغ (ريال)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:8px 12px;border:1px solid #e5e7eb">الراتب الأساسي</td><td style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb;font-weight:bold">${emp.basic_salary.toLocaleString()}</td></tr>
          ${emp.housing_allow > 0 ? `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">بدل السكن</td><td style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb">${emp.housing_allow.toLocaleString()}</td></tr>` : ''}
          ${emp.transport_allow > 0 ? `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">بدل النقل</td><td style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb">${emp.transport_allow.toLocaleString()}</td></tr>` : ''}
          ${emp.other_allow > 0 ? `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">بدلات أخرى</td><td style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb">${emp.other_allow.toLocaleString()}</td></tr>` : ''}
          <tr style="background:#f0fdf4"><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold">الإجمالي</td><td style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;color:#0ea77b">${totalSalary.toLocaleString()}</td></tr>
        </tbody>
      </table>
      <p style="line-height:2">وقد أُصدرت هذه الشهادة بناءً على طلبه/طلبها لتقديمها إلى ${addressedTo}.</p>`

    if (type === 'exp') return `
      <p style="line-height:2.2">
        نشهد بأن السيد / السيدة <strong>${empName}</strong>
        قد عمل/عملت في شركتنا بمسمى وظيفي <strong>${emp.job_title || '—'}</strong>
        في قسم <strong>${emp.department || '—'}</strong>،
        وذلك من تاريخ <strong>${emp.hire_date ? formatDate(emp.hire_date) : '—'}</strong>
        لمدة <strong>${serviceYears()}</strong>.
      </p>
      <p style="line-height:2.2;margin-top:12px">
        وقد كان/كانت يؤدي/تؤدي عمله/عملها بأمانة واجتهاد، ونتمنى له/لها التوفيق والنجاح.
      </p>
      <p style="line-height:2.2;margin-top:12px">
        وقد أُصدرت هذه الشهادة بناءً على طلبه/طلبها لتقديمها إلى ${addressedTo}.
      </p>`

    if (type === 'custom') return `
      <p style="line-height:2.2">${customBody.replace(/\n/g, '<br/>')}</p>`

    return ''
  }

  function printLetter() {
    const title = type === 'work' ? 'خطاب عمل' :
                  type === 'salary' ? 'خطاب راتب' :
                  type === 'exp' ? 'شهادة خبرة' : customTitle || 'خطاب رسمي'

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0;padding:0;box-sizing:border-box }
  body { font-family:'Arial',sans-serif;font-size:14px;color:#111;background:white;padding:40px;direction:rtl }
  .header { display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1a56db;padding-bottom:16px;margin-bottom:28px }
  .logo { max-height:90px;max-width:220px;object-fit:contain;image-rendering:high-quality }
  .company-info { text-align:left;font-size:12px;color:#555;line-height:1.8 }
  .meta { display:flex;justify-content:space-between;margin-bottom:20px;font-size:12px;color:#555 }
  .title { text-align:center;font-size:18px;font-weight:bold;margin:24px 0;text-decoration:underline;color:#111 }
  .salutation { margin-bottom:16px;font-size:14px }
  .body { line-height:2 }
  .signatures { display:flex;justify-content:space-between;margin-top:70px }
  .sig-box { text-align:center;width:180px }
  .sig-line { border-top:1px solid #333;margin-top:50px;padding-top:6px;font-size:12px }
  .footer { margin-top:40px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#888;text-align:center }
  @media print { body { padding:20px } }
</style>
</head>
<body>
<div class="header">
  ${tenant?.logo_url ? `<img src="${tenant.logo_url}" class="logo" alt="شعار" />` : `<div style="font-size:20px;font-weight:bold;color:#1a56db">${tenant?.name || ''}</div>`}
  <div class="company-info">
    <div style="font-weight:bold;font-size:14px">${tenant?.name || ''}</div>
    ${tenant?.cr_number ? `<div>س.ت: ${tenant.cr_number}</div>` : ''}
    ${tenant?.vat_number ? `<div>الرقم الضريبي: ${tenant.vat_number}</div>` : ''}
    ${tenant?.phone ? `<div>هاتف: ${tenant.phone}</div>` : ''}
    ${tenant?.address ? `<div>${tenant.address}</div>` : ''}
  </div>
</div>

<div class="meta">
  <div>رقم المرجع: <strong>${refNo}</strong></div>
  <div>التاريخ: <strong>${today}</strong></div>
</div>

<div class="title">${title}</div>

<div class="salutation">السادة / ${addressedTo} — المحترمون</div>
<div class="salutation">تحية طيبة وبعد،</div>

<div class="body">${buildLetterBody()}</div>

<div class="signatures">
  <div class="sig-box"><div class="sig-line">مدير الموارد البشرية</div></div>
  <div class="sig-box"><div class="sig-line">${tenant?.ceo_name ? `م. ${tenant.ceo_name}` : 'المدير العام'}</div></div>
</div>

${tenant?.footer_text ? `<div class="footer">${tenant.footer_text}</div>` : ''}
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 600)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">إصدار خطاب رسمي — {empName}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* اختيار نوع الخطاب */}
          <div className="grid grid-cols-2 gap-3">
            {LETTER_TYPES.map(lt => (
              <button key={lt.id} type="button" onClick={() => setType(lt.id)}
                style={{
                  padding: '12px', borderRadius: '10px', border: '2px solid', cursor: 'pointer',
                  textAlign: 'right', transition: 'all 0.15s',
                  borderColor: type === lt.id ? '#1a56db' : 'var(--border)',
                  background: type === lt.id ? '#eff6ff' : 'white',
                }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{lt.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: type === lt.id ? '#1a56db' : 'var(--text)' }}>{lt.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{lt.desc}</div>
              </button>
            ))}
          </div>

          {/* موجّه إلى */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">موجّه إلى</label>
            <input value={addressedTo} onChange={e => setAddressedTo(e.target.value)}
              className="input" placeholder="من يهمه الأمر / السفارة / البنك..." />
          </div>

          {/* حقول الخطاب المخصص */}
          {type === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">عنوان الخطاب <span className="text-red-500">*</span></label>
                <input value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                  className="input" placeholder="مثال: خطاب تفويض، خطاب تعريف..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">محتوى الخطاب <span className="text-red-500">*</span></label>
                <textarea value={customBody} onChange={e => setCustomBody(e.target.value)}
                  className="input" style={{ minHeight: '120px', resize: 'none' }}
                  placeholder="اكتب محتوى الخطاب هنا..." />
              </div>
            </>
          )}

          {/* معاينة سريعة */}
          <div style={{ background: 'var(--bg2)', borderRadius: '10px', padding: '12px', fontSize: '0.78rem', color: 'var(--text3)' }}>
            <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>معاينة سريعة:</div>
            {type === 'work' && <span>خطاب عمل لـ <strong>{empName}</strong> بمسمى {emp.job_title || '—'} موجّه إلى {addressedTo}</span>}
            {type === 'salary' && <span>خطاب راتب إجمالي <strong>{totalSalary.toLocaleString()} ر.س</strong> لـ {empName}</span>}
            {type === 'exp' && <span>شهادة خبرة لـ <strong>{empName}</strong> لمدة {serviceYears()}</span>}
            {type === 'custom' && <span>{customTitle || 'خطاب مخصص'} لـ {empName}</span>}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={printLetter} className="btn btn-primary"
            disabled={type === 'custom' && (!customTitle.trim() || !customBody.trim())}>
            <Printer style={{ width: '15px', height: '15px' }} /> طباعة الخطاب
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { tenant, activeBranch, currentUser } = useStore()
  const [showEditModal, setShowEditModal] = useState(false)
  const [emp, setEmp] = useState<HREmployee | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('personal')
  const [showLetter, setShowLetter] = useState(false)
  const [tenantData, setTenantData] = useState<any>(null)

  // بيانات التابات
  const [leaves, setLeaves] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [disciplinary, setDisciplinary] = useState<any[]>([])
  const [payrolls, setPayrolls] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([])

  // modal الطوارئ
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [editEmergency, setEditEmergency] = useState<any | null>(null)
  const [emergencyForm, setEmergencyForm] = useState({
    full_name: '', relationship: 'أب', phone_primary: '',
    phone_secondary: '', city: '', priority: 1,
  })
  const [emergencySaving, setEmergencySaving] = useState(false)
  const [emergencyDeleteId, setEmergencyDeleteId] = useState<string | null>(null)
  const [emergencyError, setEmergencyError] = useState('')

  const RELATIONSHIPS = ['أب','أم','زوجة','زوج','أخ','أخت','ابن','ابنة','صديق','أخرى']
  const PRIORITY_LABEL: Record<number,string> = { 1:'الأول', 2:'الثاني', 3:'الثالث' }
  const PRIORITY_COLOR: Record<number,string> = { 1:'#dc2626', 2:'#d97706', 3:'#2563eb' }

  const isAdmin = currentUser?.role === 'مدير عام'
  const now = new Date()

  useEffect(() => { 
    if (tenant && activeBranch && id) loadAll() 
  }, [tenant?.id, activeBranch?.id, id])

  async function loadAll() {
    if (!tenant || !activeBranch) return
    setLoading(true)

    // جلب بيانات الشركة للخطابات
    const { data: td } = await supabase.from('tenants').select('*').eq('id', tenant.id).single()
    setTenantData(td)

    // جلب بيانات الموظف — مباشرة من hr_employees
    const { data: empData, error: empErr } = await supabase
      .from('hr_employees')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', Number(id))
      .single()

    if (!empData || empErr) {
      console.error('لم يُعثر على الموظف:', empErr)
      router.push('/hr')
      return
    }
    setEmp(empData)

    const hrEmpId = empData.id  // ← hr_employees.id هو المرجع الآن

    // جلب كل البيانات معاً
    const [leavesRes, attRes, discRes, payRes, docRes] = await Promise.all([
      supabase.from('hr_leaves')
        .select('*').eq('tenant_id', tenant.id).eq('employee_id', hrEmpId)
        .order('start_date', { ascending: false }).limit(20),
      supabase.from('hr_attendance')
        .select('*').eq('tenant_id', tenant.id).eq('employee_id', hrEmpId)
        .order('date', { ascending: false }).limit(30),
      supabase.from('hr_disciplinary')
        .select('*').eq('tenant_id', tenant.id).eq('employee_id', hrEmpId)
        .order('created_at', { ascending: false }),
      supabase.from('hr_payroll')
        .select('*').eq('tenant_id', tenant.id).eq('employee_id', hrEmpId)
        .order('year', { ascending: false }).order('month', { ascending: false }).limit(6),
      supabase.from('hr_documents')
        .select('*').eq('tenant_id', tenant.id).eq('employee_id', hrEmpId)
        .order('expiry_date'),
    ])

    setLeaves(leavesRes.data || [])
    setAttendance(attRes.data || [])
    setDisciplinary(discRes.data || [])
    setPayrolls(payRes.data || [])
    setDocuments(docRes.data || [])

    // جلب بيانات الطوارئ
    const { data: emergencyData } = await supabase
      .from('hr_emergency_contacts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('employee_id', hrEmpId)
      .order('priority', { ascending: true })
    setEmergencyContacts(emergencyData || [])

    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  if (!emp) return null

  const empName = [emp.first_name, emp.father_name, emp.grandfather_name, emp.family_name].filter(Boolean).join(' ') || emp.first_name_en || '—'
  const totalSalary = emp.basic_salary + emp.housing_allow + emp.transport_allow + emp.other_allow
  const activeWarnings = disciplinary.filter(d => d.status === 'نافذ').length
  const annualTaken = leaves.filter(l => l.leave_type === 'سنوية' && l.status === 'موافق').reduce((s, l) => s + l.days, 0)
  const iqamaDays = emp.iqama_expiry ? Math.ceil((new Date(emp.iqama_expiry).getTime() - now.getTime()) / 86400000) : null

  const TABS = [
    { id: 'personal',      label: 'البيانات الشخصية', icon: <Users style={{ width: '14px', height: '14px' }} /> },
    { id: 'leaves',        label: `الإجازات (${leaves.length})`, icon: <Calendar style={{ width: '14px', height: '14px' }} /> },
    { id: 'attendance',    label: 'الحضور',           icon: <Clock style={{ width: '14px', height: '14px' }} /> },
    { id: 'disciplinary',  label: `الإنذارات (${disciplinary.length})`, icon: <ShieldAlert style={{ width: '14px', height: '14px' }} /> },
    { id: 'payroll',       label: 'الرواتب',          icon: <Banknote style={{ width: '14px', height: '14px' }} /> },
    { id: 'documents',     label: `الوثائق (${documents.length})`, icon: <FileText style={{ width: '14px', height: '14px' }} /> },
    { id: 'letters',       label: 'الخطابات',         icon: <BookOpen style={{ width: '14px', height: '14px' }} /> },
    { id: 'emergency',     label: `جهات الطوارئ (${emergencyContacts.length})`, icon: <AlertTriangle style={{ width: '14px', height: '14px' }} /> },
  ]

  return (
    <div className="space-y-5 fade-in">

      {/* رأس الصفحة */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/hr')} className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowRight style={{ width: '15px', height: '15px' }} /> العودة
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                background: emp.nationality === 'سعودي' ? '#eff6ff' : '#fffbeb',
                color: emp.nationality === 'سعودي' ? '#1a56db' : '#e6820a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '1.1rem',
              }}>
                {empName.charAt(0)}
              </div>
              {empName}
              {emp.employee_number && (
                <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                  #{emp.employee_number}
                </span>
              )}
              {activeWarnings >= 3 && (
                <span style={{ background: '#fef2f2', color: '#c81e1e', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
                  ⚠ مؤهل للفصل
                </span>
              )}
            </h1>
            <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>{emp.job_title} — {emp.department}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowLetter(true)} className="btn btn-ghost"
            style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Printer style={{ width: '15px', height: '15px' }} /> إصدار خطاب
          </button>
          {isAdmin && (
            <button onClick={() => setShowEditModal(true)} className="btn btn-primary">
              <Pencil style={{ width: '15px', height: '15px' }} /> تعديل البيانات
            </button>
          )}
        </div>
      </div>

      {/* بطاقات سريعة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الراتب',    value: `${totalSalary.toLocaleString()} ر.س`, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'رصيد الإجازة',     value: `${Math.max(0, Math.floor((new Date().getFullYear() - (emp.hire_date ? new Date(emp.hire_date).getFullYear() : 0)) * 21) - annualTaken)} يوم`, color: '#1a56db', bg: '#eff6ff' },
          { label: 'إنذارات نافذة',    value: activeWarnings, color: activeWarnings > 0 ? '#c81e1e' : '#0ea77b', bg: activeWarnings > 0 ? '#fef2f2' : '#ecfdf5' },
          { label: iqamaDays !== null ? 'انتهاء الإقامة' : 'الجنسية', value: iqamaDays !== null ? `${iqamaDays} يوم` : emp.nationality, color: iqamaDays !== null && iqamaDays <= 60 ? '#c81e1e' : '#6b7280', bg: '#f9fafb' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* التابات */}
      <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px', borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '8px 14px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', transition: 'all 0.15s',
              background: activeTab === t.id ? 'var(--primary)' : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              borderBottom: activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── تاب البيانات الشخصية ── */}
      {activeTab === 'personal' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* البيانات الشخصية */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontWeight: 700, marginBottom: '14px', fontSize: '0.875rem', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              👤 البيانات الشخصية
            </div>
            {[
              { label: 'الاسم الكامل',         value: empName },
              { label: 'الاسم بالإنجليزي',     value: emp.first_name_en && emp.family_name_en ? `${emp.first_name_en} ${emp.family_name_en}` : '—' },
              { label: 'رقم الهوية / الإقامة', value: emp.national_id },
              { label: 'الجنسية',              value: emp.nationality },
              { label: 'تاريخ الميلاد',        value: emp.birth_date ? formatDate(emp.birth_date) : '—' },
              { label: 'الجنس',                value: emp.gender },
              { label: 'الحالة الاجتماعية',    value: emp.marital_status },
            ].map(row => (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{row.label}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{row.value || '—'}</span>
              </div>
            ))}
          </div>

          {/* البيانات الوظيفية */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontWeight: 700, marginBottom: '14px', fontSize: '0.875rem', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              💼 البيانات الوظيفية
            </div>
            {[
              { label: 'المسمى الوظيفي', value: emp.job_title },
              { label: 'القسم',          value: emp.department },
              { label: 'تاريخ التعيين',  value: emp.hire_date ? formatDate(emp.hire_date) : '—' },
              { label: 'نوع العقد',      value: emp.contract_type },
              { label: 'الحالة',         value: emp.is_active ? '✅ نشط' : '❌ غير نشط' },
            ].map(row => (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{row.label}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{row.value || '—'}</span>
              </div>
            ))}
          </div>

          {/* الراتب */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontWeight: 700, marginBottom: '14px', fontSize: '0.875rem', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              💰 الراتب والبدلات
            </div>
            {[
              { label: 'الراتب الأساسي', value: `${emp.basic_salary.toLocaleString()} ر.س` },
              { label: 'بدل السكن',      value: `${emp.housing_allow.toLocaleString()} ر.س` },
              { label: 'بدل النقل',      value: `${emp.transport_allow.toLocaleString()} ر.س` },
              { label: 'بدلات أخرى',    value: `${emp.other_allow.toLocaleString()} ر.س` },
              { label: 'الإجمالي',       value: `${totalSalary.toLocaleString()} ر.س` },
              { label: 'GOSI',           value: emp.gosi_enrolled ? `مسجل (${emp.gosi_pct}%)` : 'غير مسجل' },
            ].map(row => (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{row.label}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{row.value || '—'}</span>
              </div>
            ))}
          </div>

          {/* البنك والإقامة */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontWeight: 700, marginBottom: '14px', fontSize: '0.875rem', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              🏦 البنك والإقامة
            </div>
            {[
              { label: 'البنك',          value: emp.bank_name },
              { label: 'IBAN',           value: emp.iban },
              { label: 'رقم الإقامة',   value: emp.iqama_number },
              { label: 'انتهاء الإقامة', value: emp.iqama_expiry ? formatDate(emp.iqama_expiry) : '—' },
            ].map(row => (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{row.label}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{row.value || '—'}</span>
              </div>
            ))}
            {emp.notes && (
              <div style={{ marginTop: '10px', padding: '8px', background: 'var(--bg2)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text3)' }}>
                <strong>ملاحظات: </strong>{emp.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── تاب الإجازات ── */}
      {activeTab === 'leaves' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {leaves.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text3)' }}>لا توجد إجازات مسجلة</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['النوع','من','إلى','الأيام','الحالة','ملاحظات'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{l.leave_type}</td>
                    <td style={{ padding: '10px 14px' }}>{formatDate(l.start_date)}</td>
                    <td style={{ padding: '10px 14px' }}>{formatDate(l.end_date)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{l.days}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className={`badge ${l.status === 'موافق' ? 'badge-green' : l.status === 'مرفوض' ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: '0.72rem' }}>{l.status}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{l.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── تاب الحضور ── */}
      {activeTab === 'attendance' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {attendance.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text3)' }}>لا توجد سجلات حضور</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['التاريخ','الحالة','ساعات العمل','الإضافي','ملاحظات'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attendance.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                    <td style={{ padding: '10px 14px' }}>{formatDate(a.date)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className={`badge ${a.status === 'حضور' ? 'badge-green' : a.status === 'غياب' ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: '0.72rem' }}>{a.status}</span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>{a.hours_worked || '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: a.overtime_hours > 0 ? '#e6820a' : 'var(--text3)', fontWeight: a.overtime_hours > 0 ? 700 : 400 }}>{a.overtime_hours || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── تاب الإنذارات ── */}
      {activeTab === 'disciplinary' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {disciplinary.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text3)' }}>
              <CheckCircle2 style={{ width: '40px', height: '40px', color: '#0ea77b', margin: '0 auto 12px' }} />
              لا توجد إنذارات مسجلة
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['تاريخ الحادثة','المخالفة','الدرجة','العقوبة','خصم','الحالة'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {disciplinary.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--bg2)', background: d.status === 'نافذ' && d.penalty_degree >= 3 ? '#fff5f5' : 'transparent' }}>
                    <td style={{ padding: '10px 14px' }}>{formatDate(d.incident_date)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{d.violation_name}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className={`badge ${d.penalty_degree === 1 ? 'badge-amber' : d.penalty_degree === 2 ? 'badge-coral' : 'badge-red'}`} style={{ fontSize: '0.72rem' }}>
                        {d.penalty_degree === 1 ? 'إنذار أول' : d.penalty_degree === 2 ? 'إنذار ثاني' : 'إنذار ثالث'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{d.penalty_type}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: d.salary_deduct_days > 0 ? '#c81e1e' : 'var(--text3)', fontWeight: 600 }}>
                      {d.salary_deduct_days > 0 ? `${d.salary_deduct_days} يوم` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className={`badge ${d.status === 'نافذ' ? 'badge-red' : d.status === 'ملغي' ? 'badge-gray' : 'badge-amber'}`} style={{ fontSize: '0.72rem' }}>{d.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── تاب الرواتب ── */}
      {activeTab === 'payroll' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {payrolls.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text3)' }}>لا توجد سجلات رواتب</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الشهر','الإجمالي','الخصومات','الصافي','الحالة'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrolls.map(p => {
                  const MONTHS = ['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
                  const deductions = (p.gosi_deduction || 0) + (p.absence_deduct || 0) + (p.other_deduct || 0)
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{MONTHS[p.month]} {p.year}</td>
                      <td style={{ padding: '10px 14px' }}>{p.gross_salary?.toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px', color: '#c81e1e' }}>{deductions.toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0ea77b' }}>{p.net_salary?.toLocaleString()} ر.س</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={`badge ${p.status === 'مدفوع' ? 'badge-green' : p.status === 'معتمد' ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: '0.72rem' }}>{p.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── تاب الوثائق ── */}
      {activeTab === 'documents' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {documents.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text3)' }}>لا توجد وثائق مرفوعة</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['نوع الوثيقة','الرقم','تاريخ الإصدار','تاريخ الانتهاء','الحالة'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => {
                  const days = doc.expiry_date ? Math.ceil((new Date(doc.expiry_date).getTime() - now.getTime()) / 86400000) : null
                  const isExpired = days !== null && days <= 0
                  const isSoon = days !== null && days > 0 && days <= 30
                  return (
                    <tr key={doc.id} style={{ borderBottom: '1px solid var(--bg2)', background: isExpired ? '#fff5f5' : isSoon ? '#fffbeb' : 'transparent' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{doc.doc_type}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8rem' }}>{doc.doc_number || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{doc.issue_date ? formatDate(doc.issue_date) : '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{doc.expiry_date ? formatDate(doc.expiry_date) : '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {days !== null ? (
                          <span className={`badge ${isExpired ? 'badge-red' : isSoon ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: '0.72rem' }}>
                            {isExpired ? `منتهي ${Math.abs(days)} يوم` : isSoon ? `${days} يوم` : `✓ ${days} يوم`}
                          </span>
                        ) : <span style={{ color: 'var(--text3)', fontSize: '0.78rem' }}>بدون انتهاء</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── تاب الخطابات ── */}
      {activeTab === 'letters' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {LETTER_TYPES.map(lt => (
              <button key={lt.id} onClick={() => setShowLetter(true)}
                className="card"
                style={{ padding: '20px', textAlign: 'center', cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#1a56db'; e.currentTarget.style.background = '#f8faff' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{lt.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{lt.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>{lt.desc}</div>
              </button>
            ))}
          </div>
          <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)' }}>
            <BookOpen style={{ width: '32px', height: '32px', margin: '0 auto 8px', color: 'var(--border)' }} />
            <p style={{ fontSize: '0.82rem' }}>سجل الخطابات السابقة — قريباً</p>
          </div>
        </div>
      )}

      {/* ── تاب جهات الطوارئ ── */}
      {activeTab === 'emergency' && (
        <div>
          {/* رأس التاب */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>جهات الاتصال للطوارئ</h3>
            <button
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
              onClick={() => {
                setEditEmergency(null)
                setEmergencyForm({ full_name: '', relationship: 'أب', phone_primary: '', phone_secondary: '', city: '', priority: 1 })
                setEmergencyError('')
                setShowEmergencyModal(true)
              }}>
              <Plus style={{ width: '15px', height: '15px' }} /> إضافة جهة اتصال
            </button>
          </div>

          {/* القائمة */}
          {emergencyContacts.length === 0 ? (
            <div className="card" style={{ padding: '50px', textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📞</div>
              <p style={{ fontSize: '0.875rem' }}>لا توجد جهات اتصال للطوارئ</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {emergencyContacts.map(c => (
                <div key={c.id} className="card" style={{ padding: '16px' }}>
                  {/* الرأس */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, color: '#fff',
                      background: PRIORITY_COLOR[c.priority as 1|2|3],
                      padding: '2px 10px', borderRadius: '20px',
                    }}>
                      جهة الاتصال {PRIORITY_LABEL[c.priority as 1|2|3]}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', fontSize: '0.9rem' }}
                        onClick={() => {
                          setEditEmergency(c)
                          setEmergencyForm({
                            full_name: c.full_name, relationship: c.relationship,
                            phone_primary: c.phone_primary, phone_secondary: c.phone_secondary || '',
                            city: c.city || '', priority: c.priority,
                          })
                          setEmergencyError('')
                          setShowEmergencyModal(true)
                        }}>✏️</button>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', fontSize: '0.9rem' }}
                        onClick={() => setEmergencyDeleteId(c.id)}>🗑️</button>
                    </div>
                  </div>
                  {/* الاسم والصلة */}
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '2px' }}>{c.full_name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text3)', marginBottom: '10px' }}>{c.relationship}</div>
                  {/* التفاصيل */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text3)' }}>📱 الجوال</span>
                      <span dir="ltr" style={{ fontWeight: 600 }}>{c.phone_primary}</span>
                    </div>
                    {c.phone_secondary && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text3)' }}>📞 بديل</span>
                        <span dir="ltr" style={{ fontWeight: 600 }}>{c.phone_secondary}</span>
                      </div>
                    )}
                    {c.city && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text3)' }}>📍 المدينة</span>
                        <span style={{ fontWeight: 600 }}>{c.city}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal الخطاب */}
      {showLetter && emp && (
        <LetterModal emp={emp} tenant={tenantData} onClose={() => setShowLetter(false)} />
      )}

      {/* Modal إضافة/تعديل جهة طوارئ */}
      {showEmergencyModal && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setShowEmergencyModal(false) }}>
          <div className="modal-box" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-bold" style={{ color: 'var(--text)' }}>
                {editEmergency ? 'تعديل جهة الاتصال' : 'إضافة جهة اتصال للطوارئ'}
              </h3>
              <button onClick={() => setShowEmergencyModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {emergencyError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                  {emergencyError}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>
                    الاسم الكامل <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input className="input" value={emergencyForm.full_name}
                    onChange={e => setEmergencyForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="أدخل الاسم الكامل" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>صلة القرابة <span style={{ color: '#dc2626' }}>*</span></label>
                  <select className="input" value={emergencyForm.relationship}
                    onChange={e => setEmergencyForm(f => ({ ...f, relationship: e.target.value }))}>
                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>رقم الجوال <span style={{ color: '#dc2626' }}>*</span></label>
                  <input className="input" dir="ltr" value={emergencyForm.phone_primary}
                    onChange={e => setEmergencyForm(f => ({ ...f, phone_primary: e.target.value }))}
                    placeholder="05xxxxxxxx" type="tel" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>رقم بديل</label>
                  <input className="input" dir="ltr" value={emergencyForm.phone_secondary}
                    onChange={e => setEmergencyForm(f => ({ ...f, phone_secondary: e.target.value }))}
                    placeholder="اختياري" type="tel" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>المدينة</label>
                  <input className="input" value={emergencyForm.city}
                    onChange={e => setEmergencyForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="مثال: الرياض" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>الأولوية</label>
                  <select className="input" value={emergencyForm.priority}
                    onChange={e => setEmergencyForm(f => ({ ...f, priority: Number(e.target.value) as 1|2|3 }))}>
                    <option value={1}>الأول (الأهم)</option>
                    <option value={2}>الثاني</option>
                    <option value={3}>الثالث</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowEmergencyModal(false)} className="btn btn-ghost">إلغاء</button>
              <button
                className="btn btn-primary"
                disabled={emergencySaving}
                onClick={async () => {
                  const f = emergencyForm
                  if (!f.full_name.trim()) { setEmergencyError('الاسم مطلوب'); return }
                  if (!f.phone_primary.trim()) { setEmergencyError('رقم الجوال مطلوب'); return }
                  setEmergencySaving(true)
                  setEmergencyError('')
                  const payload = {
                    tenant_id: tenant?.id,
                    employee_id: Number(id),
                    full_name: f.full_name.trim(),
                    relationship: f.relationship,
                    phone_primary: f.phone_primary.trim(),
                    phone_secondary: f.phone_secondary.trim() || null,
                    city: f.city.trim() || null,
                    priority: f.priority,
                  }
                  let err
                  if (editEmergency) {
                    ;({ error: err } = await supabase.from('hr_emergency_contacts').update(payload).eq('id', editEmergency.id))
                  } else {
                    ;({ error: err } = await supabase.from('hr_emergency_contacts').insert(payload))
                  }
                  setEmergencySaving(false)
                  if (err) { setEmergencyError('حدث خطأ: ' + err.message); return }
                  setShowEmergencyModal(false)
                  toast.success(editEmergency ? 'تم التعديل' : 'تمت الإضافة')
                  loadAll()
                }}>
                {emergencySaving ? 'جاري الحفظ...' : editEmergency ? 'حفظ التعديلات' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تأكيد حذف جهة الطوارئ */}
      {emergencyDeleteId && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setEmergencyDeleteId(null) }}>
          <div className="modal-box" style={{ maxWidth: '360px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-bold" style={{ color: 'var(--text)' }}>تأكيد الحذف</h3>
              <button onClick={() => setEmergencyDeleteId(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text3)', fontSize: '0.875rem' }}>هل أنت متأكد من حذف جهة الاتصال هذه؟</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setEmergencyDeleteId(null)} className="btn btn-ghost">إلغاء</button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={async () => {
                  await supabase.from('hr_emergency_contacts').delete().eq('id', emergencyDeleteId)
                  setEmergencyDeleteId(null)
                  toast.success('تم الحذف')
                  loadAll()
                }}>
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال تعديل بيانات الموظف */}
      {showEditModal && emp && (
        <QuickEditModal
          emp={emp}
          tenantId={tenant?.id || ''}
          onClose={() => setShowEditModal(false)}
          onSave={() => { setShowEditModal(false); loadAll() }}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════
// مودال تعديل بيانات الموظف
// ══════════════════════════════════════
function QuickEditModal({ emp, tenantId, onClose, onSave }: {
  emp: HREmployee; tenantId: string
  onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    first_name:       emp.first_name       || '',
    father_name:      emp.father_name      || '',
    grandfather_name: emp.grandfather_name || '',
    family_name:      emp.family_name      || '',
    first_name_en:    emp.first_name_en    || '',
    family_name_en:   emp.family_name_en   || '',
    national_id:      emp.national_id      || '',
    nationality:      emp.nationality      || '',
    birth_date:       emp.birth_date       || '',
    gender:           emp.gender           || 'ذكر',
    marital_status:   emp.marital_status   || 'أعزب',
    job_title:        emp.job_title        || '',
    department:       emp.department       || '',
    hire_date:        emp.hire_date        || '',
    contract_type:    emp.contract_type    || 'دوام كامل',
    basic_salary:     String(emp.basic_salary    || 0),
    housing_allow:    String(emp.housing_allow   || 0),
    transport_allow:  String(emp.transport_allow || 0),
    bank_name:        emp.bank_name        || '',
    iban:             emp.iban             || '',
    iqama_number:     emp.iqama_number     || '',
    iqama_expiry:     emp.iqama_expiry     || '',
    phone:            emp.phone            || '',
    email:            emp.email            || '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('hr_employees').update({
      ...form,
      basic_salary:    Number(form.basic_salary)    || 0,
      housing_allow:   Number(form.housing_allow)   || 0,
      transport_allow: Number(form.transport_allow) || 0,
      birth_date:   form.birth_date   || null,
      hire_date:    form.hire_date    || null,
      iqama_expiry: form.iqama_expiry || null,
    }).eq('id', emp.id).eq('tenant_id', tenantId)
    setSaving(false)
    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('تم حفظ البيانات ✅')
    onSave()
  }

  const Section = ({ title }: { title: string }) => (
    <div style={{ gridColumn: '1/-1', fontWeight: 700, fontSize: '0.82rem', color: '#1a56db',
      borderBottom: '2px solid #eff6ff', paddingBottom: '6px', marginTop: '8px' }}>
      {title}
    </div>
  )

  const Field = ({ label, k, type = 'text', options }: { label: string; k: string; type?: string; options?: string[] }) => (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text3)' }}>{label}</label>
      {options ? (
        <select value={(form as any)[k]} onChange={e => set(k, e.target.value)} className="select" style={{ fontSize: '0.82rem' }}>
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={(form as any)[k]} onChange={e => set(k, e.target.value)}
          className="input" style={{ fontSize: '0.82rem' }} />
      )}
    </div>
  )

  return (
    <div className="modal-overlay"
      onMouseDown={(e) => { (e.currentTarget as any)._md = e.target }}
      onClick={(e) => { if (e.target === e.currentTarget && (e.currentTarget as any)._md === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#eff6ff', borderBottom: '2px solid #bfdbfe' }}>
          <h3 style={{ fontWeight: 700, color: '#1a56db' }}>✏️ تعديل بيانات — {emp.first_name} {emp.family_name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Section title="👤 الاسم" />
            <Field label="الاسم الأول" k="first_name" />
            <Field label="اسم الأب" k="father_name" />
            <Field label="اسم الجد" k="grandfather_name" />
            <Field label="اسم العائلة" k="family_name" />
            <Field label="الاسم الأول (إنجليزي)" k="first_name_en" />
            <Field label="اسم العائلة (إنجليزي)" k="family_name_en" />

            <Section title="🪪 الهوية والجنسية" />
            <Field label="رقم الهوية / الإقامة" k="national_id" />
            <Field label="الجنسية" k="nationality" options={['سعودي','وافد']} />
            <Field label="تاريخ الميلاد" k="birth_date" type="date" />
            <Field label="الجنس" k="gender" options={['ذكر','أنثى']} />
            <Field label="الحالة الاجتماعية" k="marital_status" options={['أعزب','متزوج','مطلق','أرمل']} />
            <Field label="الجوال" k="phone" />
            <Field label="البريد الإلكتروني" k="email" type="email" />

            <Section title="💼 البيانات الوظيفية" />
            <Field label="المسمى الوظيفي" k="job_title" />
            <Field label="القسم" k="department" />
            <Field label="تاريخ التعيين" k="hire_date" type="date" />
            <Field label="نوع العقد" k="contract_type" options={['دوام كامل','دوام جزئي','مؤقت','موسمي']} />

            <Section title="💰 الراتب والبدلات" />
            <Field label="الراتب الأساسي" k="basic_salary" type="number" />
            <Field label="بدل السكن" k="housing_allow" type="number" />
            <Field label="بدل النقل" k="transport_allow" type="number" />

            <Section title="🏦 البنك والإقامة" />
            <Field label="اسم البنك" k="bank_name" />
            <Field label="رقم IBAN" k="iban" />
            <Field label="رقم الإقامة" k="iqama_number" />
            <Field label="انتهاء الإقامة" k="iqama_expiry" type="date" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? 'جاري الحفظ...' : '💾 حفظ البيانات'}
          </button>
        </div>
      </div>
    </div>
  )
}
