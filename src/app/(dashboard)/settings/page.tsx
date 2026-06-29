'use client'
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/hooks/useStore'
import type { DisplayView } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Save, Building2, MapPin, Shield, AlertCircle, CheckCircle, Image, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'

type CompanyForm = {
  name: string; name_en: string
  cr_number: string; vat_number: string
  phone: string; email: string; website: string
  city: string; district: string; street: string
  postal_code: string; country: string
  iban: string; ceo_name: string
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
  const [form, setForm]         = useState<CompanyForm>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'basic' | 'address' | 'financial' | 'logo' | 'display'>('basic')
  const [logoUrl, setLogoUrl]   = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      setLogoUrl(data.logo_url || null)
    }
    setLoading(false)
  }

  const set = (k: keyof CompanyForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const zatcaFields = [form.name, form.cr_number, form.vat_number, form.city, form.district, form.street, form.postal_code]
  const zatcaComplete = zatcaFields.every(f => f.trim() !== '')
  const zatcaFilled   = zatcaFields.filter(f => f.trim() !== '').length
  const vatValid      = form.vat_number.length === 15 && /^\d+$/.test(form.vat_number)

  // ── اختيار الشعار ──
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('يرجى اختيار صورة'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('حجم الصورة يجب أن يكون أقل من 2MB'); return }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = e => setLogoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ── رفع الشعار ──
  async function uploadLogo() {
    if (!logoFile || !tenant) return
    setUploadingLogo(true)
    try {
      const ext  = logoFile.name.split('.').pop()
      const path = `logos/${tenant.id}/logo.${ext}`
      const { error: upErr } = await supabase.storage
        .from('company-assets')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(path)
      const publicUrl = urlData.publicUrl + '?t=' + Date.now()

      const { error: dbErr } = await supabase.from('tenants')
        .update({ logo_url: publicUrl })
        .eq('id', tenant.id)
      if (dbErr) throw dbErr

      setLogoUrl(publicUrl)
      setLogoPreview(null)
      setLogoFile(null)
      if (setTenant) setTenant({ ...tenant, logo_url: publicUrl } as any)
      toast.success('✅ تم رفع الشعار بنجاح')
    } catch (err: any) {
      toast.error('خطأ في رفع الشعار: ' + err.message)
    }
    setUploadingLogo(false)
  }

  // ── حذف الشعار ──
  async function deleteLogo() {
    if (!tenant) return
    const { error } = await supabase.from('tenants').update({ logo_url: null }).eq('id', tenant.id)
    if (error) { toast.error('خطأ في حذف الشعار'); return }
    setLogoUrl(null)
    setLogoPreview(null)
    setLogoFile(null)
    if (setTenant) setTenant({ ...tenant, logo_url: null } as any)
    toast.success('تم حذف الشعار')
  }

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
    if (setTenant) setTenant({ ...tenant!, name: form.name })
    toast.success('✅ تم حفظ بيانات الشركة')
    setSaving(false)
  }

  const { displayPrefs, updateDisplayPref, currentUser } = useStore()

  async function saveDisplayPref(key: string, value: DisplayView) {
    updateDisplayPref(key as any, value)
    if (currentUser?.id) {
      const { supabase } = await import('@/lib/supabase')
      await supabase.from('employees').update({
        display_preferences: { ...displayPrefs, [key]: value }
      }).eq('id', currentUser.id)
    }
  }

  const TABS = [
    { id: 'basic',     label: '🏢 البيانات الأساسية' },
    { id: 'address',   label: '📍 العنوان' },
    { id: 'financial', label: '💰 البيانات المالية' },
    { id: 'logo',      label: '🖼️ الشعار' },
    { id: 'display',   label: '🎨 تفضيلات العرض' },
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

      {/* مؤشر ZATCA */}
      <div style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid ' + (zatcaComplete ? '#bbf7d0' : '#fde68a'), background: zatcaComplete ? '#f0fdf4' : '#fffbeb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.875rem', color: zatcaComplete ? '#065f46' : '#92400e' }}>
            {zatcaComplete ? <CheckCircle style={{ width: '16px', height: '16px' }} /> : <AlertCircle style={{ width: '16px', height: '16px' }} />}
            {zatcaComplete ? 'البيانات مكتملة لـ ZATCA ✅' : 'بيانات ZATCA غير مكتملة'}
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: zatcaComplete ? '#065f46' : '#92400e' }}>
            {zatcaFilled} / {zatcaFields.length} حقل
          </span>
        </div>
        <div style={{ height: '6px', background: zatcaComplete ? '#bbf7d0' : '#fde68a', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: (zatcaFilled / zatcaFields.length * 100) + '%', background: zatcaComplete ? '#0ea77b' : '#e6820a', borderRadius: '3px', transition: 'width 0.3s' }} />
        </div>
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

      {/* ══ البيانات الأساسية ══ */}
      {tab === 'basic' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الشركة (عربي) <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: شركة النور للمقاولات" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الشركة (إنجليزي)</label>
                <input value={form.name_en} onChange={e => set('name_en', e.target.value)} className="input" dir="ltr" placeholder="Al Noor Electrical" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم السجل التجاري</label>
                <input value={form.cr_number} onChange={e => set('cr_number', e.target.value)} className="input" dir="ltr" placeholder="1010XXXXXX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  الرقم الضريبي — 15 رقم
                  {form.vat_number && (
                    <span style={{ marginRight: '6px', fontSize: '0.72rem', color: vatValid ? '#0ea77b' : '#c81e1e' }}>
                      {vatValid ? '✓ صحيح' : '✗ يجب 15 رقم'}
                    </span>
                  )}
                </label>
                <input value={form.vat_number} onChange={e => set('vat_number', e.target.value.replace(/\D/g, '').slice(0, 15))} className="input" dir="ltr" placeholder="300XXXXXXXXXXX3" maxLength={15} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الجوال</label>
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
                <input value={form.ceo_name} onChange={e => set('ceo_name', e.target.value)} className="input" placeholder="اسم المدير" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع الإلكتروني</label>
                <input value={form.website} onChange={e => set('website', e.target.value)} className="input" dir="ltr" placeholder="www.company.com" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ العنوان ══ */}
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

      {/* ══ البيانات المالية ══ */}
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
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontWeight: 700, color: '#065f46', marginBottom: '12px', fontSize: '0.875rem' }}>🧾 ملخص بيانات ZATCA</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                {[
                  { label: 'اسم الشركة', value: form.name, required: true },
                  { label: 'السجل التجاري', value: form.cr_number, required: false },
                  { label: 'الرقم الضريبي', value: form.vat_number, required: true },
                  { label: 'المدينة', value: form.city, required: true },
                  { label: 'الحي', value: form.district, required: true },
                  { label: 'الشارع', value: form.street, required: true },
                  { label: 'الرمز البريدي', value: form.postal_code, required: true },
                ].map(f => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'white', borderRadius: '8px' }}>
                    <span style={{ color: '#374151' }}>{f.label} {f.required && <span style={{ color: '#c81e1e' }}>*</span>}</span>
                    {f.value ? <span style={{ color: '#0ea77b', fontWeight: 600 }}>✓ {f.value}</span> : <span style={{ color: '#c81e1e', fontSize: '0.75rem' }}>غير مُدخل</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ الشعار ══ */}
      {tab === 'logo' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '6px', color: '#374151' }}>
            <Image style={{ width: '18px', height: '18px', color: '#1a56db' }} />
            شعار الشركة
          </div>
          <p style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: '20px' }}>
            يظهر الشعار على الفواتير وعروض الأسعار وسندات القبض والصرف
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* الشعار الحالي */}
            {logoUrl && !logoPreview && (
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>الشعار الحالي</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
                  <div style={{ width: '120px', height: '80px', borderRadius: '8px', overflow: 'hidden', background: 'white', border: '1px solid #e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={logoUrl} alt="شعار الشركة" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '8px' }}>✅ الشعار محمّل ويظهر على المستندات</div>
                    <button onClick={deleteLogo} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}>
                      <X style={{ width: '14px', height: '14px' }} /> حذف الشعار
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* رفع شعار جديد */}
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>
                {logoUrl ? 'تغيير الشعار' : 'رفع الشعار'}
              </div>

              {/* منطقة السحب والإفلات */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #d1d5db', borderRadius: '12px', padding: '32px',
                  textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                  background: logoPreview ? '#f0f9ff' : '#fafafa',
                  borderColor: logoPreview ? '#93c5fd' : '#d1d5db',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1a56db'; (e.currentTarget as HTMLElement).style.background = '#f0f4ff' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = logoPreview ? '#93c5fd' : '#d1d5db'; (e.currentTarget as HTMLElement).style.background = logoPreview ? '#f0f9ff' : '#fafafa' }}
              >
                {logoPreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <img src={logoPreview} alt="معاينة" style={{ maxWidth: '200px', maxHeight: '120px', objectFit: 'contain', borderRadius: '8px' }} />
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>انقر لتغيير الصورة</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Upload style={{ width: '22px', height: '22px', color: '#1a56db' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>انقر لرفع الشعار</div>
                      <div style={{ color: '#9ca3af', fontSize: '0.78rem', marginTop: '4px' }}>PNG أو JPG أو SVG — بحد أقصى 2MB</div>
                    </div>
                  </div>
                )}
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
            </div>

            {/* توصيات */}
            <div style={{ padding: '14px 16px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
              <div style={{ fontWeight: 600, color: '#92400e', fontSize: '0.82rem', marginBottom: '8px' }}>💡 توصيات للشعار</div>
              <ul style={{ margin: 0, paddingRight: '16px', color: '#78350f', fontSize: '0.8rem', lineHeight: 1.8 }}>
                <li>الأبعاد المثالية: 300×100 بكسل أو أكبر</li>
                <li>خلفية شفافة (PNG) للحصول على أفضل نتيجة</li>
                <li>تأكد أن الشعار واضح على الخلفيات البيضاء</li>
                <li>حجم الملف: أقل من 2MB</li>
              </ul>
            </div>

            {/* زر الرفع */}
            {logoPreview && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={uploadLogo} disabled={uploadingLogo}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '10px', border: 'none', cursor: uploadingLogo ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem', background: '#1a56db', color: 'white', opacity: uploadingLogo ? 0.7 : 1 }}>
                  {uploadingLogo ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload style={{ width: '16px', height: '16px' }} />}
                  {uploadingLogo ? 'جارٍ الرفع...' : 'رفع الشعار'}
                </button>
                <button onClick={() => { setLogoPreview(null); setLogoFile(null) }}
                  style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e5e7eb', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem', background: 'white', color: '#374151' }}>
                  إلغاء
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* زر الحفظ — يظهر في كل التابات عدا الشعار */}
      {tab === 'display' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ padding: '16px 20px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', fontSize: '0.82rem', color: '#1e3a5f' }}>
            🎨 اختر طريقة عرض البيانات الافتراضية في كل قسم. يمكنك تغييرها في أي وقت من داخل كل صفحة.
          </div>
          {[
            { key: 'projects',  label: 'المشاريع',    options: ['kanban', 'cards', 'list'] },
            { key: 'visits',    label: 'الزيارات',    options: ['list', 'cards'] },
            { key: 'tasks',     label: 'المهام',      options: ['list', 'cards', 'kanban'] },
            { key: 'employees', label: 'الموظفون',    options: ['list', 'cards'] },
            { key: 'materials', label: 'المواد',      options: ['list', 'cards'] },
          ].map(item => (
            <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>
                  طريقة العرض الحالية: {displayPrefs[item.key as keyof typeof displayPrefs] === 'list' ? 'قائمة' : displayPrefs[item.key as keyof typeof displayPrefs] === 'cards' ? 'بطاقات' : 'كانبان'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {item.options.map(opt => (
                  <button key={opt} onClick={() => saveDisplayPref(item.key, opt as DisplayView)}
                    style={{
                      padding: '7px 14px', borderRadius: '8px', border: '1px solid',
                      cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                      fontFamily: 'inherit', transition: 'all 0.15s',
                      borderColor: displayPrefs[item.key as keyof typeof displayPrefs] === opt ? 'var(--primary)' : 'var(--border)',
                      background: displayPrefs[item.key as keyof typeof displayPrefs] === opt ? '#eff6ff' : 'white',
                      color: displayPrefs[item.key as keyof typeof displayPrefs] === opt ? 'var(--primary)' : 'var(--text3)',
                    }}>
                    {opt === 'list' ? '☰ قائمة' : opt === 'cards' ? '⊞ بطاقات' : '⊟ كانبان'}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ padding: '12px 16px', background: '#ecfdf5', borderRadius: '8px', fontSize: '0.78rem', color: '#065f46', fontWeight: 600 }}>
            ✅ التغييرات تُحفظ تلقائياً وتنطبق على كل أجهزتك
          </div>
        </div>
      )}

      {tab !== 'logo' && tab !== 'display' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '20px' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 28px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.95rem', background: 'var(--primary)', color: 'white', opacity: saving ? 0.7 : 1 }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '16px', height: '16px' }} />}
            حفظ البيانات
          </button>
        </div>
      )}
    </div>
  )
}
