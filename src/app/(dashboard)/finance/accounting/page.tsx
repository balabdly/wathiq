'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Trash2, ChevronDown, ChevronLeft, BookOpen, Layers, Target, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createJournalEntry } from '@/lib/journal'

// ════════════════════════════════════════
// Types
// ════════════════════════════════════════
type Account = {
  id: number; tenant_id: string; code: string; name: string; name_en?: string
  account_type: string; account_class: string; parent_id?: number
  level: number; is_parent: boolean; normal_balance: string
  is_active: boolean; notes?: string
  children?: Account[]
  balance?: number
}
type CostCenter = {
  id: number; tenant_id: string; code: string; name: string
  type: string; project_id?: number; is_active: boolean; notes?: string
  project?: { name: string }
}
type JournalEntry = {
  id: number; tenant_id: string; entry_number: string; entry_date: string
  description: string; reference_type?: string; reference_id?: number
  total_debit: number; total_credit: number; status: string
  lines?: JournalLine[]
}
type JournalLine = {
  id?: number; entry_id?: number; account_id: number; cost_center_id?: number
  debit: number; credit: number; description?: string
  account?: Account; cost_center?: CostCenter
}
type AccountLedgerLine = {
  id: number
  entry_number: string
  entry_date: string
  description: string
  debit: number
  credit: number
  entry_source: string
  reference_type?: string
  reference_id?: number
  running_balance: number
}

const ACCOUNT_TYPE_COLOR: Record<string, string> = {
  'أصول': '#1a56db', 'خصوم': '#c81e1e', 'حقوق ملكية': '#0ea77b',
  'إيرادات': '#0ea77b', 'تكلفة': '#e6820a', 'مصروفات': '#6b7280'
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px'
}
const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
    <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  </div>
)

