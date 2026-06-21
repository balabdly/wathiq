'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { FileText, Save, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { HREmployee, Termination, GratuityResult } from './hr_types'
import { calcGratuity } from './hr_utils'

export default function TerminationTab({ tenantId, hrEmployees }: { tenantId: string; hrEmployees: HREmployee[] }) {
  const [terminations, setTerminations] = useState<Termination[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  const [form, setForm] = useState({
    hr_employee_id: '',
    termination_type: 'استقالة',
    termination_date: '',
    last_working_day: '',
    notes: '',
    status: 'نهائي',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const selectedHR = hrEmployees.find(e => e.id === Number(form.hr_employee_id))
  const gratuity = selectedHR && form.last_working_day
    ? calcGratuity(selectedHR.hire_date || '', form.last_working_day, Number(selectedHR.basic_salary || 0), form.termination_type)
    : null

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('hr_terminations')
      .select('*, employee:hr_employees!hr_terminations_hr_employee_id_fkey(name, job_title)')
      .eq('tenant_id', tenantId)
      .order('termination_date', { ascending: false })
    setTerminations(data || [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ hr_employee_id: '', termination_type: 'استقالة', termination_date: '', last_working_day: '', notes: '', status: 'نهائي' })
    setEditId(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.hr_employee_id) { toast.error('اختر الموظف'); return }
    if (!form.termination_date) { toast.error('أدخل تاريخ الإنهاء'); return }
    if (!form.last_working_day) { toast.error('أدخل آخر يوم عمل'); return }
    if (!selectedHR) return

    setSaving(true)
    const payload = {
      tenant_id: tenantId,
      employee_id: selectedHR.employee_id,
      hr_employee_id: selectedHR.id,
      termination_type: form.termination_type,
      termination_date: form.termination_date,
      last_working_day: form.last_working_day,
      years_of_service: gratuity ? gratuity.years + (gratuity.months / 12) : 0,
      gratuity_amount: gratuity?.finalAmount || 0,
      notes: form.notes || null,
      status: form.status,
    }

    if (editId) {
      await supabase.from('hr_terminations').update(payload).eq('id', editId)
    } else {
      await supabase.from('hr_terminations').insert(payload)
      // تعطيل الموظف تلقائياً
      await supabase.from('hr_employees').update({ is_active: false }).eq('id', selectedHR.id)
      await supabase.from('employees').update({ is_active: false }).eq('id', selectedHR.employee_id)
    }

    await loadData()
    resetForm()
    setSaving(false)
    toast.success('تم حفظ إنهاء الخدمة ✅')
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا السجل؟')) return
    await supabase.from('hr_terminations').delete().eq('id', id)
    setTerminations(t => t.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  const TYPES = [
    // ← مكافأة كاملة
    { value: 'إنهاء عقد من صاحب العمل', icon: '📋', color: '#c81e1e',  group: 'كاملة' },
    { value: 'انتهاء عقد',              icon: '📅', color: '#1a56db',  group: 'كاملة' },
    { value: 'إنهاء باتفاق الطرفين',    icon: '🤝', color: '#0ea77b',  group: 'كاملة' },
    { value: 'إحالة للتقاعد',           icon: '🎖️', color: '#0ea77b',  group: 'كاملة' },
    { value: 'وفاة',                    icon: '🖤', color: '#374151',  group: 'كاملة' },
    { value: 'عجز كلي',                 icon: '🏥', color: '#6b7280',  group: 'كاملة' },
    { value: 'إغلاق المنشأة',           icon: '🏢', color: '#e6820a',  group: 'كاملة' },
    { value: 'تغيير جوهري في العقد',    icon: '📝', color: '#e6820a',  group: 'كاملة' },
    // ← مكافأة مخفّضة
    { value: 'استقالة',                 icon: '🚪', color: '#e6820a',  group: 'مخفّضة' },
    // ← لا مكافأة
    { value: 'فصل تأديبي',             icon: '⛔', color: '#c81e1e',  group: 'لا مكافأة' },
    { value: 'فصل',                    icon: '⚠️', color: '#c81e1e',  group: 'لا مكافأة' },
  ]

  const TYPE_COLOR: Record<string, string> = {
    'إنهاء عقد من صاحب العمل': 'badge-red',
    'انتهاء عقد': 'badge-blue',
    'إنهاء باتفاق الطرفين': 'badge-green',
    'إحالة للتقاعد': 'badge-green',
    'وفاة': 'badge-gray',
    'عجز كلي': 'badge-gray',
    'إغلاق المنشأة': 'badge-amber',
    'تغيير جوهري في العقد': 'badge-amber',
    'استقالة': 'badge-amber',
    'فصل تأديبي': 'badge-red',
    'فصل': 'badge-red',
  }

  return (
    <div className="space-y-4">

      {/* زر إضافة */}
      {!showForm && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> تسجيل إنهاء خدمة
          </button>
        </div>
      )}

      {/* ── نموذج الإضافة ── */}
      {showForm && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, marginBottom: '16px', color: 'var(--text)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogOut style={{ width: '18px', height: '18px', color: '#c81e1e' }} />
            {editId ? 'تعديل سجل إنهاء الخدمة' : 'تسجيل إنهاء خدمة جديد'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

            {/* الموظف */}
            <div style={{ gridColumn: '1/-1' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الموظف <span className="text-red-500">*</span></label>
              <select value={form.hr_employee_id} onChange={e => set('hr_employee_id', e.target.value)} className="select">
                <option value="">— اختر الموظف —</option>
                {hrEmployees.filter(e => e.is_active).map(e => (
                  <option key={e.id} value={e.id}>{e.name} — {e.job_title || ''}</option>
                ))}
              </select>
            </div>

            {/* نوع الإنهاء */}
            <div style={{ gridColumn: '1/-1' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الإنهاء <span className="text-red-500">*</span></label>
              <select value={form.termination_type} onChange={e => set('termination_type', e.target.value)} className="select">
                <optgroup label="✅ مكافأة كاملة">
                  <option value="إنهاء عقد من صاحب العمل">📋 إنهاء عقد من صاحب العمل</option>
                  <option value="انتهاء عقد">📅 انتهاء مدة العقد</option>
                  <option value="إنهاء باتفاق الطرفين">🤝 إنهاء باتفاق الطرفين</option>
                  <option value="إحالة للتقاعد">🎖️ إحالة للتقاعد</option>
                  <option value="وفاة">🖤 وفاة</option>
                  <option value="عجز كلي">🏥 عجز كلي عن العمل</option>
                  <option value="إغلاق المنشأة">🏢 إغلاق المنشأة</option>
                  <option value="تغيير جوهري في العقد">📝 رفض تغيير جوهري في العقد</option>
                </optgroup>
                <optgroup label="⚠️ مكافأة مخفّضة">
                  <option value="استقالة">🚪 استقالة</option>
                </optgroup>
                <optgroup label="❌ لا مكافأة">
                  <option value="فصل تأديبي">⛔ فصل تأديبي</option>
                  <option value="فصل">⚠️ فصل</option>
                </optgroup>
              </select>
              {/* مؤشر نوع المكافأة */}
              {form.termination_type && (() => {
                const t = TYPES.find(x => x.value === form.termination_type)
                const grpLabel = t?.group === 'كاملة' ? { text: '✅ يستحق مكافأة كاملة', bg: '#ecfdf5', color: '#065f46' }
                  : t?.group === 'مخفّضة' ? { text: '⚠️ يستحق مكافأة مخفّضة حسب سنوات الخدمة', bg: '#fffbeb', color: '#92400e' }
                  : { text: '❌ لا يستحق مكافأة نهاية خدمة', bg: '#fef2f2', color: '#991b1b' }
                return (
                  <div style={{ marginTop: '6px', padding: '5px 10px', background: grpLabel.bg, borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, color: grpLabel.color }}>
                    {grpLabel.text}
                  </div>
                )
              })()}
            </div>

            {/* التواريخ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الإنهاء الرسمي <span className="text-red-500">*</span></label>
              <input type="date" value={form.termination_date} onChange={e => set('termination_date', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">آخر يوم عمل فعلي <span className="text-red-500">*</span></label>
              <input type="date" value={form.last_working_day} onChange={e => set('last_working_day', e.target.value)} className="input" />
            </div>

            {/* مكافأة نهاية الخدمة — تلقائية حسب نظام العمل السعودي */}
            {gratuity && (
              <div style={{ gridColumn: '1/-1', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${gratuity.isEntitled ? '#bbf7d0' : '#fca5a5'}` }}>
                {/* رأس البطاقة */}
                <div style={{
                  padding: '10px 14px', color: 'white', fontWeight: 700, fontSize: '0.875rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: gratuity.isEntitled ? '#0ea77b' : '#c81e1e',
                }}>
                  <span>🧮 مكافأة نهاية الخدمة — حسب نظام العمل السعودي</span>
                  <span style={{ opacity: 0.9, fontSize: '0.78rem' }}>
                    {gratuity.years} سنة {gratuity.months > 0 ? `و ${gratuity.months} شهر` : ''} {gratuity.days > 0 ? `و ${gratuity.days} يوم` : ''}
                  </span>
                </div>

                <div style={{ padding: '12px 14px', background: gratuity.isEntitled ? '#f0fdf4' : '#fef2f2' }}>
                  {/* الأساس القانوني */}
                  <div style={{ fontSize: '0.78rem', color: gratuity.isEntitled ? '#065f46' : '#991b1b', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{gratuity.isEntitled ? '✅' : '❌'}</span>
                    <span>{gratuity.entitlement}</span>
                  </div>

                  {/* تفاصيل الحساب */}
                  {gratuity.breakdown.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      {gratuity.breakdown.map((line, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: '#374151', padding: '3px 0', borderBottom: i < gratuity.breakdown.length - 1 ? '1px dashed #d1fae5' : 'none' }}>
                          • {line}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* المبالغ */}
                  {gratuity.isEntitled && (
                    <>
                      {gratuity.reductionPct > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#6b7280', marginBottom: '4px', paddingBottom: '4px', borderBottom: '1px solid #fde68a' }}>
                          <span>المكافأة الكاملة قبل التخفيض</span>
                          <span style={{ fontWeight: 600 }}>{gratuity.fullAmount.toLocaleString()} ر.س</span>
                        </div>
                      )}
                      {gratuity.reductionPct > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#c81e1e', marginBottom: '8px' }}>
                          <span>تخفيض {gratuity.reductionPct}% ({gratuity.reductionLabel})</span>
                          <span style={{ fontWeight: 600 }}>- {(gratuity.fullAmount - gratuity.finalAmount).toLocaleString()} ر.س</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${gratuity.reductionPct > 0 ? '#fde68a' : '#bbf7d0'}`, paddingTop: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>💰 المكافأة المستحقة</span>
                        <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0ea77b' }}>{gratuity.finalAmount.toLocaleString()} ر.س</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* بيانات الموظف المختار */}
            {selectedHR && (
              <div style={{ gridColumn: '1/-1', background: 'var(--bg2)', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div><span style={{ color: 'var(--text3)' }}>الراتب الأساسي: </span><strong>{Number(selectedHR.basic_salary || 0).toLocaleString()} ر.س</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>تاريخ المباشرة: </span><strong>{selectedHR.hire_date || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>القسم: </span><strong>{selectedHR.department || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>الجنسية: </span><strong>{selectedHR.nationality || '—'}</strong></div>
                </div>
              </div>
            )}

            {/* ملاحظات */}
            <div style={{ gridColumn: '1/-1' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات / سبب الإنهاء</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                className="input" style={{ minHeight: '70px', resize: 'none' }}
                placeholder="مثال: قدّم استقالته لأسباب شخصية..." />
            </div>

            {/* الحالة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
                <option value="مؤقت">مؤقت (قيد المعالجة)</option>
                <option value="نهائي">نهائي</option>
              </select>
            </div>
          </div>

          {/* أزرار الحفظ */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={resetForm} className="btn btn-ghost">إلغاء</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary"
              style={{ background: '#c81e1e' }}>
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LogOut style={{ width: '15px', height: '15px' }} />}
              تأكيد إنهاء الخدمة
            </button>
          </div>
        </div>
      )}

      {/* ── جدول السجلات ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : terminations.length === 0 ? (
        <div className="card" style={{ padding: '50px', textAlign: 'center' }}>
          <LogOut style={{ width: '40px', height: '40px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد سجلات إنهاء خدمة</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الموظف', 'نوع الإنهاء', 'تاريخ الإنهاء', 'آخر يوم عمل', 'سنوات الخدمة', 'مكافأة نهاية الخدمة', 'الحالة', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {terminations.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700 }}>{t.employee?.name || `#${t.hr_employee_id}`}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{t.employee?.job_title}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge ${TYPE_COLOR[t.termination_type] || 'badge-gray'}`}>
                        {TYPES.find(x => x.value === t.termination_type)?.icon} {t.termination_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.85rem' }}>{t.termination_date}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.85rem' }}>{t.last_working_day}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>
                      {Math.floor(t.years_of_service)} سنة
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: t.gratuity_amount > 0 ? '#0ea77b' : 'var(--text3)' }}>
                      {t.gratuity_amount > 0 ? `${t.gratuity_amount.toLocaleString()} ر.س` : 'لا تستحق'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge ${t.status === 'نهائي' ? 'badge-red' : 'badge-amber'}`}>{t.status}</span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button onClick={() => {
                          setForm({
                            hr_employee_id: String(t.hr_employee_id),
                            termination_type: t.termination_type,
                            termination_date: t.termination_date,
                            last_working_day: t.last_working_day,
                            notes: t.notes || '',
                            status: t.status,
                          })
                          setEditId(t.id)
                          setShowForm(true)
                        }} className="btn btn-ghost btn-xs">
                          <Pencil style={{ width: '13px', height: '13px' }} />
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                          <Trash2 style={{ width: '13px', height: '13px' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

