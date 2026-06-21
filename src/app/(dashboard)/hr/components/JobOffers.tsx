'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Plus, FileText, Eye, Trash2, Printer, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import type { HREmployee } from '../hr_types'

export default function JobOffersTab({ tenant, hrEmployees }: { tenant: any; hrEmployees: HREmployee[] }) {
  const [mode, setMode] = useState<'list' | 'create'>('list')
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [ceoName, setCeoName] = useState('')

  // نموذج عرض العمل
  const [form, setForm] = useState({
    // المرشح
    candidate_name: '',
    candidate_from_system: false,
    hr_employee_id: '',
    // الوظيفة
    job_title: '',
    department: '',
    division: '',
    contract_type: 'دوام كامل',
    // الراتب
    basic_salary: '',
    housing_allow: '',
    transport_allow: '',
    other_allow: '',
    // التواريخ
    start_date: '',
    offer_date: new Date().toISOString().split('T')[0],
    offer_expiry: '',
    // ملاحظات
    notes: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const totalSalary = Number(form.basic_salary) + Number(form.housing_allow) + Number(form.transport_allow) + Number(form.other_allow)

  useEffect(() => { loadData() }, [tenant?.id])

  async function loadData() {
    if (!tenant) return
    setLoading(true)
    const [offersRes, tenantRes] = await Promise.all([
      supabase.from('hr_job_offers').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('tenants').select('ceo_id').eq('id', tenant.id).single(),
    ])
    setOffers(offersRes.data || [])
    // جلب اسم CEO
    if (tenantRes.data?.ceo_id) {
      const { data: ceo } = await supabase.from('employees').select('name').eq('id', tenantRes.data.ceo_id).single()
      if (ceo) setCeoName(ceo.name)
    }
    setLoading(false)
  }

  // عند اختيار موظف من النظام — تعبئة تلقائية
  function fillFromEmployee(hrEmpId: string) {
    const emp = hrEmployees.find(e => e.id === Number(hrEmpId))
    if (!emp) return
    setForm(f => ({
      ...f,
      hr_employee_id: hrEmpId,
      candidate_name: emp.name || '',
      job_title: emp.job_title || '',
      department: emp.department || '',
      contract_type: emp.contract_type || 'دوام كامل',
      basic_salary: String(emp.basic_salary || ''),
      housing_allow: String(emp.housing_allow || ''),
      transport_allow: String(emp.transport_allow || ''),
      other_allow: String(emp.other_allow || ''),
      start_date: emp.hire_date || '',
    }))
  }

  // حفظ العرض
  async function saveOffer() {
    if (!form.candidate_name.trim()) { toast.error('اسم المرشح مطلوب'); return }
    if (!form.job_title.trim()) { toast.error('المسمى الوظيفي مطلوب'); return }
    if (!form.basic_salary) { toast.error('الراتب الأساسي مطلوب'); return }
    if (!form.start_date) { toast.error('تاريخ المباشرة مطلوب'); return }

    const { error } = await supabase.from('hr_job_offers').insert({
      tenant_id: tenant.id,
      candidate_name: form.candidate_name,
      hr_employee_id: form.hr_employee_id ? Number(form.hr_employee_id) : null,
      job_title: form.job_title,
      department: form.department,
      division: form.division,
      contract_type: form.contract_type,
      basic_salary: Number(form.basic_salary),
      housing_allow: Number(form.housing_allow) || 0,
      transport_allow: Number(form.transport_allow) || 0,
      other_allow: Number(form.other_allow) || 0,
      total_salary: totalSalary,
      start_date: form.start_date,
      offer_date: form.offer_date,
      offer_expiry: form.offer_expiry || null,
      notes: form.notes || null,
      status: 'مسودة',
    })

    if (error) { toast.error('خطأ: ' + error.message); return }
    toast.success('✅ تم حفظ عرض العمل')
    await loadData()
    setMode('list')
  }

  // توليد PDF
  function generatePDF(offer: any) {
    const offerData = offer || {
      ...form,
      basic_salary: Number(form.basic_salary),
      housing_allow: Number(form.housing_allow) || 0,
      transport_allow: Number(form.transport_allow) || 0,
      other_allow: Number(form.other_allow) || 0,
      total_salary: totalSalary,
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return

    printWindow.document.write(`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>عرض عمل - ${offerData.candidate_name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1a1a2e; background: white; direction: rtl; }
  .page { max-width: 794px; margin: 0 auto; padding: 40px 50px; min-height: 1123px; position: relative; }

  /* الهيدر */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #1a56db; }
  .company-name { font-size: 22px; font-weight: 800; color: #1a56db; }
  .company-sub { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .offer-badge { background: #1a56db; color: white; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 700; }

  /* العنوان */
  .title-section { text-align: center; margin: 30px 0; }
  .title-section h1 { font-size: 26px; font-weight: 800; color: #1a56db; margin-bottom: 6px; }
  .title-section p { font-size: 13px; color: #6b7280; }

  /* بيانات المرشح */
  .candidate-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; }
  .candidate-name { font-size: 20px; font-weight: 800; color: #1a1a2e; margin-bottom: 4px; }
  .candidate-sub { font-size: 13px; color: #3b82f6; font-weight: 600; }

  /* الجدول */
  .section-title { font-size: 15px; font-weight: 700; color: #1a56db; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #dbeafe; display: flex; align-items: center; gap: 6px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .info-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
  .info-label { font-size: 11px; color: #6b7280; margin-bottom: 4px; font-weight: 600; }
  .info-value { font-size: 14px; font-weight: 700; color: #1a1a2e; }

  /* الراتب */
  .salary-box { background: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; }
  .salary-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #d1fae5; font-size: 14px; }
  .salary-row:last-child { border-bottom: none; }
  .salary-total { background: #0ea77b; color: white; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; margin-top: 12px; font-weight: 700; font-size: 16px; }

  /* الملاحظات */
  .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; font-size: 13px; color: #92400e; line-height: 1.7; }

  /* التوقيعات */
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  .sig-box { text-align: center; }
  .sig-line { border-bottom: 2px solid #1a56db; margin: 40px 20px 8px; }
  .sig-label { font-size: 12px; color: #6b7280; }
  .sig-name { font-size: 14px; font-weight: 700; margin-top: 4px; }

  /* الفوتر */
  .footer { position: absolute; bottom: 30px; left: 50px; right: 50px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 12px; }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- هيدر -->
  <div class="header">
    <div>
      <div class="company-name">${tenant?.name || 'الشركة'}</div>
      <div class="company-sub">مقاول كهرباء معتمد</div>
    </div>
    <div class="offer-badge">عرض عمل رسمي</div>
  </div>

  <!-- العنوان -->
  <div class="title-section">
    <h1>خطاب عرض العمل</h1>
    <p>تاريخ العرض: ${offerData.offer_date || new Date().toLocaleDateString('ar-SA')}
    ${offerData.offer_expiry ? ` · صالح حتى: ${offerData.offer_expiry}` : ''}</p>
  </div>

  <!-- المرشح -->
  <div class="candidate-box">
    <div class="candidate-name">السيد / السيدة: ${offerData.candidate_name}</div>
    <div class="candidate-sub">${offerData.job_title}</div>
  </div>

  <p style="font-size:14px; line-height:1.8; margin-bottom:20px; color:#374151;">
    يسعدنا إبلاغكم بقبول انضمامكم لفريق عمل شركة <strong>${tenant?.name || 'الشركة'}</strong>،
    ونتشرف بتقديم عرض العمل التالي:
  </p>

  <!-- بيانات الوظيفة -->
  <div class="section-title">📋 تفاصيل الوظيفة</div>
  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">المسمى الوظيفي</div>
      <div class="info-value">${offerData.job_title}</div>
    </div>
    ${offerData.department ? `<div class="info-item"><div class="info-label">القسم</div><div class="info-value">${offerData.department}</div></div>` : ''}
    ${offerData.division ? `<div class="info-item"><div class="info-label">الإدارة</div><div class="info-value">${offerData.division}</div></div>` : ''}
    <div class="info-item">
      <div class="info-label">نوع العقد</div>
      <div class="info-value">${offerData.contract_type}</div>
    </div>
    <div class="info-item">
      <div class="info-label">تاريخ المباشرة</div>
      <div class="info-value">${offerData.start_date || '—'}</div>
    </div>
  </div>

  <!-- الراتب -->
  <div class="section-title">💰 الراتب والمزايا (شهرياً)</div>
  <div class="salary-box">
    <div class="salary-row"><span>الراتب الأساسي</span><span style="font-weight:700">${Number(offerData.basic_salary).toLocaleString('ar-SA')} ريال</span></div>
    ${offerData.housing_allow > 0 ? `<div class="salary-row"><span>بدل السكن</span><span style="font-weight:700">${Number(offerData.housing_allow).toLocaleString('ar-SA')} ريال</span></div>` : ''}
    ${offerData.transport_allow > 0 ? `<div class="salary-row"><span>بدل النقل</span><span style="font-weight:700">${Number(offerData.transport_allow).toLocaleString('ar-SA')} ريال</span></div>` : ''}
    ${offerData.other_allow > 0 ? `<div class="salary-row"><span>بدلات أخرى</span><span style="font-weight:700">${Number(offerData.other_allow).toLocaleString('ar-SA')} ريال</span></div>` : ''}
    <div class="salary-total">
      <span>إجمالي الراتب الشهري</span>
      <span>${Number(offerData.total_salary || offerData.basic_salary).toLocaleString('ar-SA')} ريال</span>
    </div>
  </div>

  ${offerData.notes ? `
  <!-- ملاحظات -->
  <div class="section-title">📝 ملاحظات وشروط إضافية</div>
  <div class="notes-box">${offerData.notes}</div>
  ` : ''}

  <!-- التوقيعات -->
  <div class="signatures">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">توقيع صاحب العمل</div>
      <div class="sig-name">${ceoName || tenant?.name || ''}</div>
      <div style="font-size:11px; color:#9ca3af; margin-top:2px;">المدير التنفيذي</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">توقيع المرشح — قبول العرض</div>
      <div class="sig-name">${offerData.candidate_name}</div>
      <div style="font-size:11px; color:#9ca3af; margin-top:2px;">التاريخ: _______________</div>
    </div>
  </div>

  <!-- الفوتر -->
  <div class="footer">
    ${tenant?.name || 'الشركة'} · هذا العرض سري ومخصص للمرشح المذكور فقط
  </div>

</div>

<div class="no-print" style="text-align:center; padding:20px; background:#f9fafb;">
  <button onclick="window.print()" style="padding:10px 30px; background:#1a56db; color:white; border:none; border-radius:8px; cursor:pointer; font-size:15px; font-weight:600; margin-left:10px;">
    🖨️ طباعة / حفظ PDF
  </button>
  <button onclick="window.close()" style="padding:10px 20px; background:#6b7280; color:white; border:none; border-radius:8px; cursor:pointer; font-size:15px;">
    إغلاق
  </button>
</div>

</body>
</html>`)
    printWindow.document.close()
  }

  return (
    <div className="space-y-4">

      {/* شريط الإجراءات */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--text3)' }}>
          {offers.length} عرض عمل محفوظ
        </div>
        {mode === 'list' ? (
          <button onClick={() => setMode('create')} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> إنشاء عرض عمل
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => generatePDF(null)} className="btn btn-ghost" style={{ color: '#0ea77b' }}>
              <Printer style={{ width: '15px', height: '15px' }} /> معاينة PDF
            </button>
            <button onClick={() => setMode('list')} className="btn btn-ghost">
              <X style={{ width: '15px', height: '15px' }} /> إلغاء
            </button>
            <button onClick={saveOffer} className="btn btn-primary">
              <Save style={{ width: '15px', height: '15px' }} /> حفظ العرض
            </button>
          </div>
        )}
      </div>

      {/* ══ نموذج إنشاء عرض ══ */}
      {mode === 'create' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText style={{ width: '18px', height: '18px', color: '#0ea77b' }} />
            إنشاء عرض عمل جديد
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* المرشح */}
            <div style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text3)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>بيانات المرشح</div>

              {/* اختيار من النظام أو يدوي */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <button type="button" onClick={() => set('candidate_from_system', false)}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, borderColor: !form.candidate_from_system ? '#1a56db' : 'var(--border)', background: !form.candidate_from_system ? '#eff6ff' : 'white', color: !form.candidate_from_system ? '#1a56db' : 'var(--text3)' }}>
                  ✍️ إدخال يدوي
                </button>
                <button type="button" onClick={() => set('candidate_from_system', true)}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, borderColor: form.candidate_from_system ? '#1a56db' : 'var(--border)', background: form.candidate_from_system ? '#eff6ff' : 'white', color: form.candidate_from_system ? '#1a56db' : 'var(--text3)' }}>
                  👥 من الموظفين
                </button>
              </div>

              {form.candidate_from_system ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">اختر الموظف</label>
                  <select value={form.hr_employee_id} onChange={e => fillFromEmployee(e.target.value)} className="select">
                    <option value="">— اختر موظفاً —</option>
                    {hrEmployees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} — {e.job_title}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المرشح <span className="text-red-500">*</span></label>
                  <input value={form.candidate_name} onChange={e => set('candidate_name', e.target.value)} className="input" placeholder="الاسم الكامل للمرشح" />
                </div>
              )}

              {form.candidate_from_system && form.candidate_name && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: '#ecfdf5', borderRadius: '8px', fontSize: '0.82rem', color: '#065f46' }}>
                  ✅ تم تعبئة البيانات تلقائياً من ملف الموظف
                </div>
              )}
            </div>

            {/* بيانات الوظيفة */}
            <div style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text3)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>بيانات الوظيفة</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">المسمى الوظيفي <span className="text-red-500">*</span></label>
                  <input value={form.job_title} onChange={e => set('job_title', e.target.value)} className="input" placeholder="مثال: مهندس كهرباء" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">القسم</label>
                  <input value={form.department} onChange={e => set('department', e.target.value)} className="input" placeholder="مثال: قسم المشاريع" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">الإدارة</label>
                  <input value={form.division} onChange={e => set('division', e.target.value)} className="input" placeholder="مثال: إدارة الهندسة" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع العقد</label>
                  <select value={form.contract_type} onChange={e => set('contract_type', e.target.value)} className="select">
                    {['دوام كامل','دوام جزئي','مؤقت','مياومة'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ المباشرة <span className="text-red-500">*</span></label>
                  <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">صلاحية العرض حتى</label>
                  <input type="date" value={form.offer_expiry} onChange={e => set('offer_expiry', e.target.value)} className="input" />
                </div>
              </div>
            </div>

            {/* الراتب */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#065f46', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💰 الراتب والمزايا</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: 'basic_salary',    l: 'الراتب الأساسي *' },
                  { k: 'housing_allow',   l: 'بدل السكن' },
                  { k: 'transport_allow', l: 'بدل النقل' },
                  { k: 'other_allow',     l: 'بدلات أخرى' },
                ].map(({ k, l }) => (
                  <div key={k}>
                    <label className="block text-xs text-gray-500 mb-1">{l}</label>
                    <input type="number" min="0" value={(form as any)[k]} onChange={e => set(k, e.target.value)} className="input" placeholder="0" />
                  </div>
                ))}
              </div>
              {totalSalary > 0 && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: '#0ea77b', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', color: 'white', fontWeight: 700 }}>
                  <span>إجمالي الراتب الشهري</span>
                  <span>{totalSalary.toLocaleString()} ريال</span>
                </div>
              )}
            </div>

            {/* ملاحظات */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات وشروط إضافية</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '80px', resize: 'none' }}
                placeholder="مثال: يشمل العرض تأمين طبي — تجربة 3 أشهر..." />
            </div>
          </div>
        </div>
      )}

      {/* ══ قائمة العروض ══ */}
      {mode === 'list' && (
        loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : offers.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <FileText style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>لا توجد عروض عمل بعد</p>
            <button onClick={() => setMode('create')} className="btn btn-primary">
              <Plus style={{ width: '16px', height: '16px' }} /> إنشاء أول عرض
            </button>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['المرشح','المسمى الوظيفي','القسم','إجمالي الراتب','تاريخ المباشرة','الحالة',''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {offers.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px', fontWeight: 700 }}>{o.candidate_name}</td>
                    <td style={{ padding: '12px 14px' }}>{o.job_title}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text3)' }}>{o.department || '—'}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0ea77b' }}>{Number(o.total_salary).toLocaleString()} ر.س</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{o.start_date || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge ${o.status === 'مقبول' ? 'badge-green' : o.status === 'مرفوض' ? 'badge-red' : 'badge-gray'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button onClick={() => generatePDF(o)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '7px', border: '1px solid #0ea77b', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                          <Printer style={{ width: '13px', height: '13px' }} /> PDF
                        </button>
                        <button onClick={async () => {
                          if (!confirm('حذف هذا العرض؟')) return
                          await supabase.from('hr_job_offers').delete().eq('id', o.id)
                          await loadData(); toast.success('تم الحذف')
                        }} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                          <Trash2 style={{ width: '13px', height: '13px' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
