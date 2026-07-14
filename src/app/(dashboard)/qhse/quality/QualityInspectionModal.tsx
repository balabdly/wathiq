'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Project  = { id: number; name: string }
type Employee = { id: number; name: string; job_title?: string }

// ⚠️ قائمة افتراضية عامة — استبدلها بمعيار الجودة الرسمي للشركة عند توفره
const CHECKLIST_ITEMS = [
  'مطابقة التنفيذ للمخططات الهندسية المعتمدة',
  'مطابقة المواد المستخدمة للمواصفات الفنية المعتمدة',
  'توثيق شهادات المواد ومصادرها (Material Certificates)',
  'جودة أعمال التمديدات والتوصيلات الكهربائية',
  'إحكام التأريض (Earthing) ومطابقته للمواصفة',
  'اختبار العزل الكهربائي (Insulation Resistance Test) وتوثيق النتائج',
  'اختبار استمرارية التأريض (Continuity Test)',
  'سلامة التوصيلات داخل اللوحات الكهربائية ووضوح الترقيم',
  'مطابقة المسافات والتجهيزات لمتطلبات السلامة الكهربائية',
  'نظافة وترتيب موقع العمل بعد الانتهاء',
  'توثيق الانحرافات عن المخطط الأصلي (إن وجدت) واعتمادها',
  'اكتمال ملف التسليم الفني (As-Built / Test Reports)',
]

type CheckResult = 'نعم' | 'لا' | 'لا ينطبق' | ''

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.82rem',
  fontWeight: 600, color: 'var(--text)', marginBottom: '5px'
}

const RESULT_BTNS: { val: CheckResult; label: string; color: string; bg: string }[] = [
  { val: 'نعم',       label: 'نعم',       color: '#0ea77b', bg: '#ecfdf5' },
  { val: 'لا',        label: 'لا',        color: '#c81e1e', bg: '#fef2f2' },
  { val: 'لا ينطبق', label: 'لا ينطبق', color: '#6b7280', bg: '#f3f4f6' },
]

