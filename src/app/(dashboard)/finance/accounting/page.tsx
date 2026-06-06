'use client'
import AccountsTree from "@/components/accounting/AccountsTree";
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Trash2, ChevronDown, ChevronLeft, Search, BookOpen, Layers, Target } from 'lucide-react'
import toast from 'react-hot-toast'

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

const ACCOUNT_TYPE_COLOR: Record<string, string> = {
  'أصول': '#1a56db', 'خصوم': '#c81e1e', 'حقوق ملكية': '#0ea77b',
  'إيرادات': '#0ea77b', 'تكلفة': '#e6820a', 'مصروفات': '#6b7280'
}

// ════════════════════════════════════════
// بناء الشجرة من قائمة مسطحة
// ════════════════════════════════════════
function buildTree(accounts: Account[]): Account[] {
  const map = new Map<number, Account>()
  accounts.forEach(a => map.set(a.id, { ...a, children: [] }))
  const roots: Account[] = []
  map.forEach(a => {
    if (a.parent_id && map.has(a.parent_id)) {
      map.get(a.parent_id)!.children!.push(a)
    } else {
      roots.push(a)
    }
  })
  // ترتيب حسب الكود
  const sort = (arr: Account[]) => {
    arr.sort((a, b) => a.code.localeCompare(b.code))
    arr.forEach(a => a.children && sort(a.children))
  }
  sort(roots)
  return roots
}

