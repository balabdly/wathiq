'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Save, Building2, MapPin, Phone, FileText, Shield, AlertCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

type CompanyForm = {
  name:        string; name_en:     string
  cr_number:   string; vat_number:  string
  phone:       string; email:       string; website: string
  city:        string; district:    string; street:  string
  postal_code: string; country:     string
  iban:        string; ceo_name:    string
}

const EMPTY: CompanyForm = {
  name: '', name_en: '', cr_number: '', vat_number: '',
  phone: '', email: '', website: '',
  city: '', district: '', street: '', postal_code: '',
  country: 'المملكة العربية السعودية',
  iban: '', ceo_name: '',
}

export default function SettingsCompanyPage() {
  const { tenant, setTenant } = useStore()
  const [form, setForm]       = useState<CompanyForm>(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'basic' | 'address' | 'financial'>('basic')

  useEffect(() => { loadData() }, [tenant?.id])

  async function loadData() {
    if (!tenant) return
    setLoading(true)
    const { data } = await supabase.from('tenants').select('*').eq('id', tenant.id).single()
    if (data) {
      setForm({
        name:        data.name        || '',
        name_en:     data.name_en     || '',
        cr_number:   data.cr_number   || '',
        vat_number:  data.vat_number  || '',
        phone:       data.phone       || '',
        email:       data.email       || '',
        website:     data.website     || '',
        city:        data.city        || '',
        district:    data.district    || '',
        street:      data.street      || '',
        postal_code: data.postal_code || '',
        country:     data.country     || 'المملكة العربية السعودية',
        iban:        data.iban        || '',
        ceo_name:    data.ceo_name    || '',
      })
    }
    setLoading(false)
  }

  const set = (k: keyof CompanyForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  // التحقق من اكتمال البيانات المطلوبة لـ ZATCA
  const zatcaFields = [form.name, form.cr_number, form.vat_number, form.city, form.district, form.street, form.postal_code]
  const zatcaComplete = zatcaFields.every(f => f.trim() !== '')
  const zatcaFilled   = zatcaFields.filter(f => f.trim() !== '').length
  const vatValid      = form.vat_number.length === 15 && /^\d+$/.test(form.vat_number)

  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم الشركة مطلوب'); return }
    if (form.vat_number && !vatValid) { toast.error('الرقم الضريبي يجب أن يكون 15 رقماً'); return }
    setSaving(true)
    const { error } = await supabase.from('tenants').update({
      name:        form.name.trim(),
      name_en:     form.name_en.trim()     || null,
      cr_number:   form.cr_number.trim()   || null,
      vat_number:  form.vat_number.trim()  || null,
      phone:       form.phone.trim()       || null,
      email:       form.email.trim()       || null,
      website:     form.website.trim()     || null,
      city:        form.city.trim()        || null,
      district:    form.district.trim()    || null,
      street:      form.street.trim()      || null,
      postal_code: form.postal_code.trim() || null,
      country:     form.country.trim()     || 'المملكة العربية السعودية',
      iban:        form.iban.trim()        || null,
      ceo_name:    form.ceo_name.trim()    || null,
    }).eq('id', tenant!.id)

    if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }

    // تحديث اسم الشركة في الـ store
    if (setTenant) setTenant({ ...tenant!, name: form.name })
    toast.success('✅ تم حفظ بيانات الشركة')
    setSaving(false)
  }

  const TABS = [
    { id: 'basic',     label: '🏢 البيانات الأساسية' },
    { id: 'address',   label: '📍 العنوان' },
    { id: 'financial', label: '💰 البيانات المالية' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 fade-in" style={{ maxWidth: '700px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
          بيانات الشركة
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>
          معلومات الشركة الرسمية — تُستخدم في الفواتير وتقارير ZATCA
        </p>
      </div>

      {/* مؤشر اكتمال ZATCA */}
      <div style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid ' + (zatcaComplete ? '#bbf7d0' : '#fde68a'), background: zatcaComplete ? '#f0fdf4' : '#fffbeb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.875rem', color: zatcaComplete ? '#065f46' : '#92400e' }}>
            {zatcaComplete
              ? <CheckCircle style={{ width: '16px', height: '16px' }} />
              : <AlertCircle style={{ width: '16px', height: '16px' }} />}
            {zatcaComplete ? 'البيانات مكتملة لـ ZATCA ✅' : 'بيانات ZATCA غير مكتملة'}
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: zatcaComplete ? '#065f46' : '#92400e' }}>
            {zatcaFilled} / {zatcaFields.length} حقل
          </span>
        </div>
        {/* شريط التقدم */}
        <div style={{ height: '6px', background: zatcaComplete ? '#bbf7d0' : '#fde68a', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: (zatcaFilled / zatcaFields.length * 100) + '%', background: zatcaComplete ? '#0ea77b' : '#e6820a', borderRadius: '3px', transition: 'width 0.3s' }} />
        </div>
        {!zatcaComplete && (
          <p style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '6px' }}>
            أكمل الحقول: اسم الشركة، السجل التجاري، الرقم الضريبي، المدينة، الحي، الشارع، الرمز البريدي
          </p>
        )}
      </div>

      {/* تابات */}
      <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s',
              background: tab === t.id ? 'var(--primary)' : 'transparent',
              color: tab === t.id ? 'white' : '#6b7280' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* البيانات الأساسية */}
      {tab === 'basic' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  اسم الشركة (عربي) <span className="text-red-500">*</span>
                </label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: شركة النور للمقاولات الكهربائية" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الشركة (إنجليزي)</label>
                <input value={form.name_en} onChange={e => set('name_en', e.target.value)} className="input" dir="ltr" placeholder="Al Noor Electrical Contracting" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  رقم السجل التجاري (CR)
                </label>
                <input value={form.cr_number} onChange={e => set('cr_number', e.target.value)} className="input" dir="ltr" placeholder="1010XXXXXX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  الرقم الضريبي (VAT) — 15 رقم
                  {form.vat_number && (
                    <span style={{ marginRight: '6px', fontSize: '0.72rem', color: vatValid ? '#0ea77b' : '#c81e1e' }}>
                      {vatValid ? '✓ صحيح' : '✗ يجب 15 رقم'}
                    </span>
                  )}
                </label>
                <input value={form.vat_number} onChange={e => set('vat_number', e.target.value.replace(/\D/g, '').slice(0, 15))} className="input" dir="ltr" placeholder="300XXXXXXXXXXX3" maxLength={15}
                  style={{ borderColor: form.vat_number && !vatValid ? '#fca5a5' : undefined }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الجوال / الهاتف</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" dir="ltr" placeholder="0512345678" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" dir="ltr" placeholder="info@company.com" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المدير التنفيذي</label>
                <input value={form.ceo_name} onChange={e => set('ceo_name', e.target.value)} className="input" placeholder="اسم المدير / صاحب الشركة" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع الإلكتروني</label>
                <input value={form.website} onChange={e => set('website', e.target.value)} className="input" dir="ltr" placeholder="www.company.com" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* العنوان */}
      {tab === 'address' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '16px', color: '#374151' }}>
            <MapPin style={{ width: '18px', height: '18px', color: '#1a56db' }} />
            العنوان الوطني — مطلوب لـ ZATCA
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">المدينة <span className="text-red-500">*</span></label>
                <input value={form.city} onChange={e => set('city', e.target.value)} className="input" placeholder="الرياض" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الحي <span className="text-red-500">*</span></label>
                <input value={form.district} onChange={e => set('district', e.target.value)} className="input" placeholder="حي العليا" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الشارع <span className="text-red-500">*</span></label>
              <input value={form.street} onChange={e => set('street', e.target.value)} className="input" placeholder="شارع الملك فهد" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الرمز البريدي <span className="text-red-500">*</span></label>
                <input value={form.postal_code} onChange={e => set('postal_code', e.target.value.replace(/\D/g, '').slice(0, 5))} className="input" dir="ltr" placeholder="12345" maxLength={5} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الدولة</label>
                <input value={form.country} onChange={e => set('country', e.target.value)} className="input" />
              </div>
            </div>

            {/* معاينة العنوان */}
            {(form.city || form.district || form.street) && (
              <div style={{ padding: '12px 16px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 600, marginBottom: '4px' }}>📍 معاينة العنوان</div>
                <div style={{ fontSize: '0.875rem', color: '#1e40af', lineHeight: 1.6 }}>
                  {[form.street, form.district, form.city, form.postal_code, form.country].filter(Boolean).join('، ')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* البيانات المالية */}
      {tab === 'financial' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '16px', color: '#374151' }}>
            <Shield style={{ width: '18px', height: '18px', color: '#0ea77b' }} />
            البيانات البنكية والمالية
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم IBAN</label>
              <input value={form.iban} onChange={e => set('iban', e.target.value.toUpperCase())} className="input" dir="ltr" placeholder="SA00 0000 0000 0000 0000 0000" />
              <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>يُطبع على الفواتير لتسهيل عملية الدفع</p>
            </div>

            {/* بطاقة ملخص ZATCA */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontWeight: 700, color: '#065f46', marginBottom: '12px', fontSize: '0.875rem' }}>
                🧾 ملخص بيانات ZATCA
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                {[
                  { label: 'اسم الشركة',     value: form.name,        required: true },
                  { label: 'السجل التجاري',  value: form.cr_number,   required: false },
                  { label: 'الرقم الضريبي',  value: form.vat_number,  required: true },
                  { label: 'المدينة',         value: form.city,        required: true },
                  { label: 'الحي',            value: form.district,    required: true },
                  { label: 'الشارع',          value: form.street,      required: true },
                  { label: 'الرمز البريدي',  value: form.postal_code, required: true },
                ].map(f => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'white', borderRadius: '8px' }}>
                    <span style={{ color: '#374151' }}>{f.label} {f.required && <span style={{ color: '#c81e1e' }}>*</span>}</span>
                    {f.value
                      ? <span style={{ color: '#0ea77b', fontWeight: 600 }}>✓ {f.value}</span>
                      : <span style={{ color: '#c81e1e', fontSize: '0.75rem' }}>غير مُدخل</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* زر الحفظ */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '20px' }}>
        <button onClick={handleSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 28px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.95rem', background: 'var(--primary)', color: 'white', opacity: saving ? 0.7 : 1 }}>
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '16px', height: '16px' }} />}
          حفظ البيانات
        </button>
      </div>
    </div>
  )
}