export default function QualityInspectionModal({ projects, employees, onClose, onSave, defaultProjectId, defaultEngineer }: {
  projects: Project[]; employees: Employee[]
  onClose: () => void; onSave: () => void
  defaultProjectId?: number
  defaultEngineer?: string
}) {
  const { tenant, currentUser, activeBranch } = useStore()
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [photos,   setPhotos]   = useState<{ name: string; data: string }[]>([])
  const [locating, setLocating] = useState(false)
  const [coords,   setCoords]   = useState<{ lat: number; lng: number; address: string } | null>(null)

  async function detectLocation() {
    if (!navigator.geolocation) { toast.error('المتصفح لا يدعم تحديد الموقع'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords
      try {
        const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`)
        const data = await res.json()
        const addr = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        setCoords({ lat, lng, address: addr })
        set('location', addr.split(',').slice(0,3).join('،'))
        toast.success('✅ تم تحديد الموقع')
      } catch {
        setCoords({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` })
        set('location', `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
      }
      setLocating(false)
    }, () => { toast.error('تعذّر تحديد الموقع — تأكد من تفعيل الإذن'); setLocating(false) })
  }

  function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = ev => setPhotos(p => [...p, { name: file.name, data: ev.target?.result as string }])
      reader.readAsDataURL(file)
    })
  }

  const [form, setForm] = useState({
    date:                 today,
    visit_time:           '',
    location:             '',
    project_id:           defaultProjectId ? String(defaultProjectId) : '',
    location_name:        '',
    engineer:             defaultEngineer || currentUser?.name || '',
    supervisor_name:      '',
    work_order_source:    '',
    work_order_receiver:  '',
    general_notes:        '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const [checklist, setChecklist] = useState<CheckResult[]>(
    Array(CHECKLIST_ITEMS.length).fill('')
  )

  function setCheck(i: number, val: CheckResult) {
    setChecklist(prev => { const n = [...prev]; n[i] = val; return n })
  }

  const totalAnswered = checklist.filter(c => c !== '').length
  const totalNo       = checklist.filter(c => c === 'لا').length
  const totalYes      = checklist.filter(c => c === 'نعم').length
  const overallSpecs  = totalNo > 0 ? 'غير مطابق' : totalAnswered > 0 ? 'مطابق' : 'مطابق'

  async function handleSave() {
    if (!form.location.trim()) { toast.error('الموقع مطلوب'); return }
    if (!form.engineer.trim()) { toast.error('مهندس الجودة مطلوب'); return }
    setSaving(true)
    try {
      const checklistData = CHECKLIST_ITEMS.map((item, i) => ({
        no:     i + 1,
        item,
        result: checklist[i] || 'لا ينطبق',
      }))
      const failedItems = checklistData.filter(c => c.result === 'لا')

      const payload: Record<string, any> = {
        tenant_id:            tenant!.id,
        branch_id:            activeBranch?.id || 1,
        type:                 'جودة',
        entry_type:           'زيارة',
        date:                 form.date,
        visit_time:           form.visit_time || null,
        engineer:             form.engineer,
        location:             form.project_id ? form.location : (form.location_name || form.location),
        supervisor_name:      form.supervisor_name || null,
        work_order_source:    form.work_order_source || null,
        work_order_receiver:  form.work_order_receiver || null,
        specs:                overallSpecs,
        status:               overallSpecs === 'مطابق' ? 'مغلق' : 'مفتوح',
        lifecycle:            overallSpecs === 'مطابق' ? 'اعتماد' : 'رصد',
        checklist:            checklistData,
        general_notes:        form.general_notes || null,
        attachments:          photos.length > 0 ? photos : null,
        latitude:             coords?.lat || null,
        longitude:            coords?.lng || null,
        location_address:     coords?.address || null,
        notes: failedItems.length > 0
          ? `بنود غير مطابقة: ${failedItems.map(f => f.no).join('، ')}`
          : null,
        corrective: failedItems.length > 0
          ? failedItems.map(f => `${f.no}. ${f.item}`).join('\n')
          : null,
        severity: totalNo >= 5 ? 'عالي' : totalNo >= 2 ? 'متوسط' : totalNo === 1 ? 'منخفض' : null,
      }
      if (form.project_id) payload.project_id = Number(form.project_id)

      const { error } = await supabase.from('visits').insert(payload)
      if (error) throw error

      toast.success(`✅ تم تسجيل زيارة الجودة — ${totalYes} مطابق / ${totalNo} غير مطابق`)
      onSave()
    } catch (err: any) {
      toast.error('خطأ: ' + err.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '700px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            📋 نموذج زيارة تفتيش الجودة
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>

          <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.76rem', color: '#92400e' }}>
            ⚠️ هذه قائمة فحص افتراضية عامة — سيتم استبدالها بمعيار الجودة الرسمي للشركة عند توفره
          </div>

          {/* البيانات الأساسية */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '12px', color: 'var(--text3)' }}>البيانات الأساسية</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div><label style={lbl}>التاريخ *</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" /></div>
              <div><label style={lbl}>الوقت</label><input type="time" value={form.visit_time} onChange={e => set('visit_time', e.target.value)} className="input" /></div>
              <div>
                <label style={lbl}>الموقع *</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="موقع العمل" style={{ flex: 1 }} />
                  <button type="button" onClick={detectLocation} disabled={locating}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #1a56db', background: '#eff6ff', color: '#1a56db', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                    {locating ? '...' : '📍 موقعي'}
                  </button>
                </div>
                {coords && <div style={{ fontSize: '0.68rem', color: '#0ea77b', marginTop: '3px' }}>✅ {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</div>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={lbl}>المشروع <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: '0.72rem' }}>(اختياري)</span></label>
                <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                  <option value="">— لا يوجد مشروع محدد —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {!form.project_id && (
                  <input value={form.location_name || ''} onChange={e => set('location_name', e.target.value)}
                    className="input" style={{ marginTop: 6 }}
                    placeholder="مكتب / مستودع / ساحة / موقع آخر..." />
                )}
              </div>
              <div><label style={lbl}>مهندس الجودة *</label>
                <select value={form.engineer} onChange={e => set('engineer', e.target.value)} className="select">
                  <option value="">— اختر —</option>
                  {employees.map(e => <option key={e.id} value={e.name}>{e.name}{e.job_title ? ` — ${e.job_title}` : ''}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div><label style={lbl}>مشرف الموقع</label><input value={form.supervisor_name} onChange={e => set('supervisor_name', e.target.value)} className="input" /></div>
              <div><label style={lbl}>مصدر أمر العمل</label><input value={form.work_order_source} onChange={e => set('work_order_source', e.target.value)} className="input" /></div>
              <div><label style={lbl}>مستلم أمر العمل</label><input value={form.work_order_receiver} onChange={e => set('work_order_receiver', e.target.value)} className="input" /></div>
            </div>
          </div>

          {/* قائمة الفحص */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>قائمة فحص الجودة ({totalAnswered}/{CHECKLIST_ITEMS.length})</div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem' }}>
                <span style={{ color: '#0ea77b', fontWeight: 700 }}>✓ {totalYes} مطابق</span>
                <span style={{ color: '#c81e1e', fontWeight: 700 }}>✗ {totalNo} غير مطابق</span>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', background: '#1a56db', color: 'white', padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, gap: '8px' }}>
                <div>#</div>
                <div>بند فحص الجودة</div>
                <div style={{ textAlign: 'center', minWidth: '200px' }}>النتيجة</div>
              </div>

              {CHECKLIST_ITEMS.map((item, i) => {
                const result = checklist[i]
                const rowBg = result === 'نعم' ? '#f0fdf4' : result === 'لا' ? '#fef2f2' : 'white'
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '36px 1fr auto',
                    padding: '8px 12px', gap: '8px', alignItems: 'center',
                    borderBottom: i < CHECKLIST_ITEMS.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: rowBg, transition: 'background 0.15s',
                  }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textAlign: 'center' }}>{i + 1}</div>
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.5, color: result === 'لا' ? '#c81e1e' : 'var(--text)' }}>{item}</div>
                    <div style={{ display: 'flex', gap: '4px', minWidth: '200px', justifyContent: 'flex-end' }}>
                      {RESULT_BTNS.map(btn => (
                        <button key={btn.val} type="button" onClick={() => setCheck(i, btn.val)}
                          style={{
                            padding: '4px 10px', borderRadius: '6px', border: '1.5px solid',
                            cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'inherit',
                            transition: 'all 0.1s',
                            borderColor: result === btn.val ? btn.color : 'var(--border)',
                            background:  result === btn.val ? btn.bg : 'white',
                            color:       result === btn.val ? btn.color : 'var(--text3)',
                          }}>
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* النتيجة الإجمالية */}
          {totalAnswered > 0 && (
            <div style={{
              padding: '12px 16px', borderRadius: '10px', textAlign: 'center',
              background: totalNo === 0 ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${totalNo === 0 ? '#bbf7d0' : '#fecaca'}`,
            }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: totalNo === 0 ? '#0ea77b' : '#c81e1e' }}>
                {totalNo === 0 ? '✅ التنفيذ مطابق لمتطلبات الجودة' : `❌ ${totalNo} بند غير مطابق — يتطلب إجراءً تصحيحياً`}
              </div>
              {totalNo > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#c81e1e', marginTop: '4px' }}>
                  مستوى الخطورة: {totalNo >= 5 ? '🔴 عالي' : totalNo >= 2 ? '🟡 متوسط' : '🟢 منخفض'}
                </div>
              )}
            </div>
          )}

          {totalNo > 0 && (
            <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.76rem', color: '#1a56db' }}>
              📋 ستدخل هذه البنود غير المطابقة دورة: <strong>رصد → إسناد → تصحيح → اعتماد</strong> — سيقوم مهندس الجودة بتحديد المسؤول عن التصحيح لاحقاً
            </div>
          )}

          {/* صور ومرفقات */}
          <div>
            <label style={lbl}>
              📷 صور ومرفقات الزيارة
              {photos.length > 0 && <span style={{ marginRight: '6px', fontSize: '0.72rem', background: '#eff6ff', color: '#1a56db', padding: '1px 6px', borderRadius: '10px' }}>{photos.length}</span>}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', border: '2px dashed var(--border)', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text3)' }}>
              📎 اضغط لإضافة صور أو مرفقات
              <input type="file" accept="image/*" multiple onChange={handlePhotos} style={{ display: 'none' }} />
            </label>
            {photos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px' }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', aspectRatio: '1' }}>
                    <img src={p.data} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button type="button" onClick={() => setPhotos(ph => ph.filter((_, idx) => idx !== i))}
                      style={{ position: 'absolute', top: '3px', left: '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#c81e1e', color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ملاحظات عامة */}
          <div>
            <label style={lbl}>ملاحظات عامة</label>
            <textarea value={form.general_notes} onChange={e => set('general_notes', e.target.value)}
              className="input" style={{ minHeight: '70px', resize: 'none' }}
              placeholder="أي ملاحظات إضافية..." />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ background: '#1a56db' }}>
            {saving
              ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              : <Save style={{ width: '15px', height: '15px' }} />}
            حفظ زيارة الجودة
          </button>
        </div>
      </div>
    </div>
  )
}
