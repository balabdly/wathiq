'use client'
import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { FileText, TrendingUp, Scale, ChevronDown, ChevronUp, Download, RefreshCw, Calendar } from 'lucide-react'

// ════════════════════════════════════
// Types
// ════════════════════════════════════
type Account = {
  id: number; code: string; name: string
  account_type: string; is_parent: boolean; parent_id?: number
  debit: number; credit: number; balance: number
}

type Period = { from: string; to: string }

const ACCOUNT_TYPE_ORDER = ['أصول', 'خصوم', 'حقوق ملكية', 'إيرادات', 'مصروفات']

// ════════════════════════════════════
// مكوّن مشترك: صف الحساب
// ════════════════════════════════════
function AccountRow({ account, indent = 0, showDebitCredit = false }: {
  account: Account & { children?: Account[] }
  indent?: number; showDebitCredit?: boolean
}) {
  const [open, setOpen] = useState(true)
  const hasChildren = account.children && account.children.length > 0
  const absBalance = Math.abs(account.balance)

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--bg2)', background: account.is_parent ? '#fafafa' : 'white' }}
        onMouseEnter={e => !account.is_parent && (e.currentTarget.style.background = 'var(--bg2)')}
        onMouseLeave={e => !account.is_parent && (e.currentTarget.style.background = 'white')}>
        <td style={{ padding: '8px 14px', paddingRight: `${14 + indent * 20}px` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {hasChildren && (
              <button onClick={() => setOpen(!open)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#9ca3af' }}>
                {open ? <ChevronDown style={{ width: '13px', height: '13px' }} /> : <ChevronDown style={{ width: '13px', height: '13px', transform: 'rotate(-90deg)' }} />}
              </button>
            )}
            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#9ca3af', minWidth: '45px' }}>{account.code}</span>
            <span style={{ fontWeight: account.is_parent ? 700 : 400, fontSize: account.is_parent ? '0.875rem' : '0.82rem', color: '#1a1a2e' }}>
              {account.name}
            </span>
          </div>
        </td>
        {showDebitCredit ? (
          <>
            <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.82rem', color: account.debit > 0 ? '#1a56db' : '#9ca3af', fontWeight: account.is_parent ? 700 : 400 }}>
              {account.debit > 0 ? account.debit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}
            </td>
            <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.82rem', color: account.credit > 0 ? '#c81e1e' : '#9ca3af', fontWeight: account.is_parent ? 700 : 400 }}>
              {account.credit > 0 ? account.credit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}
            </td>
            <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: account.is_parent ? 700 : 400, color: account.balance >= 0 ? '#0ea77b' : '#c81e1e' }}>
              {absBalance > 0 ? absBalance.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}
            </td>
          </>
        ) : (
          <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: account.is_parent ? 700 : 400, color: account.balance >= 0 ? '#1a1a2e' : '#c81e1e' }}>
            {absBalance > 0 ? absBalance.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}
          </td>
        )}
      </tr>
      {open && hasChildren && account.children!.map(child => (
        <AccountRow key={child.id} account={child} indent={indent + 1} showDebitCredit={showDebitCredit} />
      ))}
    </>
  )
}

