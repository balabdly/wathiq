// src/app/(dashboard)/finance/accounting/journal/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, Save, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import type { Account, CostCenter, JournalEntry, JournalLine } from '@/lib/accounting-types'

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }
const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
    <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  </div>
)

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
                        onKeyDown={e => {
                          if (e.key === 'Tab' && !e.shiftKey && !Number(line.debit) && !Number(line.credit)) {
                            const diff = Math.round((totalCredit - totalDebit) * 100) / 100
                            if (diff > 0) updateLine(idx, 'debit', String(diff))
                          }
                        }}
                        style={{ width: '100px', padding: '5px 8px', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr', background: Number(line.debit) > 0 ? '#eff6ff' : 'white' }}
                        placeholder={!Number(line.debit) && !Number(line.credit) && Math.round((totalCredit - totalDebit) * 100) / 100 > 0 ? `Tab ⇥ ${(Math.round((totalCredit - totalDebit) * 100) / 100).toLocaleString()}` : '0'} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input type="number" min="0" value={line.credit || ''} onChange={e => updateLine(idx, 'credit', e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Tab' && !e.shiftKey && !Number(line.credit) && !Number(line.debit)) {
                            const diff = Math.round((totalDebit - totalCredit) * 100) / 100
                            if (diff > 0) updateLine(idx, 'credit', String(diff))
                          }
                        }}
                        style={{ width: '100px', padding: '5px 8px', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr', background: Number(line.credit) > 0 ? '#fef2f2' : 'white' }}
                        placeholder={!Number(line.credit) && !Number(line.debit) && Math.round((totalDebit - totalCredit) * 100) / 100 > 0 ? `Tab ⇥ ${(Math.round((totalDebit - totalCredit) * 100) / 100).toLocaleString()}` : '0'} />
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
// الصفحة
// ════════════════════════════════════════
export default function JournalEntriesPage() {
  const { tenant } = useStore()
  if (!tenant) return <Spinner />
  return <JournalEntriesTab tenantId={tenant.id} />
}
