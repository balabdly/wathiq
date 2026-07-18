'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { parseSecBoqCsv } from '@/lib/sec-boq-csv'
import {
  fetchFieldMemos, createFieldMemo, addMemoFollowUp, linkMemoToWo,
  fetchMemoFollowUps, fetchFrameworkBoqItems, ensureDefaultSecContract,
  importFrameworkBoqItems, countFrameworkBoqItems,
} from '@/lib/sec-workflow-service'
import type { FieldWorkMemo, MemoFollowUp, FrameworkBoqItem } from '@/lib/sec-workflow-service'
import {
  MEMO_STATUSES, FOLLOW_UP_STATUSES, WORK_TYPES, daysWaitingSince, DEFAULT_SEC_CONTRACT,
} from '@/lib/sec-workflow'
import {
  Plus, Search, X, Save, Phone, Link2, Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }

function MemoModal({ memo, teams, boqItems, tenantId, branchId, userName, onClose, onSave }: {
  memo: FieldWorkMemo | null
  teams: { id: number; name: string }[]
  boqItems: FrameworkBoqItem[]
  tenantId: string
  branchId?: number
  userName?: string
  onClose: () => void
  onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    work_type: memo?.work_type || 'صيانة',
    location: memo?.location || '',
    description: memo?.description || '',
    assigned_at: memo?.assigned_at?.slice(0, 16) || '',
    executed_at: memo?.executed_at?.slice(0, 16) || '',
    team_id: memo?.team_id ? String(memo.team_id) : '',
    assignee_name: memo?.assignee_name || '',
    sec_contact_name: memo?.sec_contact_name || '',
    sec_contact_phone: memo?.sec_contact_phone || '',
    sec_contact_dept: memo?.sec_contact_dept || '',
    notes: memo?.notes || '',
    item_code: '',
    qty: '1',
  })
  const [lines, setLines] = useState(memo?.boq_lines || [])
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function addLine() {
    const item = boqItems.find(b => b.item_code === form.item_code)
    if (!item) { toast.error('اختر بنداً'); return }
    setLines(l => [...l, {
      item_code: item.item_code,
      description: item.description_ar || item.description_en,
      unit: item.unit,
      qty: Number(form.qty) || 1,
      unit_price: Number(item.unit_price),
    }])
    set('item_code', '')
    set('qty', '1')
  }

  async function handleSave(markExecuted: boolean) {
    if (!form.description.trim()) { toast.error('الوصف مطلوب'); return }
    setSaving(true)
    const payload = {
      tenant_id: tenantId,
      branch_id: branchId,
      work_type: form.work_type,
      location: form.location || undefined,
      description: form.description.trim(),
      assigned_at: form.assigned_at || undefined,
      executed_at: markExecuted ? (form.executed_at || new Date().toISOString()) : form.executed_at || undefined,
      team_id: form.team_id ? Number(form.team_id) : undefined,
      assignee_name: form.assignee_name || undefined,
      sec_contact_name: form.sec_contact_name || undefined,
      sec_contact_phone: form.sec_contact_phone || undefined,
      sec_contact_dept: form.sec_contact_dept || undefined,
      boq_lines: lines,
      notes: form.notes || undefined,
      created_by: userName,
      status: markExecuted ? 'awaiting_wo' as const : (form.executed_at ? 'awaiting_wo' as const : 'draft' as const),
    }
    if (memo) {
      await supabase.from('field_work_memos').update({
        ...payload,
        updated_at: new Date().toISOString(),
      }).eq('id', memo.id)
    } else {
      const { error } = await createFieldMemo(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
    }
    toast.success('تم الحفظ ✅')
    setSaving(false)
    onSave()
    onClose()
  }

  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px', maxHeight: '90vh', overflow: 'auto' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, margin: 0 }}>{memo ? `تعديل ${memo.internal_ref}` : '📞 مذكرة تنفيذ — WO لاحق'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>نوع العمل</label>
              <select value={form.work_type} onChange={e => set('work_type', e.target.value)} className="select">
                {WORK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>الموقع</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} className="input" placeholder="فيدر / محطة..." />
            </div>
          </div>
          <div>
            <label style={lbl}>وصف العمل *</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} className="input" rows={3} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>تاريخ التنفيذ</label>
              <input type="datetime-local" value={form.executed_at} onChange={e => set('executed_at', e.target.value)} className="input" />
            </div>
            <div>
              <label style={lbl}>الفريق</label>
              <select value={form.team_id} onChange={e => set('team_id', e.target.value)} className="select">
                <option value="">—</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ background: '#fef9f0', padding: '12px', borderRadius: '10px', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>جهة التواصل — SEC</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input value={form.sec_contact_name} onChange={e => set('sec_contact_name', e.target.value)} className="input" placeholder="اسم الموظف" />
              <input value={form.sec_contact_phone} onChange={e => set('sec_contact_phone', e.target.value)} className="input" placeholder="الهاتف" dir="ltr" />
              <input value={form.sec_contact_dept} onChange={e => set('sec_contact_dept', e.target.value)} className="input" placeholder="القسم" style={{ gridColumn: '1 / -1' }} />
            </div>
          </div>
          {boqItems.length > 0 && (
            <div>
              <label style={lbl}>بند العقد (Unit Rate)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={form.item_code} onChange={e => set('item_code', e.target.value)} className="select" style={{ flex: 1 }}>
                  <option value="">— بند —</option>
                  {boqItems.slice(0, 200).map(b => (
                    <option key={b.item_code} value={b.item_code}>{b.item_code} — {b.unit_price} ر.س/{b.unit}</option>
                  ))}
                </select>
                <input type="number" value={form.qty} onChange={e => set('qty', e.target.value)} className="input" style={{ width: '70px' }} min="0" step="0.01" />
                <button type="button" onClick={addLine} className="btn btn-ghost">+</button>
              </div>
              {lines.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '0.78rem' }}>
                  {lines.map((l, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{l.item_code} × {l.qty}</span>
                      <span>{(l.qty * l.unit_price).toLocaleString('ar-SA')} ر.س</span>
                    </div>
                  ))}
                  <div style={{ fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                    الإجمالي: {total.toLocaleString('ar-SA')} ر.س
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={() => handleSave(false)} disabled={saving} className="btn btn-ghost">حفظ مسودة</button>
          <button onClick={() => handleSave(true)} disabled={saving} className="btn btn-primary">
            <Save style={{ width: '14px', height: '14px' }} /> منفّذ — بانتظار WO
          </button>
        </div>
      </div>
    </div>
  )
}

function FollowUpModal({ memo, userName, onClose, onSave }: {
  memo: FieldWorkMemo
  userName?: string
  onClose: () => void
  onSave: () => void
}) {
  const [note, setNote] = useState('')
  const [status, setStatus] = useState(memo.follow_up_status)
  const [nextDate, setNextDate] = useState('')
  const [history, setHistory] = useState<MemoFollowUp[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchMemoFollowUps(memo.id).then(({ data }) => setHistory(data || []))
  }, [memo.id])

  async function submit() {
    if (!note.trim()) { toast.error('اكتب ملاحظة المتابعة'); return }
    setSaving(true)
    const { error } = await addMemoFollowUp({
      tenant_id: memo.tenant_id,
      memo_id: memo.id,
      note: note.trim(),
      created_by: userName,
      follow_up_status: status,
      next_follow_up_at: nextDate || undefined,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('تم تسجيل المتابعة')
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, margin: 0 }}>📞 متابعة — {memo.internal_ref}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={lbl}>حالة المتابعة</label>
            <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className="select">
              {Object.entries(FOLLOW_UP_STATUSES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>ملاحظة *</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} className="input" rows={3} placeholder="اتصلت بـ ... وعد بإصدار WO..." />
          </div>
          <div>
            <label style={lbl}>موعد المتابعة القادمة</label>
            <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className="input" />
          </div>
          {history.length > 0 && (
            <div style={{ maxHeight: '160px', overflow: 'auto', fontSize: '0.78rem', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
              {history.map(h => (
                <div key={h.id} style={{ marginBottom: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px' }}>
                  <div style={{ color: 'var(--text3)' }}>{new Date(h.follow_up_at).toLocaleString('ar-SA')}</div>
                  <div>{h.note}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={submit} disabled={saving} className="btn btn-primary">تسجيل</button>
        </div>
      </div>
    </div>
  )
}

function LinkWoModal({ memo, branchId, onClose, onSave }: {
  memo: FieldWorkMemo
  branchId: number
  onClose: () => void
  onSave: () => void
}) {
  const [wo, setWo] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!wo.trim()) { toast.error('رقم WO مطلوب'); return }
    setSaving(true)
    const { project, error } = await linkMemoToWo({
      memo, wo_number: wo.trim(), tenant_id: memo.tenant_id, branch_id: branchId,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(`تم ربط WO وإنشاء مشروع: ${project?.name}`)
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '400px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>🔗 ربط WO — {memo.internal_ref}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '18px', height: '18px' }} /></button>
        </div>
        <div className="modal-body">
          <label style={lbl}>رقم أمر العمل SAP</label>
          <input value={wo} onChange={e => setWo(e.target.value)} className="input" dir="ltr" placeholder="4500123456" autoFocus />
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={submit} disabled={saving} className="btn btn-primary">ربط وإنشاء مشروع</button>
        </div>
      </div>
    </div>
  )
}

export default function FieldMemosPage() {
  const { tenant, activeBranch, currentUser } = useStore()
  const [memos, setMemos] = useState<FieldWorkMemo[]>([])
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([])
  const [boqItems, setBoqItems] = useState<FrameworkBoqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending_wo'>('pending_wo')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editMemo, setEditMemo] = useState<FieldWorkMemo | null>(null)
  const [followMemo, setFollowMemo] = useState<FieldWorkMemo | null>(null)
  const [linkMemo, setLinkMemo] = useState<FieldWorkMemo | null>(null)
  const [importing, setImporting] = useState(false)
  const [boqCount, setBoqCount] = useState(0)

  const userName = currentUser?.name || currentUser?.username

  useEffect(() => { if (tenant) load() }, [tenant?.id, filter])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const [memRes, teamRes] = await Promise.all([
      fetchFieldMemos(tenant.id, filter === 'pending_wo' ? 'pending_wo' : undefined),
      supabase.from('teams').select('id, name').eq('tenant_id', tenant.id).eq('is_active', true),
    ])
    setMemos(memRes.data || [])
    setTeams(teamRes.data || [])

    const contractId = await ensureDefaultSecContract(tenant.id, DEFAULT_SEC_CONTRACT)
    const { count } = await countFrameworkBoqItems(tenant.id, contractId)
    setBoqCount(count || 0)
    if ((count || 0) > 0) {
      const { data } = await fetchFrameworkBoqItems(tenant.id, contractId)
      setBoqItems(data || [])
    }
    setLoading(false)
  }

  async function importBoq() {
    if (!tenant) return
    setImporting(true)
    try {
      const contractId = await ensureDefaultSecContract(tenant.id, DEFAULT_SEC_CONTRACT)
      const res = await fetch('/data/sec-contract-items.csv')
      const text = await res.text()
      const items = parseSecBoqCsv(text)

      const { error } = await importFrameworkBoqItems(tenant.id, contractId, items)
      if (error) throw error
      toast.success(`تم استيراد ${items.length} بند ✅`)
      load()
    } catch (e: any) {
      toast.error(e.message || 'فشل الاستيراد')
    }
    setImporting(false)
  }

  const filtered = memos.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return m.internal_ref.toLowerCase().includes(q)
      || (m.location || '').includes(search)
      || m.description.includes(search)
      || (m.wo_number || '').includes(search)
  })

  const pendingCount = memos.filter(m => ['executed', 'awaiting_wo'].includes(m.status)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>📞 أعمال O&M — بانتظار WO</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text3)' }}>
            تسجيل أعمال شفهية/هاتفية → متابعة المشرف مع SEC → ربط WO → فوترة 100%
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {boqCount === 0 && (
            <button onClick={importBoq} disabled={importing} className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
              <Upload style={{ width: '14px', height: '14px' }} />
              {importing ? 'جاري الاستيراد...' : 'استيراد بنود العقد'}
            </button>
          )}
          <button onClick={() => { setEditMemo(null); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> مذكرة جديدة
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
        {[
          { label: 'بانتظار WO', value: pendingCount, color: '#c81e1e', bg: '#fef2f2' },
          { label: 'بنود العقد', value: boqCount, color: '#1a56db', bg: '#eff6ff' },
          { label: 'الإجمالي', value: filtered.length, color: '#6b7280', bg: '#f9fafb' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px', background: s.bg }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px', width: '200px' }} placeholder="بحث..." />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className="select">
          <option value="pending_wo">بانتظار WO فقط</option>
          <option value="all">كل المذكرات</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
          لا مذكرات — ابدأ بتسجيل عمل منفّذ بانتظار WO
        </div>
      ) : (
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                {['المذكرة', 'النوع', 'الموقع', 'الحالة', 'انتظار', 'SEC', 'آخر متابعة', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const st = MEMO_STATUSES[m.status]
                const days = daysWaitingSince(m.executed_at || m.created_at)
                const overdue = days !== null && days >= 14
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', background: overdue ? '#fffbeb' : undefined }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{m.internal_ref}</td>
                    <td style={{ padding: '10px 12px' }}>{m.work_type}</td>
                    <td style={{ padding: '10px 12px' }}>{m.location || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: overdue ? 700 : 400, color: overdue ? '#c81e1e' : 'inherit' }}>
                      {days !== null ? `${days} يوم` : '—'}
                      {overdue && ' ⚠️'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>
                      {m.sec_contact_name || '—'}
                      {m.sec_contact_phone && <div dir="ltr">{m.sec_contact_phone}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.72rem', color: 'var(--text3)' }}>
                      {m.last_follow_up_at ? new Date(m.last_follow_up_at).toLocaleDateString('ar-SA') : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {['executed', 'awaiting_wo'].includes(m.status) && (
                          <>
                            <button onClick={() => setFollowMemo(m)} title="متابعة" className="btn btn-ghost" style={{ padding: '6px' }}>
                              <Phone style={{ width: '14px', height: '14px' }} />
                            </button>
                            <button onClick={() => setLinkMemo(m)} title="ربط WO" className="btn btn-ghost" style={{ padding: '6px', color: '#0ea77b' }}>
                              <Link2 style={{ width: '14px', height: '14px' }} />
                            </button>
                          </>
                        )}
                        {m.status === 'wo_linked' && m.project_id && (
                          <a href={`/projects`} className="btn btn-ghost" style={{ padding: '6px', fontSize: '0.72rem' }}>مشروع</a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && tenant && (
        <MemoModal
          memo={editMemo}
          teams={teams}
          boqItems={boqItems}
          tenantId={tenant.id}
          branchId={activeBranch?.id}
          userName={userName}
          onClose={() => { setShowModal(false); setEditMemo(null) }}
          onSave={load}
        />
      )}
      {followMemo && (
        <FollowUpModal memo={followMemo} userName={userName} onClose={() => setFollowMemo(null)} onSave={load} />
      )}
      {linkMemo && activeBranch && (
        <LinkWoModal memo={linkMemo} branchId={activeBranch.id} onClose={() => setLinkMemo(null)} onSave={load} />
      )}
    </div>
  )
}
