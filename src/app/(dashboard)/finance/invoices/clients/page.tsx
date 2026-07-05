// src/app/(dashboard)/finance/invoices/clients/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Search, Users, Eye, Pencil, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSales } from '../SalesContext'
import type { Client } from '@/lib/sales-types'

// ════════════════════════════════════════
// مودال: إضافة / تعديل عميل
// ════════════════════════════════════════
function ClientModal({ client, tenantId, onClose, onSave }: { client: Client | null; tenantId: string; onClose: () => void; onSave: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: client?.name || '', name_en: client?.name_en || '', vat_number: client?.vat_number || '', cr_number: client?.cr_number || '',
    client_type: client?.client_type || 'شركة', city: client?.city || '', district: client?.district || '', street: client?.street || '',
    postal_code: client?.postal_code || '', country: client?.country || 'SA', phone: client?.phone || '', email: client?.email || '',
    contact_person: client?.contact_person || '', is_active: client?.is_active ?? true, notes: client?.notes || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم العميل مطلوب'); return }
    setSaving(true)
    const payload = { ...form, tenant_id: tenantId }
    if (client) await supabase.from('finance_clients').update(payload).eq('id', client.id)
    else {
      const { error } = await supabase.from('finance_clients').insert(payload)
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    }
    toast.success(client ? 'تم التعديل ✅' : '✅ تم إضافة العميل')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '90vh' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Users style={{ width: '18px', height: '18px', color: '#e6820a' }} />{client ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ gridColumn: '1 / -1' }}><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>اسم العميل *</label><input value={form.name} onChange={e => set('name', e.target.value)} className="input" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الاسم بالإنجليزية</label><input value={form.name_en} onChange={e => set('name_en', e.target.value)} className="input" dir="ltr" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>نوع العميل</label><select value={form.client_type} onChange={e => set('client_type', e.target.value)} className="select">{['شركة', 'مؤسسة', 'حكومي', 'فرد'].map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الرقم الضريبي (ZATCA)</label><input value={form.vat_number} onChange={e => set('vat_number', e.target.value)} className="input" dir="ltr" placeholder="15 رقم" maxLength={15} /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>السجل التجاري</label><input value={form.cr_number} onChange={e => set('cr_number', e.target.value)} className="input" dir="ltr" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>المدينة</label><input value={form.city} onChange={e => set('city', e.target.value)} className="input" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الحي</label><input value={form.district} onChange={e => set('district', e.target.value)} className="input" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الشارع</label><input value={form.street} onChange={e => set('street', e.target.value)} className="input" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الرمز البريدي</label><input value={form.postal_code} onChange={e => set('postal_code', e.target.value)} className="input" dir="ltr" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>الهاتف</label><input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" dir="ltr" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>البريد الإلكتروني</label><input value={form.email} onChange={e => set('email', e.target.value)} className="input" dir="ltr" type="email" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>جهة الاتصال</label><input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} className="input" /></div>
            <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>ملاحظات</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="cl-active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} style={{ width: '16px', height: '16px' }} />
              <label htmlFor="cl-active" style={{ fontSize: '0.875rem', fontWeight: 600 }}>عميل نشط</label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn btn-primary" style={{ background: '#e6820a' }}>
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            {client ? 'حفظ التعديل' : 'إضافة العميل'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة
// ════════════════════════════════════════
export default function ClientsPage() {
  const router = useRouter()
  const { tenantId, clients, reloadShared } = useSales()
  const [search, setSearch] = useState('')
  const [showClientModal, setShowClientModal] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)

  const filtered = clients.filter(c => !search || c.name.includes(search))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', maxWidth: '360px', flex: 1 }}>
          <Search style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم العميل..." className="input" style={{ paddingRight: '32px' }} />
        </div>
        <button onClick={() => { setEditClient(null); setShowClientModal(true) }} className="btn btn-primary" style={{ background: '#e6820a' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> عميل جديد
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا يوجد عملاء</div>
        : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead><tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>{['اسم العميل', 'النوع', 'الرقم الضريبي', 'الهاتف', 'المدينة', 'الحالة', ''].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--bg2)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: '12px 14px' }}><span className="badge badge-blue">{c.client_type}</span></td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                      {c.vat_number
                        ? <span style={{ color: '#0ea77b' }}><CheckCircle style={{ width: '12px', height: '12px', display: 'inline', marginLeft: '4px' }} />{c.vat_number}</span>
                        : <span style={{ color: '#e6820a' }}><AlertCircle style={{ width: '12px', height: '12px', display: 'inline', marginLeft: '4px' }} />غير مُدخل</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{c.phone || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{c.city || '—'}</td>
                    <td style={{ padding: '12px 14px' }}><span className={'badge ' + (c.is_active ? 'badge-green' : 'badge-gray')}>{c.is_active ? 'نشط' : 'موقوف'}</span></td>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => router.push(`/finance/invoices/clients/${c.id}`)} title="استعراض وكشف حساب"
                          style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}>
                          <Eye style={{ width: '13px', height: '13px' }} />
                        </button>
                        <button onClick={() => { setEditClient(c); setShowClientModal(true) }} className="btn btn-ghost btn-xs"><Pencil style={{ width: '13px', height: '13px' }} /> تعديل</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>

      {showClientModal && (
        <ClientModal client={editClient} tenantId={tenantId!}
          onClose={() => { setShowClientModal(false); setEditClient(null) }}
          onSave={() => { setShowClientModal(false); setEditClient(null); reloadShared() }} />
      )}
    </div>
  )
}
