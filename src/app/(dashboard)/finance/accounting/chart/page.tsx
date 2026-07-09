// src/app/(dashboard)/finance/accounting/chart/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Trash2, ChevronDown, ChevronLeft, BookOpen, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { createJournalEntry } from '@/lib/journal'
import { suggestChildAccountCode, suggestRootAccountCode } from '@/lib/suggest-account-code'
import type { Account, AccountLedgerLine } from '@/lib/accounting-types'
import { ACCOUNT_TYPE_COLOR } from '@/lib/accounting-types'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }
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

  const [selectedType, setSelectedType] = useState(
    parentAcc?.account_type || account?.account_type || 'أصول'
  )

  // حساب الكود المقترح تلقائياً
  function suggestCode(parentId: string): string {
    if (!parentId) return ''
    const par = accounts.find(a => a.id === Number(parentId))
    if (!par) return ''
    const siblingCodes = accounts
      .filter(a => a.parent_id === Number(parentId))
      .filter(a => !account || a.id !== account.id)
      .map(a => a.code)
    return suggestChildAccountCode(par.code, siblingCodes, {
      excludeCode: account?.code,
      allCodes: accounts.map(a => a.code),
    })
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
        const rootCodes = accounts.filter(a => !a.parent_id).map(a => a.code)
        finalCode = suggestRootAccountCode(selectedType, rootCodes)
      }
    } else if (!account && accounts.some(a => a.code === finalCode)) {
      toast.error(`الكود ${finalCode} مستخدم مسبقاً`); setSaving(false); return
    }

    const par = accounts.find(a => a.id === Number(form.parent_id))
    const accountType = par?.account_type || selectedType
    const accountClass = par?.account_class || (
      ['أصول','خصوم','حقوق ملكية'].includes(accountType) ? 'ميزانية' : 'دخل'
    )
    const normalBalance = par?.normal_balance || (
      ['أصول','تكلفة','مصروفات'].includes(accountType) ? 'مدين' : 'دائن'
    )
    const payload = {
      tenant_id:      tenantId,
      code:           finalCode,
      name:           form.name.trim(),
      name_en:        form.name_en || null,
      account_type:   accountType,
      account_class:  accountClass,
      normal_balance: normalBalance,
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
                      onClick={() => { setSelectedType(t); set('code', '') }}
                      style={{ padding: '6px 14px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                        borderColor: selectedType === t ? tColor : 'var(--border)',
                        background:  selectedType === t ? tColor + '15' : 'white',
                        color:       selectedType === t ? tColor : 'var(--text3)',
                        opacity: selectedType === t ? 1 : 0.5,
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
  // ══ عرض القيد كاملاً في نافذة منفصلة (بدل التنقل لصفحة المصدر) ══
  const [viewEntry, setViewEntry] = useState<{ header: any; lines: any[]; loading: boolean } | null>(null)

  async function openEntry(entryId: number, header: AccountLedgerLine) {
    setViewEntry({ header, lines: [], loading: true })
    const { data } = await supabase
      .from('finance_journal_lines')
      .select('debit, credit, description, account:finance_accounts(code, name)')
      .eq('entry_id', entryId)
      .order('debit', { ascending: false })
    setViewEntry({ header, lines: data || [], loading: false })
  }

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
          entry_id:        entry.id,
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
                      {line.reference_type && (
                        <button type="button" onClick={() => openEntry(line.entry_id, line)}
                          style={{ fontSize: '0.68rem', color: '#1a56db', marginTop: '1px', display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          title="عرض القيد كاملاً">
                          {line.reference_type} <ExternalLink style={{ width: '10px', height: '10px' }} />
                        </button>
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

      {/* ══ مودال عرض القيد كاملاً ══ */}
      {viewEntry && (
        <div onClick={e => e.target === e.currentTarget && setViewEntry(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: 'min(640px, 94vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>📒 قيد {viewEntry.header.entry_number}</h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>
                  {viewEntry.header.entry_date} · {viewEntry.header.reference_type || '—'} · {viewEntry.header.entry_source === 'يدوي' ? '✏️ يدوي' : '⚙️ آلي'}
                </p>
              </div>
              <button onClick={() => setViewEntry(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
            <div style={{ overflowY: 'auto' }}>
              {viewEntry.loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem' }}>جاري التحميل...</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                      {['الحساب', 'البيان', 'مدين', 'دائن'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewEntry.lines.map((l: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg2)' }}>
                        <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: 'monospace', color: '#1a56db', fontWeight: 600, marginLeft: '6px' }}>{l.account?.code}</span>
                          {l.account?.name}
                        </td>
                        <td style={{ padding: '8px 14px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text3)' }}>{l.description || '—'}</td>
                        <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#1a56db', fontWeight: 600, direction: 'ltr', textAlign: 'left' }}>{Number(l.debit) > 0 ? Number(l.debit).toLocaleString() : '—'}</td>
                        <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#c81e1e', fontWeight: 600, direction: 'ltr', textAlign: 'left' }}>{Number(l.credit) > 0 ? Number(l.credit).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <td colSpan={2} style={{ padding: '8px 14px' }}>الإجمالي</td>
                      <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#1a56db', direction: 'ltr', textAlign: 'left' }}>{viewEntry.lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0).toLocaleString()}</td>
                      <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#c81e1e', direction: 'ltr', textAlign: 'left' }}>{viewEntry.lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ════════════════════════════════════════
// شجرة الحسابات — مع الأرصدة وكشف الحساب
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
// الصفحة
// ════════════════════════════════════════
export default function ChartOfAccountsPage() {
  const { tenant } = useStore()
  if (!tenant) return <Spinner />
  return <ChartOfAccounts tenantId={tenant.id} />
}