// ════════════════════════════════════════
// مودال: إضافة / تعديل حساب
// ════════════════════════════════════════
function AccountModal({ account, accounts, defaultParent, tenantId, onClose, onSave }: {
  account: Account | null; accounts: Account[]; defaultParent?: Account | null
  tenantId: string; onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code:           account?.code           || '',
    name:           account?.name           || '',
    name_en:        account?.name_en        || '',
    account_type:   account?.account_type   || 'مصروفات',
    account_class:  account?.account_class  || 'دخل',
    parent_id:      account?.parent_id ? String(account.parent_id) : defaultParent?.id ? String(defaultParent.id) : '',
    is_parent:      account?.is_parent      ?? false,
    normal_balance: account?.normal_balance || 'مدين',
    is_active:      account?.is_active      ?? true,
    notes:          account?.notes          || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // تحديد normal_balance تلقائياً حسب نوع الحساب
  function handleTypeChange(type: string) {
    const balance = ['أصول', 'تكلفة', 'مصروفات'].includes(type) ? 'مدين' : 'دائن'
    const cls = ['أصول', 'خصوم', 'حقوق ملكية'].includes(type) ? 'ميزانية' : 'دخل'
    setForm(f => ({ ...f, account_type: type, normal_balance: balance, account_class: cls }))
  }

  async function handleSave() {
    if (!form.code.trim()) { toast.error('رمز الحساب مطلوب'); return }
    if (!form.name.trim()) { toast.error('اسم الحساب مطلوب'); return }
    setSaving(true)
    const payload = {
      tenant_id:      tenantId,
      code:           form.code.trim(),
      name:           form.name.trim(),
      name_en:        form.name_en || null,
      account_type:   form.account_type,
      account_class:  form.account_class,
      parent_id:      form.parent_id ? Number(form.parent_id) : null,
      level:          form.parent_id ? (accounts.find(a => a.id === Number(form.parent_id))?.level || 1) + 1 : 1,
      is_parent:      form.is_parent,
      normal_balance: form.normal_balance,
      is_active:      form.is_active,
      notes:          form.notes || null,
    }
    if (account) {
      const { error } = await supabase.from('finance_accounts').update(payload).eq('id', account.id)
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('finance_accounts').insert(payload)
      if (error) { toast.error('خطأ: ' + error.message); setSaving(false); return }
    }
    toast.success(account ? 'تم التعديل ✅' : '✅ تمت إضافة الحساب')
    onSave(); setSaving(false)
  }

  const parentAccounts = accounts.filter(a => a.is_parent || a.level < 4)

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
            {account ? 'تعديل الحساب' : 'إضافة حساب جديد'}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">رمز الحساب *</label>
              <input value={form.code} onChange={e => set('code', e.target.value)} className="input" dir="ltr" placeholder="مثال: 6310" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الحساب (عربي) *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الحساب (إنجليزي)</label>
            <input value={form.name_en} onChange={e => set('name_en', e.target.value)} className="input" dir="ltr" />
          </div>

          {/* نوع الحساب */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الحساب *</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['أصول', 'خصوم', 'حقوق ملكية', 'إيرادات', 'تكلفة', 'مصروفات'].map(t => (
                <button key={t} type="button" onClick={() => handleTypeChange(t)}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                    borderColor: form.account_type === t ? ACCOUNT_TYPE_COLOR[t] : 'var(--border)',
                    background: form.account_type === t ? ACCOUNT_TYPE_COLOR[t] + '15' : 'white',
                    color: form.account_type === t ? ACCOUNT_TYPE_COLOR[t] : 'var(--text3)' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* الحساب الأب */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الحساب الأب</label>
            <select value={form.parent_id} onChange={e => set('parent_id', e.target.value)} className="select">
              <option value="">— حساب رئيسي (بدون أب) —</option>
              {parentAccounts.map(a => (
                <option key={a.id} value={a.id}>
                  {'—'.repeat(a.level - 1)} {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الرصيد الطبيعي</label>
              <select value={form.normal_balance} onChange={e => set('normal_balance', e.target.value)} className="select">
                <option value="مدين">مدين (Dr)</option>
                <option value="دائن">دائن (Cr)</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '28px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={form.is_parent} onChange={e => set('is_parent', e.target.checked)} />
                حساب تجميعي (لا يُقيَّد عليه)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                حساب نشط
              </label>
            </div>
          </div>
export default function AccountingPage() {
  return (
    <div className="p-6">
      <AccountsTree />
    </div>
  );
}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input" style={{ minHeight: '60px', resize: 'none' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save style={{ width: '15px', height: '15px' }} />}
            {account ? 'حفظ التعديل' : 'إضافة الحساب'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// تاب شجرة الحسابات — Drill-Down
// ════════════════════════════════════════
function ChartOfAccounts({ tenantId }: { tenantId: string }) {
  const [accounts, setAccounts]   = useState<Account[]>([])
  const [loading,  setLoading]    = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editAccount, setEditAccount]   = useState<Account | null>(null)
  const [parentForNew, setParentForNew] = useState<Account | null>(null)

  // مسار التنقل (breadcrumb)
  const [path, setPath] = useState<Account[]>([])

  useEffect(() => { loadAccounts() }, [])

  async function loadAccounts() {
    setLoading(true)
    const { data } = await supabase.from('finance_accounts').select('*').eq('tenant_id', tenantId).order('code')
    setAccounts(data || [])
    setLoading(false)
  }

  // الحسابات الظاهرة حالياً (أبناء الحساب المحدد أو الجذور)
  const currentParentId = path.length > 0 ? path[path.length - 1].id : null
  const currentAccounts = accounts
    .filter(a => currentParentId ? a.parent_id === currentParentId : !a.parent_id)
    .sort((a, b) => a.code.localeCompare(b.code))

  function drillDown(account: Account) {
    const hasChildren = accounts.some(a => a.parent_id === account.id)
    if (hasChildren) setPath(p => [...p, account])
  }

  function goTo(idx: number) {
    setPath(p => p.slice(0, idx))
  }

  async function handleDelete(account: Account) {
    const hasChildren = accounts.some(a => a.parent_id === account.id)
    if (hasChildren) { toast.error('لا يمكن حذف حساب له فروع'); return }
    if (!confirm('حذف الحساب "' + account.name + '"؟')) return
    await supabase.from('finance_accounts').delete().eq('id', account.id)
    await loadAccounts(); toast.success('تم الحذف')
  }

  // إحصائيات
  const stats = {
    total:   accounts.length,
    active:  accounts.filter(a => a.is_active).length,
    parents: accounts.filter(a => a.is_parent).length,
    leaves:  accounts.filter(a => !a.is_parent).length,
  }

  const MAIN_COLORS: Record<string, string> = {
    'أصول': '#1a56db', 'خصوم': '#c81e1e', 'حقوق ملكية': '#0ea77b',
    'إيرادات': '#0ea77b', 'مصروفات': '#e6820a'
  }

  return (
    <div className="space-y-4">

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
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={() => setPath([])}
            style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: path.length === 0 ? 'var(--primary)' : 'white', color: path.length === 0 ? 'white' : 'var(--text3)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            🏠 الحسابات الرئيسية
          </button>
          {path.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>›</span>
              <button onClick={() => goTo(i + 1)}
                style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: i === path.length - 1 ? 'var(--primary)' : 'white', color: i === path.length - 1 ? 'white' : 'var(--text3)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                {p.code} — {p.name}
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => { setEditAccount(null); setParentForNew(path.length > 0 ? path[path.length - 1] : null); setShowModal(true) }} className="btn btn-primary">
          <Plus style={{ width: '16px', height: '16px' }} />
          {path.length > 0 ? 'إضافة حساب فرعي' : 'إضافة حساب'}
        </button>
      </div>

      {/* الشجرة */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
      ) : currentAccounts.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <BookOpen style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد حسابات في هذا المستوى</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الرمز', 'اسم الحساب', 'النوع', 'الرصيد الطبيعي', 'التصنيف', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentAccounts.map(account => {
                  const hasChildren = accounts.some(a => a.parent_id === account.id)
                  const color = MAIN_COLORS[account.account_type] || '#6b7280'
                  return (
                    <tr key={account.id}
                      style={{ borderBottom: '1px solid var(--bg2)', cursor: hasChildren ? 'pointer' : 'default' }}
                      onClick={() => hasChildren && drillDown(account)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                      {/* الرمز */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* أيقونة المستوى */}
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.82rem', color }}>{account.code}</span>
                          </div>
                        </div>
                      </td>

                      {/* الاسم */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: account.is_active ? 'var(--text)' : 'var(--text3)' }}>
                              {account.name}
                              {account.is_parent && <span style={{ fontSize: '0.68rem', marginRight: '6px', color: '#94a3b8', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>تجميعي</span>}
                              {!account.is_active && <span style={{ fontSize: '0.68rem', marginRight: '6px', color: '#c81e1e', background: '#fef2f2', padding: '1px 5px', borderRadius: '4px' }}>موقوف</span>}
                            </div>
                            {account.name_en && <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{account.name_en}</div>}
                          </div>
                          {hasChildren && (
                            <span style={{ marginRight: 'auto', color: 'var(--text3)', fontSize: '0.75rem', background: 'var(--bg2)', padding: '2px 8px', borderRadius: '6px' }}>
                              {accounts.filter(a => a.parent_id === account.id).length} حساب ›
                            </span>
                          )}
                        </div>
                      </td>

                      {/* النوع */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: color + '15', color }}>
                          {account.account_type}
                        </span>
                      </td>

                      {/* الرصيد الطبيعي */}
                      <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: account.normal_balance === 'مدين' ? '#1a56db' : '#c81e1e', fontWeight: 600 }}>
                        {account.normal_balance === 'مدين' ? 'مدين (Dr)' : 'دائن (Cr)'}
                      </td>

                      {/* التصنيف */}
                      <td style={{ padding: '14px 16px', fontSize: '0.78rem', color: 'var(--text3)' }}>
                        {account.account_class}
                      </td>

                      {/* الإجراءات */}
                      <td style={{ padding: '14px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {hasChildren && (
                            <button onClick={() => { setEditAccount(null); setParentForNew(account); setShowModal(true) }}
                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#0ea77b', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                              + فرعي
                            </button>
                          )}
                          <button onClick={() => { setEditAccount(account); setParentForNew(null); setShowModal(true) }} className="btn btn-ghost btn-xs">
                            <Pencil style={{ width: '12px', height: '12px' }} />
                          </button>
                          {!hasChildren && (
                            <button onClick={() => handleDelete(account)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                              <Trash2 style={{ width: '12px', height: '12px' }} />
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
          account={editAccount}
          accounts={accounts}
          defaultParent={parentForNew}
          tenantId={tenantId}
          onClose={() => { setShowModal(false); setEditAccount(null); setParentForNew(null) }}
          onSave={() => { setShowModal(false); setEditAccount(null); setParentForNew(null); loadAccounts() }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════
// تاب مراكز التكلفة
// ════════════════════════════════════════
function CostCentersTab({ tenantId }: { tenantId: string }) {
  const [centers, setCenters]   = useState<CostCenter[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<number | null>(null)
  const [form, setForm] = useState({ code: '', name: '', type: 'مشروع', project_id: '', is_active: true, notes: '' })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

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
    if (!form.code.trim()) { toast.error('رمز مركز التكلفة مطلوب'); return }
    if (!form.name.trim()) { toast.error('اسم مركز التكلفة مطلوب'); return }
    const payload = { tenant_id: tenantId, code: form.code.trim(), name: form.name.trim(), type: form.type, project_id: form.project_id ? Number(form.project_id) : null, is_active: form.is_active, notes: form.notes || null }
    if (editId) { await supabase.from('finance_cost_centers').update(payload).eq('id', editId) }
    else { await supabase.from('finance_cost_centers').insert(payload) }
    await loadData(); setShowForm(false); setEditId(null)
    setForm({ code: '', name: '', type: 'مشروع', project_id: '', is_active: true, notes: '' })
    toast.success('تم الحفظ ✅')
  }

  return (
    <div className="space-y-4">
      {!showForm && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> إضافة مركز تكلفة
          </button>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            {editId ? 'تعديل مركز التكلفة' : 'إضافة مركز تكلفة جديد'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الرمز *</label>
              <input value={form.code} onChange={e => set('code', e.target.value)} className="input" dir="ltr" placeholder="مثال: CC-001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: مشروع أرامكو" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">النوع</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="select">
                {['مشروع', 'قسم إداري', 'فرع', 'نشاط'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ربط بمشروع</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
                <option value="">— بدون ربط —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="btn btn-ghost">إلغاء</button>
            <button onClick={handleSave} className="btn btn-primary"><Save style={{ width: '15px', height: '15px' }} /> حفظ</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
      : centers.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Target style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد مراكز تكلفة بعد</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['الرمز', 'الاسم', 'النوع', 'المشروع المرتبط', 'الحالة', ''].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem' }}>{h}</th>
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
                  <td style={{ padding: '12px 14px' }}><span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{c.type}</span></td>
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
      supabase.from('finance_accounts').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('code'),
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
    const lines = await loadEntryLines(entry.id)
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, lines } : e))
    setExpandedId(entry.id)
  }

  function updateLine(idx: number, k: keyof JournalLine, v: any) {
    setLines(prev => { const next = [...prev]; next[idx] = { ...next[idx], [k]: v }; return next })
  }
  function addLine() { setLines(p => [...p, { account_id: 0, debit: 0, credit: 0, description: '' }]) }
  function removeLine(idx: number) { if (lines.length > 2) setLines(p => p.filter((_, i) => i !== idx)) }

  const totalDebit  = lines.reduce((s, l) => s + Number(l.debit  || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0)
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  async function handleSave() {
    if (!form.description.trim()) { toast.error('وصف القيد مطلوب'); return }
    if (!isBalanced) { toast.error('القيد غير متوازن — يجب أن يتساوى المدين والدائن'); return }
    if (lines.some(l => !l.account_id)) { toast.error('اختر حساباً لكل سطر'); return }

    const { count } = await supabase.from('finance_journal_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const entryNumber = 'JE-' + new Date().getFullYear() + '-' + String((count || 0) + 1).padStart(4, '0')

    const { data: entry, error } = await supabase.from('finance_journal_entries').insert({
      tenant_id: tenantId, entry_number: entryNumber, entry_date: form.entry_date,
      description: form.description, total_debit: totalDebit, total_credit: totalCredit, status: form.status,
    }).select('id').single()

    if (error) { toast.error('خطأ: ' + error.message); return }

    await supabase.from('finance_journal_lines').insert(
      lines.filter(l => l.account_id).map(l => ({
        entry_id: entry.id, account_id: Number(l.account_id),
        cost_center_id: l.cost_center_id ? Number(l.cost_center_id) : null,
        debit: Number(l.debit || 0), credit: Number(l.credit || 0), description: l.description || null,
      }))
    )

    await loadData()
    setShowForm(false)
    setForm({ entry_date: today, description: '', status: 'معتمد' })
    setLines([{ account_id: 0, debit: 0, credit: 0, description: '' }, { account_id: 0, debit: 0, credit: 0, description: '' }])
    toast.success('✅ تم حفظ القيد — ' + entryNumber)
  }

  const leafAccounts = accounts.filter(a => !a.is_parent)

  return (
    <div className="space-y-4">
      {!showForm && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> قيد يدوي جديد
          </button>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
            قيد يومي جديد
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">التاريخ *</label>
              <input type="date" value={form.entry_date} onChange={e => setF('entry_date', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الوصف / البيان *</label>
              <input value={form.description} onChange={e => setF('description', e.target.value)} className="input" placeholder="مثال: استلام دفعة من العميل..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
              <select value={form.status} onChange={e => setF('status', e.target.value)} className="select">
                <option value="معتمد">معتمد</option>
                <option value="مسودة">مسودة</option>
              </select>
            </div>
          </div>

          {/* سطور القيد */}
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
                        style={{ width: '100px', padding: '5px 8px', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr', background: Number(line.debit) > 0 ? '#eff6ff' : 'white' }}
                        placeholder="0" />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input type="number" min="0" value={line.credit || ''} onChange={e => updateLine(idx, 'credit', e.target.value)}
                        style={{ width: '100px', padding: '5px 8px', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr', background: Number(line.credit) > 0 ? '#fef2f2' : 'white' }}
                        placeholder="0" />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <button onClick={() => removeLine(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}>
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)' }}>
                  <td colSpan={3} style={{ padding: '8px 10px' }}>
                    <button onClick={addLine} style={{ fontSize: '0.78rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ إضافة سطر</button>
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1a56db', direction: 'ltr', textAlign: 'left' }}>{totalDebit.toLocaleString()}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: '#c81e1e', direction: 'ltr', textAlign: 'left' }}>{totalCredit.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* مؤشر التوازن */}
          <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 600,
            background: isBalanced ? '#ecfdf5' : totalDebit > 0 || totalCredit > 0 ? '#fef2f2' : '#f3f4f6',
            color: isBalanced ? '#065f46' : '#991b1b' }}>
            {isBalanced ? '✅ القيد متوازن' : totalDebit > 0 || totalCredit > 0 ? '⚠️ القيد غير متوازن — الفرق: ' + Math.abs(totalDebit - totalCredit).toLocaleString() + ' ر.س' : 'أدخل مبالغ القيد'}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} className="btn btn-ghost">إلغاء</button>
            <button onClick={handleSave} disabled={!isBalanced} className="btn btn-primary">
              <Save style={{ width: '15px', height: '15px' }} /> حفظ القيد
            </button>
          </div>
        </div>
      )}

      {/* قائمة القيود */}
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
      : entries.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <BookOpen style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد قيود يومية بعد</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                {['رقم القيد', 'التاريخ', 'البيان', 'المرجع', 'إجمالي مدين', 'إجمالي دائن', 'الحالة', ''].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <>
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--bg2)', cursor: 'pointer' }}
                    onClick={() => handleToggleExpand(entry)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = expandedId === entry.id ? '#f0f9ff' : 'transparent')}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{entry.entry_number}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>{entry.entry_date}</td>
                    <td style={{ padding: '12px 14px' }}>{entry.description}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.78rem', color: 'var(--text3)' }}>{entry.reference_type || 'يدوي'}</td>
                    <td style={{ padding: '12px 14px', color: '#1a56db', fontWeight: 700 }}>{Number(entry.total_debit).toLocaleString()} ر.س</td>
                    <td style={{ padding: '12px 14px', color: '#c81e1e', fontWeight: 700 }}>{Number(entry.total_credit).toLocaleString()} ر.س</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={'badge ' + (entry.status === 'معتمد' ? 'badge-green' : 'badge-gray')}>{entry.status}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text3)' }}>
                      {expandedId === entry.id ? <ChevronDown style={{ width: '16px', height: '16px' }} /> : <ChevronLeft style={{ width: '16px', height: '16px' }} />}
                    </td>
                  </tr>
                  {expandedId === entry.id && entry.lines && (
                    <tr key={'lines-' + entry.id} style={{ background: '#f0f9ff', borderBottom: '2px solid var(--primary)' }}>
                      <td colSpan={8} style={{ padding: '0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: '#dbeafe' }}>
                              <th style={{ padding: '7px 24px', textAlign: 'right', fontWeight: 700, color: '#1e40af', fontSize: '0.72rem' }}>الحساب</th>
                              <th style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 700, color: '#1e40af', fontSize: '0.72rem' }}>مركز التكلفة</th>
                              <th style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 700, color: '#1e40af', fontSize: '0.72rem' }}>البيان</th>
                              <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 700, color: '#1a56db', fontSize: '0.72rem' }}>مدين</th>
                              <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 700, color: '#c81e1e', fontSize: '0.72rem' }}>دائن</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.lines.map((line, i) => (
                              <tr key={i} style={{ borderTop: '1px solid #bfdbfe' }}>
                                <td style={{ padding: '7px 24px' }}>
                                  <span style={{ fontFamily: 'monospace', color: '#1a56db', fontSize: '0.78rem' }}>{line.account?.code}</span>
                                  {' '}{line.account?.name}
                                </td>
                                <td style={{ padding: '7px 14px', color: 'var(--text3)', fontSize: '0.78rem' }}>{line.cost_center?.name || '—'}</td>
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
      )}
    </div>
  )
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
export default function FinanceAccountingPage() {
  const { tenant } = useStore()
  const [activeTab, setActiveTab] = useState<'chart' | 'journal' | 'costcenters'>('chart')

  const TABS = [
    { id: 'chart',       label: '📊 شجرة الحسابات',   color: '#1a56db' },
    { id: 'journal',     label: '📒 القيود اليومية',   color: '#0ea77b' },
    { id: 'costcenters', label: '🎯 مراكز التكلفة',    color: '#e6820a' },
  ]

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
          الحسابات العامة
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>
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
        </>
      )}
    </div>
  )
}