// ════════════════════════════════════
// ميزان المراجعة
// ════════════════════════════════════
function TrialBalance({ accounts, period }: { accounts: Account[]; period: Period }) {
  const leafAccounts = accounts.filter(a => !a.is_parent && (a.debit > 0 || a.credit > 0))
  const totalDebit   = leafAccounts.reduce((s, a) => s + a.debit,  0)
  const totalCredit  = leafAccounts.reduce((s, a) => s + a.credit, 0)
  const isBalanced   = Math.abs(totalDebit - totalCredit) < 0.01

  const byType: Record<string, Account[]> = {}
  leafAccounts.forEach(a => {
    if (!byType[a.account_type]) byType[a.account_type] = []
    byType[a.account_type].push(a)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* حالة التوازن */}
      <div style={{
        padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px',
        background: isBalanced ? '#ecfdf5' : '#fef2f2',
        border: `1px solid ${isBalanced ? '#bbf7d0' : '#fecaca'}`,
        color: isBalanced ? '#0ea77b' : '#c81e1e', fontSize: '0.875rem', fontWeight: 600,
      }}>
        {isBalanced ? '✅ الميزان متوازن' : '⚠️ الميزان غير متوازن — فرق: ' + Math.abs(totalDebit - totalCredit).toLocaleString() + ' ر.س'}
        <span style={{ marginRight: 'auto', fontWeight: 400, fontSize: '0.78rem' }}>
          إجمالي المدين: {totalDebit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} |
          إجمالي الدائن: {totalCredit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* الجدول */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#1a56db', color: 'white' }}>
              <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>الحساب</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, direction: 'ltr' }}>مدين (ر.س)</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, direction: 'ltr' }}>دائن (ر.س)</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, direction: 'ltr' }}>الرصيد (ر.س)</th>
            </tr>
          </thead>
          <tbody>
            {ACCOUNT_TYPE_ORDER.filter(t => byType[t]?.length > 0).map(type => (
              <>
                <tr key={type} style={{ background: '#f3f4f6' }}>
                  <td colSpan={4} style={{ padding: '8px 14px', fontWeight: 700, fontSize: '0.82rem', color: '#374151' }}>
                    ── {type}
                  </td>
                </tr>
                {byType[type].map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                    <td style={{ padding: '8px 14px', paddingRight: '28px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#9ca3af', marginLeft: '8px' }}>{a.code}</span>
                      {a.name}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.82rem', color: '#1a56db', direction: 'ltr' }}>
                      {a.debit > 0 ? a.debit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.82rem', color: '#c81e1e', direction: 'ltr' }}>
                      {a.credit > 0 ? a.credit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.82rem', direction: 'ltr' }}>
                      {Math.abs(a.balance) > 0 ? Math.abs(a.balance).toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                  </tr>
                ))}
                <tr key={type + '_total'} style={{ background: '#eff6ff', borderTop: '2px solid #bfdbfe' }}>
                  <td style={{ padding: '8px 14px', paddingRight: '28px', fontWeight: 700, fontSize: '0.82rem' }}>إجمالي {type}</td>
                  <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: '#1a56db', direction: 'ltr' }}>
                    {byType[type].reduce((s, a) => s + a.debit, 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: '#c81e1e', direction: 'ltr' }}>
                    {byType[type].reduce((s, a) => s + a.credit, 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, direction: 'ltr' }}>
                    {Math.abs(byType[type].reduce((s, a) => s + a.balance, 0)).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1a56db', color: 'white' }}>
              <td style={{ padding: '12px 14px', fontWeight: 700 }}>الإجمالي</td>
              <td style={{ padding: '12px 14px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, direction: 'ltr' }}>
                {totalDebit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </td>
              <td style={{ padding: '12px 14px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, direction: 'ltr' }}>
                {totalCredit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </td>
              <td style={{ padding: '12px 14px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, direction: 'ltr' }}>
                {isBalanced ? '✅ متوازن' : '⚠️ غير متوازن'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ════════════════════════════════════
// قائمة الدخل
// ════════════════════════════════════
function IncomeStatement({ accounts, period }: { accounts: Account[]; period: Period }) {
  const revenues   = accounts.filter(a => a.account_type === 'إيرادات'  && !a.is_parent)
  const expenses   = accounts.filter(a => a.account_type === 'مصروفات'  && !a.is_parent)

  // تصنيف المصروفات
  const costAccounts  = expenses.filter(a => a.code.startsWith('51')) // تكاليف مباشرة
  const opexAccounts  = expenses.filter(a => a.code.startsWith('52') || a.code.startsWith('53') || a.code.startsWith('54') || a.code.startsWith('55')) // تشغيلية
  const otherExpenses = expenses.filter(a => a.code.startsWith('58')) // أخرى

  const totalRevenue  = revenues.reduce((s, a)  => s + Math.abs(a.balance), 0)
  const totalCost     = costAccounts.reduce((s, a) => s + a.balance, 0)
  const totalOpex     = opexAccounts.reduce((s, a) => s + a.balance, 0)
  const totalOther    = otherExpenses.reduce((s, a) => s + a.balance, 0)
  const grossProfit   = totalRevenue - totalCost
  const operatingProfit = grossProfit - totalOpex
  const netProfit     = operatingProfit - totalOther

  const fmt = (n: number) => n.toLocaleString('ar-SA', { minimumFractionDigits: 2 })

  function SectionRow({ label, amount, isTotal = false, isNeg = false, indent = false }: {
    label: string; amount: number; isTotal?: boolean; isNeg?: boolean; indent?: boolean
  }) {
    return (
      <tr style={{ borderBottom: '1px solid var(--bg2)', background: isTotal ? '#f8fafc' : 'white' }}>
        <td style={{ padding: `${isTotal ? 10 : 8}px 14px`, paddingRight: indent ? '28px' : '14px', fontWeight: isTotal ? 700 : 400, fontSize: isTotal ? '0.875rem' : '0.82rem', color: '#1a1a2e' }}>
          {label}
        </td>
        <td style={{ padding: `${isTotal ? 10 : 8}px 14px`, textAlign: 'left', fontFamily: 'monospace', fontSize: isTotal ? '0.875rem' : '0.82rem', fontWeight: isTotal ? 700 : 400, direction: 'ltr', color: amount >= 0 ? (isTotal ? '#0ea77b' : '#1a1a2e') : '#c81e1e' }}>
          {amount !== 0 ? (isNeg ? '-' : '') + fmt(Math.abs(amount)) : '—'}
        </td>
      </tr>
    )
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: '#0ea77b', color: 'white' }}>
            <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>البند</th>
            <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, direction: 'ltr' }}>المبلغ (ر.س)</th>
          </tr>
        </thead>
        <tbody>
          {/* الإيرادات */}
          <tr style={{ background: '#ecfdf5' }}>
            <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 700, color: '#0ea77b' }}>الإيرادات</td>
          </tr>
          {revenues.filter(a => Math.abs(a.balance) > 0).map(a => (
            <SectionRow key={a.id} label={`${a.code} — ${a.name}`} amount={Math.abs(a.balance)} indent />
          ))}
          <SectionRow label="إجمالي الإيرادات" amount={totalRevenue} isTotal />

          {/* تكلفة الإيراد */}
          {totalCost > 0 && <>
            <tr style={{ background: '#fef2f2' }}>
              <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 700, color: '#c81e1e' }}>تكلفة الإيراد</td>
            </tr>
            {costAccounts.filter(a => a.balance > 0).map(a => (
              <SectionRow key={a.id} label={`${a.code} — ${a.name}`} amount={a.balance} isNeg indent />
            ))}
            <SectionRow label="إجمالي تكلفة الإيراد" amount={totalCost} isTotal isNeg />
          </>}

          {/* مجمل الربح */}
          <tr style={{ background: grossProfit >= 0 ? '#ecfdf5' : '#fef2f2', borderTop: '2px solid var(--border)' }}>
            <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: '0.95rem', color: grossProfit >= 0 ? '#0ea77b' : '#c81e1e' }}>
              مجمل الربح
            </td>
            <td style={{ padding: '12px 14px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', direction: 'ltr', color: grossProfit >= 0 ? '#0ea77b' : '#c81e1e' }}>
              {fmt(grossProfit)}
            </td>
          </tr>

          {/* المصروفات التشغيلية */}
          {totalOpex > 0 && <>
            <tr style={{ background: '#fffbeb' }}>
              <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 700, color: '#e6820a' }}>المصروفات التشغيلية</td>
            </tr>
            {opexAccounts.filter(a => a.balance > 0).map(a => (
              <SectionRow key={a.id} label={`${a.code} — ${a.name}`} amount={a.balance} isNeg indent />
            ))}
            <SectionRow label="إجمالي المصروفات التشغيلية" amount={totalOpex} isTotal isNeg />
          </>}

          {/* الربح التشغيلي */}
          <tr style={{ background: operatingProfit >= 0 ? '#ecfdf5' : '#fef2f2', borderTop: '2px solid var(--border)' }}>
            <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: '0.95rem', color: operatingProfit >= 0 ? '#0ea77b' : '#c81e1e' }}>
              الربح التشغيلي
            </td>
            <td style={{ padding: '12px 14px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', direction: 'ltr', color: operatingProfit >= 0 ? '#0ea77b' : '#c81e1e' }}>
              {fmt(operatingProfit)}
            </td>
          </tr>

          {/* مصروفات أخرى */}
          {totalOther > 0 && <>
            <tr style={{ background: '#f3f4f6' }}>
              <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 700, color: '#6b7280' }}>مصروفات أخرى</td>
            </tr>
            {otherExpenses.filter(a => a.balance > 0).map(a => (
              <SectionRow key={a.id} label={`${a.code} — ${a.name}`} amount={a.balance} isNeg indent />
            ))}
          </>}

          {/* صافي الربح */}
          <tr style={{ background: netProfit >= 0 ? '#1a56db' : '#c81e1e', color: 'white', borderTop: '3px solid var(--border)' }}>
            <td style={{ padding: '14px', fontWeight: 700, fontSize: '1rem' }}>
              {netProfit >= 0 ? '✅ صافي الربح' : '⚠️ صافي الخسارة'}
            </td>
            <td style={{ padding: '14px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', direction: 'ltr' }}>
              {fmt(Math.abs(netProfit))} ر.س
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ════════════════════════════════════
// الميزانية العمومية
// ════════════════════════════════════
function BalanceSheet({ accounts, period }: { accounts: Account[]; period: Period }) {
  const assets      = accounts.filter(a => a.account_type === 'أصول'         && !a.is_parent && a.balance !== 0)
  const liabilities = accounts.filter(a => a.account_type === 'خصوم'         && !a.is_parent && a.balance !== 0)
  const equity      = accounts.filter(a => a.account_type === 'حقوق ملكية'   && !a.is_parent && a.balance !== 0)

  // الأصول الجارية وغير الجارية
  const currentAssets    = assets.filter(a => a.code.startsWith('11'))
  const nonCurrentAssets = assets.filter(a => a.code.startsWith('12'))

  // الخصوم الجارية وغير الجارية
  const currentLiab    = liabilities.filter(a => a.code.startsWith('21'))
  const nonCurrentLiab = liabilities.filter(a => a.code.startsWith('22'))

  // حساب صافي الربح
  const revenues = accounts.filter(a => a.account_type === 'إيرادات' && !a.is_parent)
  const expenses = accounts.filter(a => a.account_type === 'مصروفات' && !a.is_parent)
  const netProfit = revenues.reduce((s, a) => s + Math.abs(a.balance), 0) - expenses.reduce((s, a) => s + a.balance, 0)

  const totalCurrentAssets    = currentAssets.reduce((s, a) => s + Math.abs(a.balance), 0)
  const totalNonCurrentAssets = nonCurrentAssets.reduce((s, a) => s + Math.abs(a.balance), 0)
  const totalAssets            = totalCurrentAssets + totalNonCurrentAssets

  const totalCurrentLiab    = currentLiab.reduce((s, a) => s + Math.abs(a.balance), 0)
  const totalNonCurrentLiab = nonCurrentLiab.reduce((s, a) => s + Math.abs(a.balance), 0)
  const totalLiab            = totalCurrentLiab + totalNonCurrentLiab

  const totalEquity  = equity.reduce((s, a) => s + Math.abs(a.balance), 0) + netProfit
  const totalLiabEq  = totalLiab + totalEquity
  const isBalanced   = Math.abs(totalAssets - totalLiabEq) < 1

  const fmt = (n: number) => n.toLocaleString('ar-SA', { minimumFractionDigits: 2 })

  function Section({ title, items, total, color, bg }: {
    title: string; items: Account[]; total: number; color: string; bg: string
  }) {
    return (
      <>
        <tr style={{ background: bg }}>
          <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 700, color, fontSize: '0.875rem' }}>{title}</td>
        </tr>
        {items.map(a => (
          <tr key={a.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
            <td style={{ padding: '8px 14px', paddingRight: '28px', fontSize: '0.82rem' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#9ca3af', marginLeft: '8px' }}>{a.code}</span>
              {a.name}
            </td>
            <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.82rem', direction: 'ltr' }}>
              {fmt(Math.abs(a.balance))}
            </td>
          </tr>
        ))}
        <tr style={{ background: '#f8fafc', borderTop: '1px solid var(--border)' }}>
          <td style={{ padding: '8px 14px', paddingRight: '28px', fontWeight: 700, fontSize: '0.82rem' }}>إجمالي {title}</td>
          <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', direction: 'ltr', color }}>
            {fmt(total)}
          </td>
        </tr>
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* حالة التوازن */}
      <div style={{
        padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px',
        background: isBalanced ? '#ecfdf5' : '#fef2f2',
        border: `1px solid ${isBalanced ? '#bbf7d0' : '#fecaca'}`,
        color: isBalanced ? '#0ea77b' : '#c81e1e', fontSize: '0.875rem', fontWeight: 600,
      }}>
        {isBalanced ? '✅ الميزانية متوازنة' : '⚠️ الميزانية غير متوازنة'}
        <span style={{ marginRight: 'auto', fontWeight: 400, fontSize: '0.78rem' }}>
          إجمالي الأصول: {fmt(totalAssets)} | إجمالي الخصوم وحقوق الملكية: {fmt(totalLiabEq)}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* الأصول */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ background: '#1a56db', color: 'white', padding: '12px 14px', fontWeight: 700, fontSize: '0.95rem' }}>
            الأصول
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <tbody>
              {currentAssets.length > 0 && (
                <Section title="الأصول الجارية" items={currentAssets} total={totalCurrentAssets} color="#1a56db" bg="#eff6ff" />
              )}
              {nonCurrentAssets.length > 0 && (
                <Section title="الأصول غير الجارية" items={nonCurrentAssets} total={totalNonCurrentAssets} color="#7c3aed" bg="#f5f3ff" />
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: '#1a56db', color: 'white' }}>
                <td style={{ padding: '12px 14px', fontWeight: 700 }}>إجمالي الأصول</td>
                <td style={{ padding: '12px 14px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, direction: 'ltr' }}>
                  {fmt(totalAssets)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* الخصوم وحقوق الملكية */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ background: '#c81e1e', color: 'white', padding: '12px 14px', fontWeight: 700, fontSize: '0.95rem' }}>
            الخصوم وحقوق الملكية
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <tbody>
              {currentLiab.length > 0 && (
                <Section title="الخصوم الجارية" items={currentLiab} total={totalCurrentLiab} color="#c81e1e" bg="#fef2f2" />
              )}
              {nonCurrentLiab.length > 0 && (
                <Section title="الخصوم غير الجارية" items={nonCurrentLiab} total={totalNonCurrentLiab} color="#e6820a" bg="#fffbeb" />
              )}
              {/* حقوق الملكية */}
              <tr style={{ background: '#ecfdf5' }}>
                <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 700, color: '#0ea77b', fontSize: '0.875rem' }}>حقوق الملكية</td>
              </tr>
              {equity.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                  <td style={{ padding: '8px 14px', paddingRight: '28px', fontSize: '0.82rem' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#9ca3af', marginLeft: '8px' }}>{a.code}</span>
                    {a.name}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.82rem', direction: 'ltr' }}>
                    {fmt(Math.abs(a.balance))}
                  </td>
                </tr>
              ))}
              {/* صافي الربح */}
              <tr style={{ borderBottom: '1px solid var(--bg2)', background: netProfit >= 0 ? '#ecfdf5' : '#fef2f2' }}>
                <td style={{ padding: '8px 14px', paddingRight: '28px', fontSize: '0.82rem', fontWeight: 600, color: netProfit >= 0 ? '#0ea77b' : '#c81e1e' }}>
                  {netProfit >= 0 ? '📈 صافي الربح' : '📉 صافي الخسارة'}
                </td>
                <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600, direction: 'ltr', color: netProfit >= 0 ? '#0ea77b' : '#c81e1e' }}>
                  {fmt(Math.abs(netProfit))}
                </td>
              </tr>
              <tr style={{ background: '#f8fafc', borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 14px', paddingRight: '28px', fontWeight: 700, fontSize: '0.82rem' }}>إجمالي حقوق الملكية</td>
                <td style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', direction: 'ltr', color: '#0ea77b' }}>
                  {fmt(totalEquity)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr style={{ background: '#c81e1e', color: 'white' }}>
                <td style={{ padding: '12px 14px', fontWeight: 700 }}>إجمالي الخصوم وحقوق الملكية</td>
                <td style={{ padding: '12px 14px', textAlign: 'left', fontFamily: 'monospace', fontWeight: 700, direction: 'ltr' }}>
                  {fmt(totalLiabEq)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════
export default function FinancialStatementsPage() {
  const { tenant } = useStore()
  const [activeTab, setActiveTab] = useState<'trial' | 'income' | 'balance'>('trial')
  const [loading, setLoading]     = useState(true)
  const [accounts, setAccounts]   = useState<Account[]>([])
  const today = new Date().toISOString().split('T')[0]
  const yearStart = today.substring(0, 4) + '-01-01'
  const [period, setPeriod] = useState<Period>({ from: yearStart, to: today })

  useEffect(() => { loadAccounts() }, [tenant?.id, period])

  const loadAccounts = useCallback(async () => {
    if (!tenant) return
    setLoading(true)

    const { data: accs } = await supabase
      .from('finance_accounts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('code')

    // جلب أسطر القيود مع فلتر الفترة
    const { data: lines } = await supabase
      .from('finance_journal_lines')
      .select('account_id, debit, credit, finance_journal_entries!inner(tenant_id, entry_date)')
      .eq('finance_journal_entries.tenant_id', tenant.id)
      .gte('finance_journal_entries.entry_date', period.from)
      .lte('finance_journal_entries.entry_date', period.to)

    // بناء map للأرصدة
    const balMap: Record<number, { debit: number; credit: number }> = {}
    ;(lines || []).forEach((l: any) => {
      if (!balMap[l.account_id]) balMap[l.account_id] = { debit: 0, credit: 0 }
      balMap[l.account_id].debit  += Number(l.debit  || 0)
      balMap[l.account_id].credit += Number(l.credit || 0)
    })

    const result: Account[] = (accs || []).map((a: any) => {
      const b = balMap[a.id] || { debit: 0, credit: 0 }
      return {
        ...a,
        debit:   b.debit,
        credit:  b.credit,
        balance: b.debit - b.credit,
      }
    })

    setAccounts(result)
    setLoading(false)
  }, [tenant?.id, period])

  const TABS = [
    { id: 'trial',   label: '⚖️ ميزان المراجعة',    color: '#1a56db' },
    { id: 'income',  label: '📈 قائمة الدخل',        color: '#0ea77b' },
    { id: 'balance', label: '🏦 الميزانية العمومية',  color: '#7c3aed' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scale style={{ width: '20px', height: '20px', color: '#1a56db' }} />
            القوائم المالية
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>
            وفق المعايير الدولية للتقارير المالية (IFRS)
          </p>
        </div>
        {/* فلتر الفترة */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'white', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <Calendar style={{ width: '15px', height: '15px', color: '#9ca3af' }} />
          <input type="date" value={period.from} onChange={e => setPeriod(p => ({ ...p, from: e.target.value }))}
            style={{ border: 'none', outline: 'none', fontSize: '0.82rem', color: '#374151' }} />
          <span style={{ color: '#9ca3af' }}>—</span>
          <input type="date" value={period.to} onChange={e => setPeriod(p => ({ ...p, to: e.target.value }))}
            style={{ border: 'none', outline: 'none', fontSize: '0.82rem', color: '#374151' }} />
          <button onClick={loadAccounts}
            style={{ padding: '4px 8px', borderRadius: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1a56db', cursor: 'pointer' }}>
            <RefreshCw style={{ width: '13px', height: '13px' }} />
          </button>
        </div>
      </div>

      {/* تبويبات */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '5px', borderRadius: '12px', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.2s',
              background: activeTab === t.id ? t.color : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: activeTab === t.id ? `0 2px 8px ${t.color}44` : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* المحتوى */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <>
          {activeTab === 'trial'   && <TrialBalance   accounts={accounts} period={period} />}
          {activeTab === 'income'  && <IncomeStatement accounts={accounts} period={period} />}
          {activeTab === 'balance' && <BalanceSheet    accounts={accounts} period={period} />}
        </>
      )}
    </div>
  )
}
