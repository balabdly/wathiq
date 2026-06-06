'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Save, Printer, Eye, Check } from 'lucide-react'
import toast from 'react-hot-toast'

// ── أنواع القوالب ──
const TEMPLATES = [
  {
    id: 'classic',
    name: 'الكلاسيكي',
    desc: 'تصميم احترافي بسيط — مناسب لجميع الأعمال',
    preview: 'classic',
  },
  {
    id: 'modern',
    name: 'الحديث',
    desc: 'تصميم عصري بألوان جريئة وترويسة ملونة',
    preview: 'modern',
  },
  {
    id: 'minimal',
    name: 'المبسّط',
    desc: 'تصميم نظيف بأقل تفاصيل — مناسب للطباعة السريعة',
    preview: 'minimal',
  },
  {
    id: 'branded',
    name: 'الشركة',
    desc: 'يبرز هوية الشركة مع شعار كبير وألوان مخصصة',
    preview: 'branded',
  },
]

const DOC_TYPES = [
  { id: 'invoice',     label: 'فاتورة مبيعات' },
  { id: 'quotation',   label: 'عرض سعر' },
  { id: 'receipt',     label: 'سند قبض' },
  { id: 'payment',     label: 'سند صرف' },
  { id: 'purchase',    label: 'أمر شراء' },
  { id: 'credit_note', label: 'إشعار دائن' },
]

type PrintSettings = {
  template:        string
  primary_color:   string
  secondary_color: string
  font_size:       string
  paper_size:      string
  language:        string
  show_logo:       boolean
  show_stamp:      boolean
  show_signature:  boolean
  show_qr:         boolean
  show_bank:       boolean
  show_notes:      boolean
  header_text:     string
  footer_text:     string
  doc_types:       Record<string, string> // docType -> templateId
}

const DEFAULT: PrintSettings = {
  template:        'classic',
  primary_color:   '#1a56db',
  secondary_color: '#f0f4ff',
  font_size:       'medium',
  paper_size:      'A4',
  language:        'ar',
  show_logo:       true,
  show_stamp:      false,
  show_signature:  false,
  show_qr:         true,
  show_bank:       true,
  show_notes:      true,
  header_text:     '',
  footer_text:     'شكراً لتعاملكم معنا',
  doc_types:       {},
}

