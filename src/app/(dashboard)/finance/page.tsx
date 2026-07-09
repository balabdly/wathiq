'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { journalPayroll, journalPayrollPayment, journalEOSProvision, getCashAccountCode, confirmCashSpendById } from '@/lib/journal'
import { calcMonthlyEOSProvision } from '@/app/(dashboard)/hr/hr_utils'
import {
  TrendingUp, TrendingDown, DollarSign, FileText,
  ShoppingCart, AlertCircle, CheckCircle2, Clock,
  BarChart2, ArrowUpRight, ArrowDownRight, Inbox, Send
} from 'lucide-react'

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

type PendingPayrollRun = {
  id: number; month: number; year: number; employee_count: number
  total_basic: number; total_allowances: number; total_gosi_employee: number
  total_gosi_employer: number; total_deductions: number; total_net: number
  approved_by: number | null; approved_at: string | null
}

type MonthlyData = { month: string; invoices: number; expenses: number; purchases: number }
type InvoiceRow   = { id: number; invoice_number: string; client_name: string; total_amount: number; status: string; invoice_date: string }
type ExpenseRow   = { id: number; category: string; description: string; amount: number; expense_date: string }

export default function FinanceDashboard() {
  const { tenant, activeBranch, currentUser } = useStore()
  const [loading,  setLoading]  = useState(true)
  const [posting,  setPosting]  = useState<number | null>(null)
  const [paying,   setPaying]   = useState<number | null>(null)
  const [eosRunning, setEosRunning] = useState(false)
  const [pendingRuns, setPendingRuns] = useState<PendingPayrollRun[]>([])
  const [postedRuns,  setPostedRuns]  = useState<PendingPayrollRun[]>([])
  const [cashAccounts, setCashAccounts] = useState<{ id: number; name: string }[]>([])
  const [selectedCashId, setSelectedCashId] = useState<number | null>(null)

  // KPIs
  const [kpis, setKpis] = useState({
    totalRevenue:    0,
    totalExpenses:   0,
    totalPurchases:  0,
    netProfit:       0,
    paidInvoices:    0,
    unpaidInvoices:  0,
    overdueInvoices: 0,
    invoiceCount:    0,
    expenseCount:    0,
    purchaseCount:   0,
    vatCollected:    0,
    vatPaid:         0,
  })

  // بيانات الرسم البياني
  const [monthly,       setMonthly]       = useState<MonthlyData[]>([])
  const [recentInvoices, setRecentInvoices] = useState<InvoiceRow[]>([])
  const [recentExpenses, setRecentExpenses] = useState<ExpenseRow[]>([])

  useEffect(() => { if (tenant && activeBranch) loadAll() }, [tenant?.id, activeBranch?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const tid = tenant.id

    // ── ١ KPIs ──
    const [invRes, expRes, purRes, payrollRes, postedRes, cashRes] = await Promise.all([
      supabase.from('finance_invoices').select('total_amount, subtotal, vat_amount, status, invoice_date, due_date').eq('tenant_id', tid),
      supabase.from('finance_expenses').select('amount, vat_amount, expense_date').eq('tenant_id', tid),
      supabase.from('finance_purchase_orders').select('total_amount, expense_date:created_at').eq('tenant_id', tid),
      supabase.from('hr_payroll_runs').select('id, month, year, employee_count, total_basic, total_allowances, total_gosi_employee, total_gosi_employer, total_deductions, total_net, approved_by, approved_at').eq('tenant_id', tid).eq('status', 'معتمد'),
      supabase.from('hr_payroll_runs').select('id, month, year, employee_count, total_basic, total_allowances, total_gosi_employee, total_gosi_employer, total_deductions, total_net, approved_by, approved_at').eq('tenant_id', tid).eq('status', 'مرحّل للمالية'),
      supabase.from('finance_cash_accounts').select('id, name').eq('tenant_id', tid).eq('is_active', true).order('name'),
    ])
    setPendingRuns((payrollRes.data || []) as PendingPayrollRun[])
    setPostedRuns((postedRes.data || []) as PendingPayrollRun[])
    setCashAccounts(cashRes.data || [])
    if (cashRes.data?.length && !selectedCashId) setSelectedCashId(cashRes.data[0].id)

    const invoices  = invRes.data  || []
    const expenses  = expRes.data  || []
    const purchases = purRes.data  || []
    const today     = new Date().toISOString().split('T')[0]

    const totalRevenue   = invoices.reduce((s, i) => s + Number(i.total_amount), 0)
    const totalExpenses  = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const totalPurchases = purchases.reduce((s, p) => s + Number(p.total_amount), 0)
    const vatCollected   = invoices.reduce((s, i) => s + Number(i.vat_amount || 0), 0)
    const vatPaid        = expenses.reduce((s, e) => s + Number(e.vat_amount || 0), 0)
    const paidInvoices   = invoices.filter(i => i.status === 'مدفوعة').reduce((s, i) => s + Number(i.total_amount), 0)
    const unpaidInvoices = invoices.filter(i => i.status !== 'مدفوعة').reduce((s, i) => s + Number(i.total_amount), 0)
    const overdueCount   = invoices.filter(i => i.status !== 'مدفوعة' && i.due_date && i.due_date < today).length

    setKpis({
      totalRevenue,
      totalExpenses: totalExpenses + totalPurchases,
      totalPurchases,
      netProfit:     totalRevenue - totalExpenses - totalPurchases,
      paidInvoices,
      unpaidInvoices,
      overdueInvoices: overdueCount,
      invoiceCount:  invoices.length,
      expenseCount:  expenses.length,
      purchaseCount: purchases.length,
      vatCollected,
      vatPaid,
    })

    // ── ٢ بيانات شهرية ──
    const monthMap: Record<string, MonthlyData> = {}
    const addMonth = (date: string, field: 'invoices' | 'expenses' | 'purchases', amount: number) => {
      if (!date) return
      const m = date.slice(0, 7)
      if (!monthMap[m]) monthMap[m] = { month: m, invoices: 0, expenses: 0, purchases: 0 }
      monthMap[m][field] += amount
    }
    invoices.forEach(i  => addMonth(i.invoice_date, 'invoices',  Number(i.total_amount)))
    expenses.forEach(e  => addMonth(e.expense_date, 'expenses',  Number(e.amount)))
    purchases.forEach(p => addMonth((p as any).expense_date?.slice(0,10), 'purchases', Number(p.total_amount)))

    const sorted = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-6)
    setMonthly(sorted)

    // ── ٣ آخر الفواتير ──
    const { data: inv } = await supabase.from('finance_invoices')
      .select('id, invoice_number, client_name, total_amount, status, invoice_date')
      .eq('tenant_id', tid).order('created_at', { ascending: false }).limit(5)
    setRecentInvoices(inv || [])

    // ── ٤ آخر المصروفات ──
    const { data: exp } = await supabase.from('finance_expenses')
      .select('id, category, description, amount, expense_date')
      .eq('tenant_id', tid).order('expense_date', { ascending: false }).limit(5)
    setRecentExpenses(exp || [])

    setLoading(false)
  }

  // ══ ترحيل مسير رواتب معتمد للدفاتر — حصراً لأصحاب صلاحية "finance" (فصل حقيقي عن اعتماد HR) ══
  async function handlePostPayroll(run: PendingPayrollRun) {
    if (!tenant) return
    if (!currentUser?.permissions?.includes('finance')) { toast.error('⛔ ترحيل الرواتب للدفاتر صلاحية حصرية لقسم المالية والمحاسبة'); return }
    if (!confirm(`ترحيل مسير ${ARABIC_MONTHS[run.month - 1]} ${run.year} للدفاتر؟\nإجمالي الصافي: ${run.total_net.toLocaleString()} ر.س\nسيُسجَّل قيد محاسبي متوازن نهائي.`)) return

    setPosting(run.id)
    const result = await journalPayroll({
      tenantId:          tenant.id,
      date:              new Date().toISOString().split('T')[0],
      runId:             run.id,
      monthLabel:        `${ARABIC_MONTHS[run.month - 1]} ${run.year}`,
      totalBasic:        run.total_basic,
      totalAllowances:   run.total_allowances,
      totalGosiEmployee: run.total_gosi_employee,
      totalGosiEmployer: run.total_gosi_employer,
      totalDeductions:   run.total_deductions,
      totalNet:          run.total_net,
    })

    if (!result) {
      toast.error('⛔ فشل ترحيل المسير — تحقق من شجرة الحسابات (5210، 5230، 5220، 2120، 2160) والفترة المحاسبية')
      setPosting(null)
      return
    }

    await supabase.from('hr_payroll_runs').update({
      status: 'مرحّل للمالية', posted_by: currentUser?.id || null, posted_at: new Date().toISOString(),
      journal_entry_id: result.entryId,
    }).eq('id', run.id)

    toast.success(`✅ تم ترحيل مسير ${ARABIC_MONTHS[run.month - 1]} للدفاتر — القيد ${result.entryNumber}\nالخطوة التالية: دفع الرواتب من الخزينة`)
    setPendingRuns(prev => prev.filter(r => r.id !== run.id))
    setPostedRuns(prev => [...prev, run])
    setPosting(null)
  }

  // ══ دفع الرواتب من الخزينة بعد الترحيل ══
  async function handlePayPayroll(run: PendingPayrollRun) {
    if (!tenant || !selectedCashId) { toast.error('اختر حساباً نقدياً للصرف'); return }
    const gosiTotal = run.total_gosi_employee + run.total_gosi_employer
    const payTotal  = run.total_net + gosiTotal
    if (!confirm(`دفع مسير ${ARABIC_MONTHS[run.month - 1]} ${run.year}؟\nصافي الرواتب: ${run.total_net.toLocaleString()} ر.س\nالتأمينات: ${gosiTotal.toLocaleString()} ر.س\nالإجمالي: ${payTotal.toLocaleString()} ر.س`)) return

    const ok = await confirmCashSpendById(tenant.id, selectedCashId, payTotal)
    if (!ok) return

    setPaying(run.id)
    const cashCode = await getCashAccountCode(selectedCashId)
    const result = await journalPayrollPayment({
      tenantId:        tenant.id,
      date:            new Date().toISOString().split('T')[0],
      runId:           run.id,
      monthLabel:      `${ARABIC_MONTHS[run.month - 1]} ${run.year}`,
      netAmount:       run.total_net,
      gosiAmount:      gosiTotal,
      cashAccountCode: cashCode,
    })
    if (!result) { setPaying(null); return }

    await supabase.from('hr_payroll').update({ status: 'مدفوع' }).eq('run_id', run.id)
    await supabase.from('hr_payroll').update({ status: 'مدفوع' })
      .eq('tenant_id', tenant.id).eq('month', run.month).eq('year', run.year).in('status', ['معتمد', 'مرحّل للمالية'])
    await supabase.from('hr_payroll_runs').update({ status: 'مدفوع' }).eq('id', run.id)

    toast.success(`✅ تم دفع المسير — القيد ${result.entryNumber}`)
    setPostedRuns(prev => prev.filter(r => r.id !== run.id))
    setPaying(null)
  }

  // ══ مخصص مكافأة نهاية الخدمة الشهري (IAS 19) ══
  async function handleEOSProvision() {
    if (!tenant) return
    const now = new Date()
    const month = now.getMonth() + 1
    const year  = now.getFullYear()

    const { data: emps } = await supabase.from('hr_employees')
      .select('basic_salary, hire_date')
      .eq('tenant_id', tenant.id).eq('is_active', true)

    const total = (emps || []).reduce((s: number, e: any) =>
      s + calcMonthlyEOSProvision(Number(e.basic_salary || 0), e.hire_date || ''), 0)

    if (total <= 0) { toast.error('لا يوجد موظفون نشطون لاحتساب المخصص'); return }
    if (!confirm(`تسجيل مخصص نهاية الخدمة لـ ${ARABIC_MONTHS[month - 1]} ${year}؟\nإجمالي المخصص: ${total.toLocaleString()} ر.س\n(${(emps || []).length} موظف)`)) return

    setEosRunning(true)
    const result = await journalEOSProvision({
      tenantId:    tenant.id,
      date:        new Date().toISOString().split('T')[0],
      monthLabel:  `${ARABIC_MONTHS[month - 1]} ${year}`,
      totalAmount: total,
    })
    setEosRunning(false)
    if (!result) return
    toast.success(`✅ تم تسجيل مخصص نهاية الخدمة — ${total.toLocaleString()} ر.س — القيد ${result.entryNumber}`)
  }

  // ── الرسم البياني ──
  const maxVal = Math.max(...monthly.map(m => Math.max(m.invoices, m.expenses + m.purchases)), 1)
  const barH   = 140

  const monthLabels: Record<string, string> = {
    '01':'يناير','02':'فبراير','03':'مارس','04':'أبريل',
    '05':'مايو','06':'يونيو','07':'يوليو','08':'أغسطس',
    '09':'سبتمبر','10':'أكتوبر','11':'نوفمبر','12':'ديسمبر'
  }
  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-')
    return `${monthLabels[mo]} ${y}`
  }

  const statusColor: Record<string, { bg: string; color: string }> = {
    'مدفوعة':  { bg: '#ecfdf5', color: '#0ea77b' },
    'مرسلة':   { bg: '#eff6ff', color: '#1a56db' },
    'مسودة':   { bg: '#f8fafc', color: '#64748b' },
    'ملغاة':   { bg: '#fef2f2', color: '#c81e1e' },
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text3)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        جاري تحميل البيانات...
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 style={{ width: '22px', height: '22px', color: '#1a56db' }} />
          لوحة التحكم المالية
        </h1>
        <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>نظرة شاملة على الوضع المالي</p>
      </div>

      {/* ══ صندوق وارد: طلبات بانتظار ترحيل المالية ══ */}
      {currentUser?.permissions?.includes('finance') && pendingRuns.length > 0 && (
        <div className="card" style={{ padding: '16px', border: '2px solid #fde68a', background: '#fffbeb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Inbox style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#92400e' }}>طلبات بانتظار اعتمادك — {pendingRuns.length}</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingRuns.map(run => (
              <div key={run.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'white', borderRadius: '10px', border: '1px solid #fde68a', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>💰 مسير رواتب {ARABIC_MONTHS[run.month - 1]} {run.year}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '2px' }}>
                    {run.employee_count} موظف · صافي {run.total_net.toLocaleString()} ر.س · حصة الشركة بالتأمينات {run.total_gosi_employer.toLocaleString()} ر.س
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#0ea77b', marginTop: '2px' }}>✓ معتمد من رئيس الموارد البشرية</div>
                </div>
                <button onClick={() => handlePostPayroll(run)} disabled={posting === run.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#1a56db', color: 'white', fontWeight: 600, fontSize: '0.82rem' }}>
                  {posting === run.id
                    ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    : <Send style={{ width: '15px', height: '15px' }} />}
                  ترحيل نهائي للدفاتر
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ مسيرات مرحّلة بانتظار الدفع من الخزينة ══ */}
      {currentUser?.permissions?.includes('finance') && postedRuns.length > 0 && (
        <div className="card" style={{ padding: '16px', border: '2px solid #bfdbfe', background: '#eff6ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign style={{ width: '18px', height: '18px', color: '#1a56db' }} />
              <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a56db' }}>مسيرات بانتظار الدفع — {postedRuns.length}</h3>
            </div>
            <select value={selectedCashId || ''} onChange={e => setSelectedCashId(Number(e.target.value))} className="select" style={{ width: 'auto', minWidth: '180px' }}>
              {cashAccounts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {postedRuns.map(run => (
              <div key={run.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'white', borderRadius: '10px', border: '1px solid #bfdbfe', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>💳 دفع مسير {ARABIC_MONTHS[run.month - 1]} {run.year}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '2px' }}>
                    صافي {run.total_net.toLocaleString()} ر.س + تأمينات {(run.total_gosi_employee + run.total_gosi_employer).toLocaleString()} ر.س
                  </div>
                </div>
                <button onClick={() => handlePayPayroll(run)} disabled={paying === run.id || !selectedCashId}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#0ea77b', color: 'white', fontWeight: 600, fontSize: '0.82rem' }}>
                  {paying === run.id ? '...' : '💸 دفع من الخزينة'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ مخصص مكافأة نهاية الخدمة ══ */}
      {currentUser?.permissions?.includes('finance') && (
        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', border: '1px solid #e9d5ff', background: '#faf5ff' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#7c3aed' }}>📊 مخصص مكافأة نهاية الخدمة (IAS 19)</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '2px' }}>احتساب وتسجيل المخصص الشهري لجميع الموظفين النشطين</div>
          </div>
          <button onClick={handleEOSProvision} disabled={eosRunning}
            style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#7c3aed', color: 'white', fontWeight: 600, fontSize: '0.82rem' }}>
            {eosRunning ? 'جاري التسجيل...' : 'تسجيل المخصص الشهري'}
          </button>
        </div>
      )}

      {/* KPIs الرئيسية */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          {
            label: 'إجمالي الإيرادات', value: kpis.totalRevenue,
            icon: <TrendingUp style={{ width: '20px', height: '20px' }} />,
            color: '#0ea77b', bg: '#ecfdf5', sub: `${kpis.invoiceCount} فاتورة`
          },
          {
            label: 'إجمالي المصروفات', value: kpis.totalExpenses,
            icon: <TrendingDown style={{ width: '20px', height: '20px' }} />,
            color: '#c81e1e', bg: '#fef2f2', sub: `${kpis.expenseCount + kpis.purchaseCount} عملية`
          },
          {
            label: 'صافي الربح', value: kpis.netProfit,
            icon: <DollarSign style={{ width: '20px', height: '20px' }} />,
            color: kpis.netProfit >= 0 ? '#0ea77b' : '#c81e1e',
            bg:    kpis.netProfit >= 0 ? '#ecfdf5' : '#fef2f2',
            sub:   kpis.netProfit >= 0 ? '▲ ربح' : '▼ خسارة'
          },
          {
            label: 'ضريبة القيمة المضافة', value: kpis.vatCollected - kpis.vatPaid,
            icon: <FileText style={{ width: '20px', height: '20px' }} />,
            color: '#7c3aed', bg: '#f5f3ff',
            sub: `محصّلة ${formatCurrency(kpis.vatCollected)} | مدفوعة ${formatCurrency(kpis.vatPaid)}`
          },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '14px', padding: '16px 18px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ color: kpi.color }}>{kpi.icon}</div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text3)', fontWeight: 600 }}>{kpi.sub}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: kpi.color, direction: 'ltr', textAlign: 'right' }}>
              {formatCurrency(Math.abs(kpi.value))}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* KPIs الفواتير */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { label: 'فواتير مدفوعة',  value: kpis.paidInvoices,    color: '#0ea77b', icon: <CheckCircle2 style={{ width: '16px', height: '16px' }} />, bg: '#ecfdf5' },
          { label: 'فواتير معلقة',   value: kpis.unpaidInvoices,  color: '#e6820a', icon: <Clock style={{ width: '16px', height: '16px' }} />,         bg: '#fffbeb' },
          { label: 'فواتير متأخرة',  value: kpis.overdueInvoices, color: '#c81e1e', icon: <AlertCircle style={{ width: '16px', height: '16px' }} />,   bg: '#fef2f2', isCount: true },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: '12px', padding: '14px 16px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ color: k.color, background: 'white', borderRadius: '8px', padding: '8px', display: 'flex' }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: k.isCount ? '1.6rem' : '1.1rem', fontWeight: 800, color: k.color }}>
                {k.isCount ? k.value : formatCurrency(k.value)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* الرسم البياني الشهري */}
      {monthly.length > 0 && (
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>📊 الإيرادات مقابل المصروفات (شهري)</h3>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.72rem', fontWeight: 600 }}>
              <span style={{ color: '#0ea77b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#0ea77b' }} /> الإيرادات
              </span>
              <span style={{ color: '#c81e1e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#c81e1e' }} /> المصروفات
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', height: `${barH + 30}px` }}>
            {monthly.map(m => {
              const totalExp = m.expenses + m.purchases
              const invH = Math.round((m.invoices / maxVal) * barH)
              const expH = Math.round((totalExp   / maxVal) * barH)
              return (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: `${barH}px` }}>
                    {/* عمود الإيرادات */}
                    <div style={{ width: '18px', height: `${invH}px`, background: '#0ea77b', borderRadius: '4px 4px 0 0', minHeight: '2px',
                      transition: 'height 0.5s', cursor: 'pointer', position: 'relative' }}
                      title={`الإيرادات: ${formatCurrency(m.invoices)}`} />
                    {/* عمود المصروفات */}
                    <div style={{ width: '18px', height: `${expH}px`, background: '#c81e1e', borderRadius: '4px 4px 0 0', minHeight: '2px',
                      transition: 'height 0.5s', cursor: 'pointer' }}
                      title={`المصروفات: ${formatCurrency(totalExp)}`} />
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text3)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {fmtMonth(m.month)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* الجداول السفلية */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* آخر الفواتير */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.875rem' }}>
              <FileText style={{ width: '15px', height: '15px', display: 'inline', marginLeft: '6px', color: '#1a56db' }} />
              آخر الفواتير
            </h3>
            <a href="/finance" style={{ fontSize: '0.72rem', color: '#1a56db', textDecoration: 'none', fontWeight: 600 }}>عرض الكل ←</a>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <tbody>
              {recentInvoices.map(inv => (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600 }}>{inv.invoice_number}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{inv.client_name}</div>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: 700,
                      background: statusColor[inv.status]?.bg || '#f8fafc',
                      color:      statusColor[inv.status]?.color || '#64748b',
                    }}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#0ea77b', direction: 'ltr' }}>
                    {formatCurrency(Number(inv.total_amount))}
                  </td>
                </tr>
              ))}
              {recentInvoices.length === 0 && (
                <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.78rem' }}>لا توجد فواتير</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* آخر المصروفات */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.875rem' }}>
              <ShoppingCart style={{ width: '15px', height: '15px', display: 'inline', marginLeft: '6px', color: '#c81e1e' }} />
              آخر المصروفات
            </h3>
            <a href="/finance" style={{ fontSize: '0.72rem', color: '#1a56db', textDecoration: 'none', fontWeight: 600 }}>عرض الكل ←</a>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <tbody>
              {recentExpenses.map(exp => (
                <tr key={exp.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600 }}>{exp.category}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{exp.description}</div>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#c81e1e', direction: 'ltr' }}>
                    {formatCurrency(Number(exp.amount))}
                  </td>
                </tr>
              ))}
              {recentExpenses.length === 0 && (
                <tr><td colSpan={2} style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.78rem' }}>لا توجد مصروفات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