// ════════════════════════════════════════
// مودال: إضافة / تعديل حساب — قواعد محاسبية صارمة
// ════════════════════════════════════════
function AccountModal({ account, accounts, defaultParent, tenantId, onClose, onSave }: {
  account: Account | null; accounts: Account[]; defaultParent?: Account | null
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)

  // تحديد الأب: إما من الحساب المعدَّل أو من defaultParent
  const parentAcc = account?.parent_id
    ? accounts.find(a => a.id === account.parent_id)
    : defaultParent || null

  // القواعد المورّثة من الأب
  const inheritedType    = parentAcc?.account_type   || account?.account_type   || 'مصروفات'
  const inheritedBalance = parentAcc?.normal_balance  || account?.normal_balance  ||
    (['أصول','تكلفة','مصروفات'].includes(inheritedType) ? 'مدين' : 'دائن')
  const inheritedClass   = parentAcc?.account_class   || account?.account_class   ||
    (['أصول','خصوم','حقوق ملكية'].includes(inheritedType) ? 'ميزانية' : 'دخل')

  // حساب الكود المقترح تلقائياً
  function suggestCode(parentId: string): string {
    if (!parentId) return ''
    const par = accounts.find(a => a.id === Number(parentId))
    if (!par) return ''
    const parCode = par.code
    const siblings = accounts
      .filter(a => a.parent_id === Number(parentId))
      .filter(a => !account || a.id !== account.id) // استبعاد الحساب المعدَّل نفسه
      .map(a => parseInt(a.code))
      .filter(n => !isNaN(n) && n > 0)
    let next: number
    if (siblings.length === 0) {
      next = parseInt(parCode) * 10 + 1
    } else {
      next = Math.max(...siblings) + 1
    }
    // تجنب التكرار
    while (accounts.some(a => String(a.id !== account?.id) && a.code === String(next))) next++
    return String(next)
  }

  const initParentId = account?.parent_id ? String(account.parent_id)
    : defaultParent?.id ? String(defaultParent.id) : ''

  const [form, setForm] = useState({
    code:       account?.code  || '',
    name:       account?.name  || '',
    name_en:    account?.name_en || '',
    parent_id:  initParentId,
    is_parent:  account?.is_parent ?? false,
    is_active:  account?.is_active ?? true,
    notes:      account?.notes || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // الأب المحدد حالياً
  const selectedParent = accounts.find(a => a.id === Number(form.parent_id)) || parentAcc

  // الكود المقترح للعرض في placeholder
  const suggestedCode = !form.code && form.parent_id ? suggestCode(form.parent_id) : ''

  // هل الأب مقفل (جاء من defaultParent)
  const isParentLocked = !!defaultParent && !account

  async function handleSave() {
    if (!form.name.trim()) { toast.error('اسم الحساب مطلوب'); return }
    setSaving(true)

    // توليد الكود النهائي
    let finalCode = form.code.trim()
    if (!finalCode) {
      if (form.parent_id) {
        finalCode = suggestCode(form.parent_id)
        if (!finalCode) { toast.error('تعذّر توليد رقم الحساب'); setSaving(false); return }
      } else {
        // حساب رئيسي بدون أب
        const TYPE_START: Record<string, number> = {
          'أصول': 1000, 'خصوم': 2000, 'حقوق ملكية': 3000,
          'إيرادات': 4000, 'تكلفة': 5000, 'مصروفات': 6000,
        }
        const start = TYPE_START[inheritedType] || 9000
        const existing = accounts
          .filter(a => !a.parent_id && parseInt(a.code) >= start && parseInt(a.code) < start + 1000)
          .map(a => parseInt(a.code)).filter(n => !isNaN(n))
        const maxE = existing.length > 0 ? Math.max(...existing) : start - 100
        finalCode = String(maxE + 100)
        while (accounts.some(a => a.code === finalCode)) finalCode = String(parseInt(finalCode) + 10)
      }
    } else if (!account && accounts.some(a => a.code === finalCode)) {
      toast.error(`الكود ${finalCode} مستخدم مسبقاً`); setSaving(false); return
    }

    const par = accounts.find(a => a.id === Number(form.parent_id))
    const payload = {
      tenant_id:      tenantId,
      code:           finalCode,
      name:           form.name.trim(),
      name_en:        form.name_en || null,
      account_type:   par?.account_type   || inheritedType,
      account_class:  par?.account_class  || inheritedClass,
      normal_balance: par?.normal_balance || inheritedBalance,
      parent_id:      form.parent_id ? Number(form.parent_id) : null,
      level:          par ? (par.level || 1) + 1 : 1,
      is_parent:      form.is_parent,
      is_active:      form.is_active,
      notes:          form.notes || null,
    }
    if (account) {
      const { error } = await supabase.from('finance_accounts').update(payload).eq('id', account.id)
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('finance_accounts').insert(payload)
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
      // تحديث الأب تلقائياً → is_parent = true
      if (payload.parent_id) {
        await supabase.from('finance_accounts').update({ is_parent: true }).eq('id', payload.parent_id)
      }
    }
    toast.success(account ? 'تم التعديل ✅' : `✅ تمت إضافة الحساب (${finalCode})`)
    onSave(); setSaving(false)
  }

  const typeColor = ACCOUNT_TYPE_COLOR[selectedParent?.account_type || inheritedType] || '#374151'
  const parentAccounts = accounts.filter(a => a.is_parent && a.level < 5)

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '520px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
            {account ? 'تعديل الحساب' : 'إضافة حساب جديد'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px', borderRadius: '6px' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* معلومات مورّثة من الأب */}
          {selectedParent && (
            <div style={{ padding: '10px 14px', background: typeColor + '10', borderRadius: '10px', border: `1px solid ${typeColor}30`, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>الحساب الأب</span>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: typeColor }}>{selectedParent.code} — {selectedParent.name}</div>
              </div>
              <div style={{ borderRight: '1px solid ' + typeColor + '30', paddingRight: '12px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>النوع (مورّث)</span>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: typeColor }}>{selectedParent.account_type}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>الرصيد الطبيعي</span>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: typeColor }}>{selectedParent.normal_balance}</div>
              </div>
            </div>
          )}

          {/* الكود والاسم */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>رمز الحساب</label>
              <input value={form.code} onChange={e => set('code', e.target.value)} className="input" dir="ltr"
                placeholder={suggestedCode || 'تلقائي'} style={{ fontFamily: 'monospace', fontWeight: 700 }} />
              {suggestedCode && !form.code && (
                <div style={{ fontSize: '0.68rem', color: '#0ea77b', marginTop: '3px' }}>سيُولَّد تلقائياً: {suggestedCode}</div>
              )}
            </div>
            <div>
              <label style={labelStyle}>اسم الحساب *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" autoFocus
                placeholder="مثال: أسفلت، خرسانة، رمل..." />
            </div>
          </div>

          {/* الاسم الإنجليزي */}
          <div>
            <label style={labelStyle}>الاسم بالإنجليزية (اختياري)</label>
            <input value={form.name_en} onChange={e => set('name_en', e.target.value)} className="input" dir="ltr" />
          </div>

          {/* الحساب الأب — مقفل إذا جاء من زر + فرعي */}
          {!isParentLocked ? (
            <div>
              <label style={labelStyle}>الحساب الأب</label>
              <select value={form.parent_id} onChange={e => { set('parent_id', e.target.value); set('code', '') }} className="select">
                <option value="">— حساب رئيسي بدون أب —</option>
                {parentAccounts.map(a => (
                  <option key={a.id} value={a.id}>{'  '.repeat(a.level - 1)}{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text3)' }}>
              🔒 الحساب الأب محدد: <strong style={{ color: 'var(--text)' }}>{selectedParent?.code} — {selectedParent?.name}</strong>
            </div>
          )}

          {/* نوع الحساب — عرض فقط إذا لا يوجد أب */}
          {!form.parent_id && !account?.parent_id && (
            <div>
              <label style={labelStyle}>نوع الحساب *</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['أصول', 'خصوم', 'حقوق ملكية', 'إيرادات', 'تكلفة', 'مصروفات'].map(t => {
                  const tColor = ACCOUNT_TYPE_COLOR[t] || '#374151'
                  return (
                    <button key={t} type="button"
                      onClick={() => setForm(f => ({ ...f,
                        code: '',
                      }))}
                      style={{ padding: '6px 14px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                        borderColor: inheritedType === t ? tColor : 'var(--border)',
                        background:  inheritedType === t ? tColor + '15' : 'white',
                        color:       inheritedType === t ? tColor : 'var(--text3)',
                        opacity: inheritedType === t ? 1 : 0.5,
                      }}>
                      {t}
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>
                💡 النوع يُورَّث تلقائياً من الأب — لا يمكن تغييره عند وجود أب
              </div>
            </div>
          )}

          {/* طبيعة الحساب */}
          <div>
            <label style={labelStyle}>طبيعة الحساب</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { val: false, label: '📄 فرعي', sub: 'يقبل قيوداً مباشرة' },
                { val: true,  label: '📁 رئيسي', sub: 'يجمّع حسابات تحته' },
              ].map(opt => (
                <button key={String(opt.val)} type="button" onClick={() => set('is_parent', opt.val)}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid', cursor: 'pointer', textAlign: 'center',
                    borderColor: form.is_parent === opt.val ? 'var(--primary)' : 'var(--border)',
                    background:  form.is_parent === opt.val ? '#eff6ff' : 'white',
                    color:       form.is_parent === opt.val ? 'var(--primary)' : 'var(--text3)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.68rem', marginTop: '2px', opacity: 0.7 }}>{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ملاحظات */}
          <div>
            <label style={labelStyle}>ملاحظات</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '15px', height: '15px' }} />}
            {account ? 'حفظ التعديل' : 'إضافة الحساب'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// Panel: كشف حساب — يفتح من اليسار
// ════════════════════════════════════════
function AccountLedgerPanel({ account, tenantId, onClose }: {
  account: Account; tenantId: string; onClose: () => void
}) {
  const [lines, setLines]     = useState<AccountLedgerLine[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadLines() }, [account.id])

  async function loadLines() {
    setLoading(true)
    const { data } = await supabase
      .from('finance_journal_lines')
      .select(`
        id, debit, credit, description,
        finance_journal_entries!inner(
          id, entry_number, entry_date, description, reference_type, reference_id, entry_source, tenant_id
        )
      `)
      .eq('account_id', account.id)
      .eq('finance_journal_entries.tenant_id', tenantId)
      .order('finance_journal_entries(entry_date)', { ascending: true })

    if (data) {
      let balance = 0
      const mapped: AccountLedgerLine[] = (data as any[]).map((l: any) => {
        const entry  = l.finance_journal_entries
        const debit  = Number(l.debit  || 0)
        const credit = Number(l.credit || 0)
        balance += debit - credit
        return {
          id:              l.id,
          entry_number:    entry.entry_number,
          entry_date:      entry.entry_date,
          description:     l.description || entry.description,
          debit, credit,
          entry_source:    entry.entry_source || 'آلي',
          reference_type:  entry.reference_type,
          reference_id:    entry.reference_id,
          running_balance: balance,
        }
      })
      setLines(mapped)
    }
    setLoading(false)
  }

  const totalDebit  = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  const netBalance  = totalDebit - totalCredit
  const color = ACCOUNT_TYPE_COLOR[account.account_type] || '#6b7280'

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40, backdropFilter: 'blur(2px)' }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 'min(740px, 92vw)', background: 'white', zIndex: 50,
        boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInFromLeft 0.25s ease'
      }}>
        {/* رأس */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: color + '10', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.8rem', fontFamily: 'monospace' }}>
                  {account.code}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1a1a2e' }}>{account.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '2px' }}>
                    {account.account_type} — الرصيد الطبيعي: {account.normal_balance}
                  </div>
                </div>
              </div>
              {/* إحصاءات سريعة */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  { label: 'إجمالي مدين',  value: totalDebit,             color: '#1a56db', bg: '#eff6ff' },
                  { label: 'إجمالي دائن',  value: totalCredit,            color: '#c81e1e', bg: '#fef2f2' },
                  { label: 'الرصيد الصافي',value: Math.abs(netBalance),   color, bg: color + '15',
                    suffix: netBalance >= 0 ? ' م' : ' د' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: '8px', padding: '8px 14px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginBottom: '2px' }}>{s.label}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: s.color, direction: 'ltr' }}>
                      {s.value.toLocaleString()} ر.س{(s as any).suffix || ''}
                    </div>
                  </div>
                ))}
                <div style={{ background: '#f3f4f6', borderRadius: '8px', padding: '8px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginBottom: '2px' }}>عدد الحركات</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151' }}>{lines.length}</div>
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px', fontSize: '1.3rem', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* الجدول */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <div style={{ width: '28px', height: '28px', border: '3px solid var(--border)', borderTopColor: color, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : lines.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📭</div>
              <div style={{ fontWeight: 600 }}>لا توجد حركات مسجلة على هذا الحساب</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                  {['رقم القيد', 'التاريخ', 'البيان', 'المصدر', 'مدين', 'دائن', 'الرصيد'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={line.id}
                    style={{ borderBottom: '1px solid var(--bg2)', background: i % 2 === 0 ? 'white' : '#fafafa' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa')}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#1a56db', fontWeight: 600 }}>
                      {line.entry_number}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {line.entry_date}
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: '200px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {line.description}
                      </div>
                      {line.reference_type && line.reference_id && (
                        <Link href={
                          line.reference_type === 'فاتورة' ? `/finance/invoices/${line.reference_id}` :
                          line.reference_type === 'قبض' || line.reference_type === 'صرف' ? `/finance/treasury` :
                          line.reference_type === 'مصروف' ? `/finance/expenses` :
                          line.reference_type === 'عهدة' ? `/finance/treasury` : '#'
                        }
                          style={{ fontSize: '0.68rem', color: '#1a56db', marginTop: '1px', display: 'inline-flex', alignItems: 'center', gap: '2px', textDecoration: 'none' }}
                          title="الانتقال للمصدر">
                          {line.reference_type} <ExternalLink style={{ width: '10px', height: '10px' }} />
                        </Link>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 600,
                        background:  line.entry_source === 'يدوي' ? '#eff6ff' : '#f0fdf4',
                        color:       line.entry_source === 'يدوي' ? '#1a56db' : '#0ea77b',
                        border: `1px solid ${line.entry_source === 'يدوي' ? '#bfdbfe' : '#bbf7d0'}`,
                      }}>
                        {line.entry_source === 'يدوي' ? '✏️ يدوي' : '⚙️ آلي'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#1a56db', fontWeight: 600, direction: 'ltr', textAlign: 'left' }}>
                      {line.debit > 0 ? line.debit.toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#c81e1e', fontWeight: 600, direction: 'ltr', textAlign: 'left' }}>
                      {line.credit > 0 ? line.credit.toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, direction: 'ltr', textAlign: 'left',
                      color: line.running_balance >= 0 ? '#1a56db' : '#c81e1e' }}>
                      {Math.abs(line.running_balance).toLocaleString()}
                      <span style={{ fontSize: '0.62rem', opacity: 0.7, marginRight: '3px' }}>
                        {line.running_balance >= 0 ? 'م' : 'د'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f1f5f9', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={4} style={{ padding: '12px', color: 'var(--text3)', fontSize: '0.8rem', fontWeight: 600 }}>
                    الإجمالي — {lines.length} حركة
                  </td>
                  <td style={{ padding: '12px', color: '#1a56db', fontWeight: 700, direction: 'ltr', textAlign: 'left' }}>
                    {totalDebit.toLocaleString()} ر.س
                  </td>
                  <td style={{ padding: '12px', color: '#c81e1e', fontWeight: 700, direction: 'ltr', textAlign: 'left' }}>
                    {totalCredit.toLocaleString()} ر.س
                  </td>
                  <td style={{ padding: '12px', color, fontWeight: 700, direction: 'ltr', textAlign: 'left' }}>
                    {Math.abs(netBalance).toLocaleString()} ر.س
                    <span style={{ fontSize: '0.62rem', marginRight: '3px' }}>{netBalance >= 0 ? 'م' : 'د'}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInFromLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>
    </>
  )
}

// ════════════════════════════════════════
// تاب شجرة الحسابات — مع الأرصدة وكشف الحساب
// ════════════════════════════════════════
function ChartOfAccounts({ tenantId }: { tenantId: string }) {
  const [accounts,      setAccounts]      = useState<Account[]>([])
  const [balances,      setBalances]      = useState<Record<number, number>>({})
  const [loading,       setLoading]       = useState(true)
  const [showModal,     setShowModal]     = useState(false)
  const [editAccount,   setEditAccount]   = useState<Account | null>(null)
  const [parentForNew,  setParentForNew]  = useState<Account | null>(null)
  const [path,          setPath]          = useState<Account[]>([])
  const [search,        setSearch]        = useState('')
  const [ledgerAccount, setLedgerAccount] = useState<Account | null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [accRes, linesRes] = await Promise.all([
      supabase.from('finance_accounts').select('*').eq('tenant_id', tenantId).order('code'),
      // فلترة القيود بـ tenant_id عبر الانضمام لجدول القيود
      supabase
        .from('finance_journal_lines')
        .select('account_id, debit, credit, finance_journal_entries!inner(tenant_id)')
        .eq('finance_journal_entries.tenant_id', tenantId),
    ])
    const accs = accRes.data || []

    const raw: Record<number, { debit: number; credit: number }> = {}
    ;(linesRes.data || []).forEach((l: any) => {
      if (!raw[l.account_id]) raw[l.account_id] = { debit: 0, credit: 0 }
      raw[l.account_id].debit  += Number(l.debit  || 0)
      raw[l.account_id].credit += Number(l.credit || 0)
    })
    const bal: Record<number, number> = {}
    accs.forEach((a: Account) => {
      const r = raw[a.id] || { debit: 0, credit: 0 }
      bal[a.id] = r.debit - r.credit
    })
    function sumBalance(id: number): number {
      const children = accs.filter((a: Account) => a.parent_id === id)
      if (children.length === 0) return bal[id] || 0
      return children.reduce((s: number, c: Account) => s + sumBalance(c.id), 0)
    }
    accs.forEach((a: Account) => { bal[a.id] = sumBalance(a.id) })

    setAccounts(accs)
    setBalances(bal)
    setLoading(false)
  }

  const currentParentId = path.length > 0 ? path[path.length - 1].id : null
  const currentAccounts = accounts
    .filter(a => {
      if (search) return a.name.includes(search) || a.code.includes(search)
      return currentParentId ? a.parent_id === currentParentId : !a.parent_id
    })
    .sort((a, b) => a.code.localeCompare(b.code))

  function drillDown(account: Account) {
    const hasChildren = accounts.some(a => a.parent_id === account.id)
    if (search) {
      // في البحث — افتح كشف الحساب مباشرة
      setLedgerAccount(account)
      return
    }
    if (hasChildren) {
      setPath(p => [...p, account])
    } else {
      // حساب نهائي — افتح كشف الحساب
      setLedgerAccount(account)
    }
  }

  function goTo(idx: number) { setPath(p => p.slice(0, idx)) }

  async function handleDelete(account: Account) {
    const hasChildren = accounts.some(a => a.parent_id === account.id)
    if (hasChildren) { toast.error('لا يمكن حذف حساب له فروع'); return }
    // فحص وجود قيود محاسبية على الحساب
    const { count } = await supabase.from('finance_journal_lines')
      .select('*', { count: 'exact', head: true }).eq('account_id', account.id)
    if ((count || 0) > 0) {
      // يوجد قيود — عطّل بدل الحذف
      if (!confirm(`الحساب "${account.name}" عليه ${count} قيد محاسبي ولا يمكن حذفه.\nهل تريد تعطيله بدلاً من الحذف؟`)) return
      await supabase.from('finance_accounts').update({ is_active: false }).eq('id', account.id)
      await loadAll(); toast.success('تم تعطيل الحساب ✅')
      return
    }
    if (!confirm('حذف الحساب "' + account.name + '"؟')) return
    const parentId = account.parent_id
    await supabase.from('finance_accounts').delete().eq('id', account.id)
    // إذا الأب لم يعد له أبناء → is_parent = false
    if (parentId) {
      const { count } = await supabase.from('finance_accounts')
        .select('*', { count: 'exact', head: true }).eq('parent_id', parentId)
      if ((count || 0) === 0) {
        await supabase.from('finance_accounts').update({ is_parent: false }).eq('id', parentId)
      }
    }
    await loadAll(); toast.success('تم الحذف')
  }

  const TYPE_COLOR: Record<string, string> = {
    'أصول': '#1a56db', 'خصوم': '#c81e1e', 'حقوق ملكية': '#0ea77b',
    'إيرادات': '#0ea77b', 'تكلفة': '#e6820a', 'مصروفات': '#6b7280'
  }

  const stats = {
    total:   accounts.length,
    active:  accounts.filter(a => a.is_active).length,
    parents: accounts.filter(a => a.is_parent).length,
    leaves:  accounts.filter(a => !a.is_parent).length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* إحصائيات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        {[
          { label: 'إجمالي الحسابات', value: stats.total,   color: '#1a56db', bg: '#eff6ff' },
          { label: 'حسابات نشطة',     value: stats.active,  color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'حسابات تجميعية',  value: stats.parents, color: '#e6820a', bg: '#fffbeb' },
          { label: 'حسابات قيد',      value: stats.leaves,  color: '#6b7280', bg: '#f3f4f6' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 16px', background: s.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{s.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* شريط الأدوات */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          {!search && (
            <>
              <button onClick={() => setPath([])}
                style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: path.length === 0 ? 'var(--primary)' : 'white', color: path.length === 0 ? 'white' : 'var(--text3)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                🏠 الكل
              </button>
              {path.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text3)' }}>›</span>
                  <button onClick={() => goTo(i + 1)}
                    style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: i === path.length - 1 ? 'var(--primary)' : 'white', color: i === path.length - 1 ? 'white' : 'var(--text3)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                    {p.code} — {p.name}
                  </button>
                </div>
              ))}
            </>
          )}
          <div style={{ position: 'relative', marginRight: 'auto' }}>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPath([]) }}
              placeholder="🔍 بحث عن حساب..."
              className="input"
              style={{ paddingRight: '14px', width: '220px', fontSize: '0.82rem' }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '1rem' }}>
                ×
              </button>
            )}
          </div>
        </div>
        <button onClick={() => { setEditAccount(null); setParentForNew(path.length > 0 ? path[path.length - 1] : null); setShowModal(true) }} className="btn btn-primary">
          <Plus style={{ width: '16px', height: '16px' }} />
          إضافة حساب
        </button>
      </div>

      {/* تلميح */}
      <div style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>💡</span>
        <span>اضغط على أي حساب نهائي 📄 لعرض كشف حساب تفصيلي بكل العمليات</span>
      </div>

      {/* الجدول */}
      {loading ? <Spinner />
      : currentAccounts.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <BookOpen style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)' }}>{search ? 'لا توجد نتائج للبحث' : 'لا توجد حسابات في هذا المستوى'}</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الرمز', 'اسم الحساب', 'النوع', 'الرصيد', 'طبيعة الرصيد', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: h === 'الرصيد' ? 'left' : 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentAccounts.map(account => {
                  const hasChildren = accounts.some(a => a.parent_id === account.id)
                  const color  = TYPE_COLOR[account.account_type] || '#6b7280'
                  const bal    = balances[account.id] || 0
                  const isDebit = bal >= 0
                  const absbal = Math.abs(bal)

                  return (
                    <tr key={account.id}
                      style={{ borderBottom: '1px solid var(--bg2)', cursor: 'pointer' }}
                      onClick={() => drillDown(account)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                      {/* الرمز */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ width: '42px', height: '36px', borderRadius: '10px', background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.78rem', color }}>{account.code}</span>
                        </div>
                      </td>

                      {/* الاسم */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1rem' }}>{(hasChildren || account.is_parent) ? '📁' : '📄'}</span>
                          <div>
                            <div style={{ fontWeight: hasChildren ? 700 : 500, fontSize: '0.9rem', color: account.is_active ? 'var(--text)' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              {account.name}
                              {!account.is_active && <span style={{ fontSize: '0.65rem', color: '#c81e1e', background: '#fef2f2', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>معطّل</span>}
                              {!hasChildren && !account.is_parent && account.is_active && <span style={{ fontSize: '0.65rem', color: '#bfdbfe', background: '#eff6ff', padding: '1px 6px', borderRadius: '10px' }}>اضغط لكشف الحساب</span>}
                            </div>
                            {account.name_en && <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{account.name_en}</div>}
                          </div>
                        </div>
                      </td>

                      {/* النوع */}
                      <td style={{ padding: '14px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, background: color + '15', color }}>
                          {account.account_type}
                        </span>
                      </td>

                      {/* الرصيد */}
                      <td style={{ padding: '14px 14px', textAlign: 'left', direction: 'ltr' }}>
                        {absbal > 0 ? (
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isDebit ? '#1a56db' : '#c81e1e' }}>
                            {absbal.toLocaleString()} ر.س
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>—</span>
                        )}
                      </td>

                      {/* طبيعة الرصيد */}
                      <td style={{ padding: '14px 14px' }}>
                        {absbal > 0 && (
                          <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: isDebit ? '#eff6ff' : '#fef2f2', color: isDebit ? '#1a56db' : '#c81e1e' }}>
                            {isDebit ? 'مدين' : 'دائن'}
                          </span>
                        )}
                      </td>

                      {/* الإجراءات */}
                      <td style={{ padding: '14px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {(hasChildren || account.is_parent) && account.is_active && (
                            <button onClick={() => { setEditAccount(null); setParentForNew(account); setShowModal(true) }}
                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                              + فرعي
                            </button>
                          )}
                          <button onClick={() => { setEditAccount(account); setParentForNew(null); setShowModal(true) }} className="btn btn-ghost btn-xs">
                            <Pencil style={{ width: '12px', height: '12px' }} />
                          </button>

                          {!hasChildren && account.is_active && (
                            <button onClick={() => handleDelete(account)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                              <Trash2 style={{ width: '12px', height: '12px' }} />
                            </button>
                          )}
                          {!account.is_active && (
                            <button onClick={async () => {
                              await supabase.from('finance_accounts').update({ is_active: true }).eq('id', account.id)
                              await loadAll(); toast.success('تم تنشيط الحساب ✅')
                            }} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                              تنشيط
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <AccountModal
          account={editAccount} accounts={accounts} defaultParent={parentForNew}
          tenantId={tenantId}
          onClose={() => { setShowModal(false); setEditAccount(null); setParentForNew(null) }}
          onSave={() => { setShowModal(false); setEditAccount(null); setParentForNew(null); loadAll() }}
        />
      )}

      {/* Panel كشف الحساب */}
      {ledgerAccount && (
        <AccountLedgerPanel
          account={ledgerAccount}
          tenantId={tenantId}
          onClose={() => setLedgerAccount(null)}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════
// تاب القيود اليومية
// ════════════════════════════════════════
function JournalEntriesTab({ tenantId }: { tenantId: string }) {
  const [entries,     setEntries]     = useState<JournalEntry[]>([])
  const [accounts,    setAccounts]    = useState<Account[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [expandedId,  setExpandedId]  = useState<number | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ entry_date: today, description: '', status: 'معتمد' })
  const [lines, setLines] = useState<JournalLine[]>([
    { account_id: 0, cost_center_id: undefined, debit: 0, credit: 0, description: '' },
    { account_id: 0, cost_center_id: undefined, debit: 0, credit: 0, description: '' },
  ])
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [eRes, aRes, cRes] = await Promise.all([
      supabase.from('finance_journal_entries').select('*').eq('tenant_id', tenantId).order('entry_date', { ascending: false }).limit(100),
      supabase.from('finance_accounts').select('*').eq('tenant_id', tenantId).order('code'),
      supabase.from('finance_cost_centers').select('*').eq('tenant_id', tenantId).eq('is_active', true),
    ])
    setEntries(eRes.data || []); setAccounts(aRes.data || []); setCostCenters(cRes.data || [])
    setLoading(false)
  }

  async function loadEntryLines(entryId: number) {
    const { data } = await supabase.from('finance_journal_lines')
      .select('*, account:finance_accounts(code,name), cost_center:finance_cost_centers(name)')
      .eq('entry_id', entryId).order('id')
    return data || []
  }

  async function handleToggleExpand(entry: JournalEntry) {
    if (expandedId === entry.id) { setExpandedId(null); return }
    const linesData = await loadEntryLines(entry.id)
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, lines: linesData } : e))
    setExpandedId(entry.id)
  }

  function updateLine(idx: number, k: keyof JournalLine, v: any) {
    setLines(prev => { const n = [...prev]; n[idx] = { ...n[idx], [k]: v }; return n })
  }
  function addLine() { setLines(p => [...p, { account_id: 0, debit: 0, credit: 0, description: '' }]) }
  function removeLine(idx: number) { if (lines.length > 2) setLines(p => p.filter((_, i) => i !== idx)) }

  const totalDebit  = lines.reduce((s, l) => s + Number(l.debit  || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0)
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01

  const leafAccounts = accounts.filter(a => !a.is_parent)

  async function handleSave() {
    if (!form.description.trim()) { toast.error('البيان مطلوب'); return }
    const validLines = lines.filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
    if (validLines.length < 2) { toast.error('يجب إضافة سطرين على الأقل'); return }
    if (!isBalanced) { toast.error('القيد غير متوازن — مجموع المدين يجب أن يساوي مجموع الدائن'); return }

    const td = validLines.reduce((s, l) => s + Number(l.debit || 0), 0)
    const tc = validLines.reduce((s, l) => s + Number(l.credit || 0), 0)

    const { count } = await supabase.from('finance_journal_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const entryNumber = `JE-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

    const { data: entry, error } = await supabase.from('finance_journal_entries').insert({
      tenant_id: tenantId, entry_number: entryNumber, entry_date: form.entry_date,
      description: form.description, total_debit: td, total_credit: tc,
      status: form.status, entry_source: 'يدوي',
    }).select('id').single()

    if (error || !entry) { toast.error('خطأ: ' + (error?.message || 'فشل الحفظ')); return }

    await supabase.from('finance_journal_lines').insert(
      validLines.map(l => ({
        entry_id: entry.id, account_id: l.account_id,
        cost_center_id: l.cost_center_id || null,
        debit: Number(l.debit || 0), credit: Number(l.credit || 0),
        description: l.description || null,
      }))
    )

    toast.success('✅ تم تسجيل القيد اليدوي')
    setShowForm(false)
    setForm({ entry_date: today, description: '', status: 'معتمد' })
    setLines([
      { account_id: 0, debit: 0, credit: 0, description: '' },
      { account_id: 0, debit: 0, credit: 0, description: '' },
    ])
    loadData()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a2e' }}>القيود اليومية</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary" style={{ background: '#0ea77b' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> قيد يدوي
        </button>
      </div>

      {/* فورم القيد */}
      {showForm && (
        <div className="card" style={{ padding: '20px', border: '2px solid #bbf7d0' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '14px', color: '#0ea77b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ✏️ قيد يدوي جديد
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>التاريخ *</label>
              <input type="date" value={form.entry_date} onChange={e => setF('entry_date', e.target.value)} className="input" />
            </div>
            <div style={{ gridColumn: '2 / -1' }}>
              <label style={labelStyle}>البيان *</label>
              <input value={form.description} onChange={e => setF('description', e.target.value)} className="input" placeholder="وصف القيد المحاسبي" />
            </div>
          </div>

          {/* السطور */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  {['الحساب', 'مركز التكلفة', 'البيان', 'مدين', 'دائن', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px', minWidth: '200px' }}>
                      <select value={line.account_id || ''} onChange={e => updateLine(idx, 'account_id', Number(e.target.value))}
                        style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}>
                        <option value="">— اختر الحساب —</option>
                        {leafAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px', minWidth: '140px' }}>
                      <select value={line.cost_center_id || ''} onChange={e => updateLine(idx, 'cost_center_id', e.target.value ? Number(e.target.value) : undefined)}
                        style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}>
                        <option value="">— اختياري —</option>
                        {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px', minWidth: '140px' }}>
                      <input value={line.description || ''} onChange={e => updateLine(idx, 'description', e.target.value)}
                        style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }} placeholder="بيان..." />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input type="number" min="0" value={line.debit || ''} onChange={e => updateLine(idx, 'debit', e.target.value)}
                        style={{ width: '100px', padding: '5px 8px', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr', background: Number(line.debit) > 0 ? '#eff6ff' : 'white' }} placeholder="0" />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input type="number" min="0" value={line.credit || ''} onChange={e => updateLine(idx, 'credit', e.target.value)}
                        style={{ width: '100px', padding: '5px 8px', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr', background: Number(line.credit) > 0 ? '#fef2f2' : 'white' }} placeholder="0" />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <button type="button" onClick={() => removeLine(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}>
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* التوازن */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <button type="button" onClick={addLine}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: '0.8rem' }}>
              <Plus style={{ width: '13px', height: '13px' }} /> سطر جديد
            </button>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
              <span>مدين: <strong style={{ color: '#1a56db' }}>{totalDebit.toLocaleString()}</strong></span>
              <span>دائن: <strong style={{ color: '#c81e1e' }}>{totalCredit.toLocaleString()}</strong></span>
              <span style={{ color: isBalanced ? '#0ea77b' : '#c81e1e', fontWeight: 700 }}>
                {isBalanced ? '✅ متوازن' : '⚠️ غير متوازن'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} className="btn btn-ghost">إلغاء</button>
            <button onClick={handleSave} disabled={!isBalanced} className="btn btn-primary" style={{ background: '#0ea77b' }}>
              <Save style={{ width: '15px', height: '15px' }} /> تسجيل القيد
            </button>
          </div>
        </div>
      )}

      {/* قائمة القيود */}
      {loading ? <Spinner /> : entries.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد قيود</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['', 'رقم القيد', 'التاريخ', 'البيان', 'نوع المرجع', 'المصدر', 'مدين', 'دائن', 'الحالة'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <>
                    <tr key={entry.id}
                      style={{ borderBottom: '1px solid var(--bg2)', cursor: 'pointer' }}
                      onClick={() => handleToggleExpand(entry)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 10px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{expandedId === entry.id ? '▼' : '▶'}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0ea77b' }}>{entry.entry_number}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{entry.entry_date}</td>
                      <td style={{ padding: '10px 14px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description}</td>
                      <td style={{ padding: '10px 14px', fontSize: '0.78rem' }}>
                        {entry.reference_type && entry.reference_id ? (
                          <Link href={
                            entry.reference_type === 'فاتورة' ? `/finance/invoices/${entry.reference_id}` :
                            entry.reference_type === 'قبض' || entry.reference_type === 'صرف' ? `/finance/treasury` :
                            entry.reference_type === 'مصروف' ? `/finance/expenses` :
                            entry.reference_type === 'عهدة' ? `/finance/treasury` : '#'
                          }
                            style={{ color: '#1a56db', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none', fontSize: '0.78rem' }}>
                            {entry.reference_type} <ExternalLink style={{ width: '11px', height: '11px' }} />
                          </Link>
                        ) : <span style={{ color: 'var(--text3)' }}>{entry.reference_type || '—'}</span>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 600,
                          background: (entry as any).entry_source === 'يدوي' ? '#eff6ff' : '#f0fdf4',
                          color:      (entry as any).entry_source === 'يدوي' ? '#1a56db' : '#0ea77b',
                          border: `1px solid ${(entry as any).entry_source === 'يدوي' ? '#bfdbfe' : '#bbf7d0'}`,
                        }}>
                          {(entry as any).entry_source === 'يدوي' ? '✏️ يدوي' : '⚙️ آلي'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#1a56db', fontWeight: 600, direction: 'ltr', textAlign: 'left' }}>{Number(entry.total_debit).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', color: '#c81e1e', fontWeight: 600, direction: 'ltr', textAlign: 'left' }}>{Number(entry.total_credit).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={'badge ' + (entry.status === 'معتمد' ? 'badge-green' : 'badge-gray')}>{entry.status}</span>
                      </td>
                    </tr>
                    {expandedId === entry.id && entry.lines && (
                      <tr key={`lines-${entry.id}`}>
                        <td colSpan={9} style={{ padding: 0, background: '#f8fafc' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                              <tr style={{ background: '#e5e7eb' }}>
                                {['الحساب', 'البيان', 'مدين', 'دائن'].map(h => (
                                  <th key={h} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: '0.72rem' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {entry.lines.map((line: any, i: number) => (
                                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                  <td style={{ padding: '7px 14px', color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                    {line.account?.code} — {line.account?.name}
                                  </td>
                                  <td style={{ padding: '7px 14px', color: 'var(--text3)', fontSize: '0.78rem' }}>{line.description || '—'}</td>
                                  <td style={{ padding: '7px 14px', textAlign: 'left', direction: 'ltr', color: Number(line.debit) > 0 ? '#1a56db' : 'var(--text3)', fontWeight: Number(line.debit) > 0 ? 700 : 400 }}>
                                    {Number(line.debit) > 0 ? Number(line.debit).toLocaleString() : '—'}
                                  </td>
                                  <td style={{ padding: '7px 14px', textAlign: 'left', direction: 'ltr', color: Number(line.credit) > 0 ? '#c81e1e' : 'var(--text3)', fontWeight: Number(line.credit) > 0 ? 700 : 400 }}>
                                    {Number(line.credit) > 0 ? Number(line.credit).toLocaleString() : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════
// تاب مراكز التكلفة
// ════════════════════════════════════════
function CostCentersTab({ tenantId }: { tenantId: string }) {
  const [centers,  setCenters]  = useState<CostCenter[]>([])
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState<number | null>(null)
  const [form, setForm] = useState({ code: '', name: '', type: 'مشروع', project_id: '', is_active: true, notes: '' })
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [cRes, pRes] = await Promise.all([
      supabase.from('finance_cost_centers').select('*, project:projects(name)').eq('tenant_id', tenantId).order('code'),
      supabase.from('projects').select('id, name').eq('tenant_id', tenantId).order('name'),
    ])
    setCenters(cRes.data || []); setProjects(pRes.data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) { toast.error('الرمز والاسم مطلوبان'); return }
    const payload = {
      tenant_id: tenantId, code: form.code.trim(), name: form.name.trim(),
      type: form.type, project_id: form.project_id ? Number(form.project_id) : null,
      is_active: form.is_active, notes: form.notes || null,
    }
    if (editId) {
      await supabase.from('finance_cost_centers').update(payload).eq('id', editId)
      toast.success('تم التعديل ✅')
    } else {
      await supabase.from('finance_cost_centers').insert(payload)
      toast.success('✅ تمت الإضافة')
    }
    setShowForm(false); setEditId(null)
    setForm({ code: '', name: '', type: 'مشروع', project_id: '', is_active: true, notes: '' })
    loadData()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Target style={{ width: '18px', height: '18px', color: '#e6820a' }} /> مراكز التكلفة
        </h2>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ code: '', name: '', type: 'مشروع', project_id: '', is_active: true, notes: '' }) }} className="btn btn-primary" style={{ background: '#e6820a' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> مركز تكلفة
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: '16px', border: '2px solid #fde68a' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>الرمز *</label>
              <input value={form.code} onChange={e => setF('code', e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={labelStyle}>الاسم *</label>
              <input value={form.name} onChange={e => setF('name', e.target.value)} className="input" />
            </div>
            <div>
              <label style={labelStyle}>النوع</label>
              <select value={form.type} onChange={e => setF('type', e.target.value)} className="select">
                {['مشروع', 'قسم', 'منطقة', 'عام'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>ربط بمشروع</label>
              <select value={form.project_id} onChange={e => setF('project_id', e.target.value)} className="select">
                <option value="">— بدون ربط —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>ملاحظات</label>
              <input value={form.notes} onChange={e => setF('notes', e.target.value)} className="input" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="btn btn-ghost">إلغاء</button>
            <button onClick={handleSave} className="btn btn-primary" style={{ background: '#e6820a' }}>
              <Save style={{ width: '15px', height: '15px' }} /> {editId ? 'حفظ التعديل' : 'إضافة'}
            </button>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : centers.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>لا توجد مراكز تكلفة</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['الرمز', 'الاسم', 'النوع', 'المشروع', 'الحالة', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {centers.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#e6820a' }}>{c.code}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '12px 14px' }}><span className="badge badge-amber">{c.type}</span></td>
                  <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text3)' }}>{c.project?.name || '—'}</td>
                  <td style={{ padding: '12px 14px' }}><span className={'badge ' + (c.is_active ? 'badge-green' : 'badge-gray')}>{c.is_active ? 'نشط' : 'موقوف'}</span></td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => { setForm({ code: c.code, name: c.name, type: c.type, project_id: c.project_id ? String(c.project_id) : '', is_active: c.is_active, notes: c.notes || '' }); setEditId(c.id); setShowForm(true) }} className="btn btn-ghost btn-xs">
                      <Pencil style={{ width: '13px', height: '13px' }} /> تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════
// دليل المعايير
// ════════════════════════════════════════
function StandardsGuide() {
  const cats = [
    {
      code: '1', title: 'الأصول', color: '#1a56db', bg: '#eff6ff',
      desc: 'جميع الموارد التي تمتلكها الشركة والتي تُتوقع منها منافع اقتصادية مستقبلية',
      items: [
        { code: '11', name: 'الأصول المتداولة',    desc: 'النقدية، العملاء، المخزون، المدفوعات المقدمة' },
        { code: '12', name: 'الأصول الثابتة',      desc: 'المباني، الآليات، المعدات، الأثاث' },
        { code: '13', name: 'الأصول غير الملموسة', desc: 'البرامج، براءات الاختراع، العلامات التجارية' },
      ]
    },
    {
      code: '2', title: 'الخصوم', color: '#c81e1e', bg: '#fef2f2',
      desc: 'الالتزامات المالية المستحقة على الشركة تجاه الغير',
      items: [
        { code: '21', name: 'الخصوم المتداولة',   desc: 'الموردون، المصاريف المستحقة، الديون قصيرة الأجل' },
        { code: '22', name: 'الخصوم طويلة الأجل', desc: 'القروض البنكية، الديون طويلة الأجل' },
      ]
    },
    {
      code: '3', title: 'حقوق الملكية', color: '#0ea77b', bg: '#ecfdf5',
      desc: 'حقوق المساهمين وصافي أصول الشركة بعد خصم الالتزامات',
      items: [
        { code: '31', name: 'رأس المال',          desc: 'رأس المال المدفوع، الاحتياطيات' },
        { code: '32', name: 'الأرباح المحتجزة',   desc: 'الأرباح المتراكمة من السنوات السابقة' },
      ]
    },
    {
      code: '4', title: 'الإيرادات', color: '#0ea77b', bg: '#ecfdf5',
      desc: 'الدخل المتحقق من الأنشطة التشغيلية وغير التشغيلية',
      items: [
        { code: '41', name: 'إيرادات المبيعات', desc: 'مبيعات الخدمات والمنتجات' },
        { code: '42', name: 'إيرادات أخرى',    desc: 'إيرادات الفوائد، الإيجار، العمولات' },
      ]
    },
    {
      code: '5', title: 'المصروفات', color: '#6b7280', bg: '#f3f4f6',
      desc: 'التكاليف المتكبدة لتحقيق الإيرادات',
      items: [
        { code: '51', name: 'تكلفة المبيعات',        desc: 'المواد المباشرة، العمالة المباشرة' },
        { code: '55', name: 'مصروفات البيع والتسويق', desc: 'الإعلان، العمولات، التوزيع' },
        { code: '56', name: 'مصروفات إدارية',         desc: 'الرواتب الإدارية، الإيجار، المصاريف العمومية' },
      ]
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BookOpen style={{ width: '20px', height: '20px', color: '#7c3aed' }} />
        <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a2e' }}>دليل معايير شجرة الحسابات</h2>
        <span className="badge badge-gray" style={{ background: '#f3e8ff', color: '#7c3aed' }}>IFRS / IAS</span>
      </div>
      {cats.map(cat => (
        <div key={cat.code} className="card" style={{ padding: '16px', border: `1px solid ${cat.color}30` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
              {cat.code}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: cat.color }}>{cat.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{cat.desc}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {cat.items.map(item => (
              <div key={item.code} style={{ background: cat.bg, borderRadius: '8px', padding: '8px 14px', border: `1px solid ${cat.color}20` }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: cat.color, fontSize: '0.82rem' }}>{cat.code}{item.code}</div>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', marginTop: '2px' }}>{item.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function FinanceAccountingPage() {
  const { tenant } = useStore()
  const [activeTab, setActiveTab] = useState<'chart' | 'journal' | 'costcenters' | 'standards'>('chart')

  const TABS = [
    { id: 'chart',       label: '📊 شجرة الحسابات',  color: '#1a56db' },
    { id: 'journal',     label: '📒 القيود اليومية',  color: '#0ea77b' },
    { id: 'costcenters', label: '🎯 مراكز التكلفة',   color: '#e6820a' },
    { id: 'standards',   label: '📋 دليل المعايير',   color: '#7c3aed' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Layers style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
          الحسابات العامة
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '4px' }}>
          شجرة الحسابات — القيود اليومية — مراكز التكلفة
        </p>
      </div>

      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '6px', borderRadius: '14px', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === t.id ? t.color : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: activeTab === t.id ? '0 2px 8px ' + t.color + '44' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tenant && (
        <>
          {activeTab === 'chart'       && <ChartOfAccounts tenantId={tenant.id} />}
          {activeTab === 'journal'     && <JournalEntriesTab tenantId={tenant.id} />}
          {activeTab === 'costcenters' && <CostCentersTab tenantId={tenant.id} />}
          {activeTab === 'standards'   && <StandardsGuide />}
        </>
      )}
    </div>
  )
}