// ── معاينة القالب ──
function TemplatePreview({ template, color, logo, companyName }: {
  template: string; color: string; logo?: string | null; companyName: string
}) {
  const isModern  = template === 'modern'
  const isMinimal = template === 'minimal'
  const isBranded = template === 'branded'

  return (
    <div style={{
      width: '100%', height: '220px', background: 'white',
      border: '1px solid #e9ecef', borderRadius: '8px',
      overflow: 'hidden', fontSize: '6px', position: 'relative',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* الترويسة */}
      {isModern ? (
        <div style={{ background: color, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'white' }}>
            <div style={{ fontWeight: 700, fontSize: '8px' }}>{companyName}</div>
            <div style={{ opacity: 0.8, fontSize: '6px' }}>فاتورة ضريبية</div>
          </div>
          {logo && <img src={logo} style={{ height: '24px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} alt="" />}
        </div>
      ) : isBranded ? (
        <div style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)`, padding: '12px', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '40px' }}>
          {logo
            ? <img src={logo} style={{ height: '28px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} alt="" />
            : <div style={{ width: '28px', height: '28px', background: 'rgba(255,255,255,0.3)', borderRadius: '4px' }} />}
          <div style={{ color: 'white' }}>
            <div style={{ fontWeight: 700, fontSize: '9px' }}>{companyName}</div>
            <div style={{ fontSize: '6px', opacity: 0.85 }}>فاتورة ضريبية رقم: INV-0001</div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '10px 12px', borderBottom: isMinimal ? 'none' : `2px solid ${color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '8px', color: '#1a1a1a' }}>{companyName}</div>
            {!isMinimal && <div style={{ color: '#6b7280', fontSize: '6px' }}>فاتورة ضريبية</div>}
          </div>
          {logo && !isMinimal && <img src={logo} style={{ height: '22px', objectFit: 'contain' }} alt="" />}
        </div>
      )}

      {/* المحتوى */}
      <div style={{ padding: '8px 12px' }}>
        {/* بيانات العميل والفاتورة */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div style={{ background: '#f8f9fa', padding: '4px 6px', borderRadius: '4px' }}>
            <div style={{ color: '#6b7280', fontSize: '5px' }}>العميل</div>
            <div style={{ fontWeight: 600, fontSize: '6.5px' }}>شركة العميل</div>
            <div style={{ color: '#9ca3af', fontSize: '5px' }}>الرياض</div>
          </div>
          <div style={{ background: '#f8f9fa', padding: '4px 6px', borderRadius: '4px' }}>
            <div style={{ color: '#6b7280', fontSize: '5px' }}>رقم الفاتورة</div>
            <div style={{ fontWeight: 600, color: color, fontSize: '6.5px' }}>INV-2026-0001</div>
            <div style={{ color: '#9ca3af', fontSize: '5px' }}>04/06/2026</div>
          </div>
        </div>

        {/* الجدول */}
        <div style={{ marginBottom: '6px' }}>
          <div style={{ background: isMinimal ? '#f3f4f6' : color, padding: '3px 6px', display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr', borderRadius: isMinimal ? '4px' : '0' }}>
            {['الوصف', 'الكمية', 'السعر', 'الإجمالي'].map(h => (
              <div key={h} style={{ color: isMinimal ? '#374151' : 'white', fontSize: '5px', fontWeight: 600 }}>{h}</div>
            ))}
          </div>
          {[1, 2].map(i => (
            <div key={i} style={{ padding: '2.5px 6px', display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: '5.5px', color: '#374151' }}>خدمة كهربائية {i}</div>
              <div style={{ fontSize: '5.5px', color: '#6b7280' }}>1</div>
              <div style={{ fontSize: '5.5px', color: '#6b7280' }}>1,000</div>
              <div style={{ fontSize: '5.5px', fontWeight: 600 }}>1,000</div>
            </div>
          ))}
        </div>

        {/* الإجمالي */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: isMinimal ? '#f8f9fa' : color + '18', padding: '4px 8px', borderRadius: '4px', textAlign: 'left', minWidth: '80px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '5px', color: '#6b7280' }}>
              <span>الضريبة</span><span>150 ر.س</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '6px', fontWeight: 700, color: color }}>
              <span>الإجمالي</span><span>1,150 ر.س</span>
            </div>
          </div>
        </div>
      </div>

      {/* التذييل */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '4px 12px', background: isModern || isBranded ? color + '15' : '#f8f9fa',
        borderTop: `1px solid ${color}40`, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: '5px', color: '#9ca3af' }}>شكراً لتعاملكم معنا</div>
        <div style={{ width: '18px', height: '18px', background: '#f3f4f6', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '4px', color: '#9ca3af' }}>QR</div>
        </div>
      </div>
    </div>
  )
}

export default function PrintSettingsPage() {
  const { tenant } = useStore()
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT)
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [activeDoc, setActiveDoc] = useState('invoice')
  const [logoUrl, setLogoUrl]   = useState<string | null>(null)

  useEffect(() => { loadData() }, [tenant?.id])

  async function loadData() {
    if (!tenant) return
    setLoading(true)
    const { data } = await supabase.from('tenants').select('print_settings, logo_url').eq('id', tenant.id).single()
    if (data) {
      setLogoUrl(data.logo_url || null)
      if (data.print_settings) {
        setSettings({ ...DEFAULT, ...data.print_settings })
      }
    }
    setLoading(false)
  }

  const set = <K extends keyof PrintSettings>(k: K, v: PrintSettings[K]) =>
    setSettings(s => ({ ...s, [k]: v }))

  async function handleSave() {
    if (!tenant) return
    setSaving(true)
    const { error } = await supabase.from('tenants')
      .update({ print_settings: settings })
      .eq('id', tenant.id)
    if (error) { toast.error('خطأ: ' + error.message) }
    else { toast.success('✅ تم حفظ إعدادات الطباعة') }
    setSaving(false)
  }

  const companyName = (tenant as any)?.name || 'اسم الشركة'

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 fade-in" dir="rtl">

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Printer style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
          إعدادات الطباعة
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>
          تخصيص مظهر الفواتير وعروض الأسعار والسندات عند الطباعة
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>

        {/* ── الإعدادات ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 1. اختيار القالب */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '14px', color: '#1a1a2e' }}>
              🎨 قالب التصميم
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => set('template', t.id)}
                  style={{
                    textAlign: 'right', padding: '12px', borderRadius: '10px', cursor: 'pointer',
                    border: settings.template === t.id ? `2px solid ${settings.primary_color}` : '2px solid #e9ecef',
                    background: settings.template === t.id ? settings.primary_color + '0a' : 'white',
                    transition: 'all 0.15s', position: 'relative',
                  }}>
                  {settings.template === t.id && (
                    <div style={{ position: 'absolute', top: '8px', left: '8px', width: '18px', height: '18px', borderRadius: '50%', background: settings.primary_color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check style={{ width: '11px', height: '11px', color: 'white' }} />
                    </div>
                  )}
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '3px', color: '#1a1a2e' }}>{t.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.4 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. الألوان والخط */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '14px', color: '#1a1a2e' }}>🖌️ الألوان والخط</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>اللون الرئيسي</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="color" value={settings.primary_color} onChange={e => set('primary_color', e.target.value)}
                    style={{ width: '44px', height: '36px', borderRadius: '8px', border: '1px solid #e9ecef', cursor: 'pointer', padding: '2px' }} />
                  <input value={settings.primary_color} onChange={e => set('primary_color', e.target.value)}
                    className="input" dir="ltr" style={{ flex: 1 }} placeholder="#1a56db" />
                </div>
                {/* ألوان جاهزة */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {['#1a56db','#0ea77b','#e6820a','#c81e1e','#7c3aed','#0891b2','#1a1a2e'].map(c => (
                    <button key={c} onClick={() => set('primary_color', c)}
                      style={{ width: '22px', height: '22px', borderRadius: '50%', background: c, border: settings.primary_color === c ? '3px solid white' : '2px solid transparent', outline: settings.primary_color === c ? `2px solid ${c}` : 'none', cursor: 'pointer', transition: 'all 0.15s' }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>حجم الخط</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{id:'small',label:'صغير'},{id:'medium',label:'متوسط'},{id:'large',label:'كبير'}].map(s => (
                    <button key={s.id} onClick={() => set('font_size', s.id)}
                      style={{ flex: 1, padding: '8px', borderRadius: '8px', border: settings.font_size === s.id ? `2px solid ${settings.primary_color}` : '2px solid #e9ecef', background: settings.font_size === s.id ? settings.primary_color + '12' : 'white', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: settings.font_size === s.id ? settings.primary_color : '#6b7280' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>حجم الورق</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['A4','A5','Letter'].map(s => (
                    <button key={s} onClick={() => set('paper_size', s)}
                      style={{ flex: 1, padding: '8px', borderRadius: '8px', border: settings.paper_size === s ? `2px solid ${settings.primary_color}` : '2px solid #e9ecef', background: settings.paper_size === s ? settings.primary_color + '12' : 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: settings.paper_size === s ? settings.primary_color : '#6b7280' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>لغة المستند</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{id:'ar',label:'عربي'},{id:'en',label:'English'},{id:'both',label:'ثنائي'}].map(l => (
                    <button key={l.id} onClick={() => set('language', l.id)}
                      style={{ flex: 1, padding: '8px', borderRadius: '8px', border: settings.language === l.id ? `2px solid ${settings.primary_color}` : '2px solid #e9ecef', background: settings.language === l.id ? settings.primary_color + '12' : 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: settings.language === l.id ? settings.primary_color : '#6b7280' }}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3. عناصر المستند */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '14px', color: '#1a1a2e' }}>📋 عناصر المستند</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { key: 'show_logo',      label: 'شعار الشركة',        icon: '🖼️' },
                { key: 'show_qr',        label: 'رمز QR (ZATCA)',      icon: '📱' },
                { key: 'show_bank',      label: 'البيانات البنكية',    icon: '🏦' },
                { key: 'show_notes',     label: 'الملاحظات',           icon: '📝' },
                { key: 'show_signature', label: 'خانة التوقيع',        icon: '✍️' },
                { key: 'show_stamp',     label: 'خانة الختم',          icon: '🔏' },
              ].map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f8f9fa', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e9ecef' }}>
                  <div style={{ position: 'relative', width: '36px', height: '20px', flexShrink: 0 }}>
                    <input type="checkbox" checked={(settings as any)[item.key]} onChange={e => set(item.key as any, e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                    <div onClick={() => set(item.key as any, !(settings as any)[item.key])} style={{
                      width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                      background: (settings as any)[item.key] ? settings.primary_color : '#d1d5db',
                      position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white',
                        transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        left: (settings as any)[item.key] ? '18px' : '2px',
                      }} />
                    </div>
                  </div>
                  <span style={{ fontSize: '0.82rem', color: '#374151' }}>{item.icon} {item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 4. نص الترويسة والتذييل */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '14px', color: '#1a1a2e' }}>✏️ نصوص الترويسة والتذييل</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>نص إضافي في الترويسة</label>
                <input value={settings.header_text} onChange={e => set('header_text', e.target.value)} className="input" placeholder="مثال: نسخة أصلية — Original Copy" />
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>نص التذييل</label>
                <textarea value={settings.footer_text} onChange={e => set('footer_text', e.target.value)}
                  className="input" rows={2} placeholder="شكراً لتعاملكم معنا — جميع الأسعار شاملة ضريبة القيمة المضافة"
                  style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>

          {/* 5. قالب مخصص لكل نوع مستند */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px', color: '#1a1a2e' }}>📄 قالب مخصص لكل مستند</div>
            <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '14px' }}>اترك "افتراضي" لاستخدام القالب المختار أعلاه</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {DOC_TYPES.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#f8f9fa', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#374151' }}>{doc.label}</span>
                  <select
                    value={settings.doc_types[doc.id] || ''}
                    onChange={e => set('doc_types', { ...settings.doc_types, [doc.id]: e.target.value })}
                    style={{ padding: '5px 10px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '0.8rem', background: 'white', cursor: 'pointer', color: '#374151' }}>
                    <option value="">افتراضي ({TEMPLATES.find(t => t.id === settings.template)?.name})</option>
                    {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* زر الحفظ */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '20px' }}>
            <button onClick={handleSave} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 28px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.95rem', background: settings.primary_color, color: 'white', opacity: saving ? 0.7 : 1 }}>
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '16px', height: '16px' }} />}
              حفظ الإعدادات
            </button>
          </div>
        </div>

        {/* ── المعاينة ── */}
        <div style={{ position: 'sticky', top: '20px' }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Eye style={{ width: '16px', height: '16px', color: settings.primary_color }} />
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a1a2e' }}>معاينة مباشرة</span>
            </div>

            {/* تبويبات أنواع المستندات */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {DOC_TYPES.map(doc => (
                <button key={doc.id} onClick={() => setActiveDoc(doc.id)}
                  style={{ padding: '4px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, transition: 'all 0.15s',
                    background: activeDoc === doc.id ? settings.primary_color : '#f3f4f6',
                    color: activeDoc === doc.id ? 'white' : '#6b7280' }}>
                  {doc.label}
                </button>
              ))}
            </div>

            {/* القالب الفعلي */}
            <TemplatePreview
              template={settings.doc_types[activeDoc] || settings.template}
              color={settings.primary_color}
              logo={settings.show_logo ? logoUrl : null}
              companyName={companyName}
            />

            {/* ملخص الإعدادات */}
            <div style={{ marginTop: '14px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>ملخص الإعدادات</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[
                  ['القالب', TEMPLATES.find(t => t.id === (settings.doc_types[activeDoc] || settings.template))?.name],
                  ['حجم الورق', settings.paper_size],
                  ['اللغة', settings.language === 'ar' ? 'عربي' : settings.language === 'en' ? 'English' : 'ثنائي'],
                  ['الشعار', settings.show_logo ? '✅ يظهر' : '❌ مخفي'],
                  ['QR Code', settings.show_qr ? '✅ يظهر' : '❌ مخفي'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: '#6b7280' }}>{k}</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* تحذير إذا لا يوجد شعار */}
            {settings.show_logo && !logoUrl && (
              <div style={{ marginTop: '10px', padding: '10px 12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.75rem', color: '#92400e' }}>
                ⚠️ لم يتم رفع شعار الشركة بعد.{' '}
                <a href="/settings" style={{ color: '#1a56db', textDecoration: 'underline' }}>ارفع الشعار من إعدادات الشركة</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
