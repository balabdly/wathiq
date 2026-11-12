// src/app/(dashboard)/finance/accounting/periods/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { createJournalEntry } from '@/lib/journal'

const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
    <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  </div>
)

// ════════════════════════════════════════
// تاب الفترات المحاسبية — إقفال وفتح الفترات الشهرية
// ════════════════════════════════════════
const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

function FiscalPeriodsTab({ tenantId }: { tenantId: string }) {
  const currentYear  = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [year, setYear]         = useState(currentYear)
  const [closed, setClosed]     = useState<Record<number, { closed_at?: string; closed_by?: string }>>({})
  const [counts, setCounts]     = useState<Record<number, number>>({})
  const [loading, setLoading]   = useState(true)
  const [working, setWorking]   = useState<number | null>(null)
  const [yearCloseEntry, setYearCloseEntry] = useState<string | null>(null)   // رقم قيد الإقفال السنوي إن وجد
  const [closingYear, setClosingYear]       = useState(false)

  useEffect(() => { load() }, [year])

  async function load() {
    setLoading(true)
    const [{ data: periods }, { data: entries }, { data: yearClose }] = await Promise.all([
      supabase.from('finance_fiscal_periods')
        .select('month, status, closed_at, closed_by')
        .eq('tenant_id', tenantId).eq('year', year).eq('status', 'مقفلة'),
      supabase.from('finance_journal_entries')
        .select('entry_date')
        .eq('tenant_id', tenantId)
        .gte('entry_date', `${year}-01-01`).lte('entry_date', `${year}-12-31`),
      supabase.from('finance_journal_entries')
        .select('entry_number')
        .eq('tenant_id', tenantId).eq('reference_type', 'إقفال سنوي')
        .gte('entry_date', `${year}-01-01`).lte('entry_date', `${year}-12-31`)
        .maybeSingle(),
    ])
    setYearCloseEntry(yearClose?.entry_number || null)
    const cl: Record<number, any> = {}
    ;(periods || []).forEach((p: any) => { cl[p.month] = { closed_at: p.closed_at, closed_by: p.closed_by } })
    setClosed(cl)
    const cn: Record<number, number> = {}
    ;(entries || []).forEach((e: any) => {
      const m = new Date(e.entry_date).getMonth() + 1
      cn[m] = (cn[m] || 0) + 1
    })
    setCounts(cn)
    setLoading(false)
  }

  async function toggleMonth(month: number) {
    const isClosed = !!closed[month]
    if (isClosed && yearCloseEntry) {
      toast.error(`⛔ السنة ${year} مقفلة بقيد إقفال سنوي (${yearCloseEntry}) — فتح فتراتها يتطلب أولاً عكس قيد الإقفال من صفحة القيود`, { duration: 7000 })
      return
    }
    if (isClosed) {
      if (!confirm(`فتح فترة ${MONTH_NAMES[month - 1]} ${year}؟\nسيصبح الترحيل والتعديل فيها ممكناً مرة أخرى.`)) return
      setWorking(month)
      const { error } = await supabase.from('finance_fiscal_periods').delete()
        .eq('tenant_id', tenantId).eq('year', year).eq('month', month)
      if (error) { toast.error('تعذر فتح الفترة: ' + error.message); setWorking(null); return }
      toast.success(`🔓 فُتحت فترة ${MONTH_NAMES[month - 1]} ${year}`)
    } else {
      if (!confirm(`إقفال فترة ${MONTH_NAMES[month - 1]} ${year}؟\nبعد الإقفال لن يمكن ترحيل أو تعديل أو حذف أي قيد بتاريخ يقع فيها — حتى تُفتح مرة أخرى.`)) return
      setWorking(month)
      const { error } = await supabase.from('finance_fiscal_periods').insert({
        tenant_id: tenantId, year, month, status: 'مقفلة',
      })
      if (error) { toast.error('خطأ: ' + error.message); setWorking(null); return }
      toast.success(`🔒 أُقفلت فترة ${MONTH_NAMES[month - 1]} ${year}`)
    }
    setWorking(null)
    load()
  }

  // ══ الإقفال السنوي: تصفير الإيرادات والمصروفات وترحيل صافي الربح للأرباح المحتجزة (3200) ══
  async function closeFiscalYear() {
    if (yearCloseEntry) { toast.error(`السنة مقفلة مسبقاً بالقيد ${yearCloseEntry}`); return }
    if (!confirm(
      `🏁 إقفال السنة المالية ${year}؟\n\n` +
      `سيتم:\n` +
      `1) تصفير كل حسابات الإيرادات والمصروفات بقيد إقفال بتاريخ 31/12/${year}\n` +
      `2) ترحيل صافي الربح/الخسارة إلى الأرباح المحتجزة (3200)\n` +
      `3) إقفال كل فترات السنة الشهرية نهائياً\n\n` +
      `تأكد من مراجعة قيود السنة وإصدار قوائمها قبل المتابعة.`
    )) return

    setClosingYear(true)
    let decemberOpened = false
    let annualJournalCreated = false
    try {
      // Collect the complete year's approved journal lines, even when >1000.
      // The old .in(entry_id, ids) approach could silently omit movements.
      const byCode: Record<string, { code: string; name: string; net: number }> = {}
      const pageSize = 500
      for (let offset = 0; ; offset += pageSize) {
        const { data: jls, error: journalError } = await supabase.from('finance_journal_lines')
          .select('id, debit, credit, account:finance_accounts(code, name, account_type), finance_journal_entries!inner(tenant_id, entry_date, status)')
          .eq('finance_journal_entries.tenant_id', tenantId)
          .eq('finance_journal_entries.status', 'معتمد')
          .gte('finance_journal_entries.entry_date', `${year}-01-01`)
          .lte('finance_journal_entries.entry_date', `${year}-12-31`)
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1)
        if (journalError) throw journalError
        for (const line of jls || []) {
          const acc = line.account as unknown as { code: string; name: string; account_type: string } | null
          if (!acc || (acc.account_type !== 'إيرادات' && acc.account_type !== 'مصروفات' && acc.account_type !== 'تكلفة')) continue
          if (!byCode[acc.code]) byCode[acc.code] = { code: acc.code, name: acc.name, net: 0 }
          byCode[acc.code].net += Number(line.debit || 0) - Number(line.credit || 0)
        }
        if ((jls || []).length < pageSize) break
      }

      // 3) بناء سطور الإقفال: عكس صافي كل حساب لتصفيره
      const closingLines = Object.values(byCode)
        .filter(a => Math.abs(a.net) > 0.009)
        .map(a => ({
          accountCode: a.code,
          debit:  a.net < 0 ? Math.round(-a.net * 100) / 100 : 0,
          credit: a.net > 0 ? Math.round( a.net * 100) / 100 : 0,
          description: `إقفال ${a.name} — سنة ${year}`,
        }))

      let entryNo: string | null = null
      let netProfit = 0

      if (closingLines.length > 0) {
        const sumD = closingLines.reduce((s, l) => s + l.debit, 0)
        const sumC = closingLines.reduce((s, l) => s + l.credit, 0)
        netProfit = Math.round((sumD - sumC) * 100) / 100   // موجب = ربح
        if (Math.abs(netProfit) > 0.009) {
          closingLines.push({
            accountCode: '32',  // الأرباح المبقاة (النظام الخماسي المباشر)
            debit:  netProfit < 0 ? -netProfit : 0,
            credit: netProfit > 0 ?  netProfit : 0,
            description: netProfit > 0 ? `صافي ربح سنة ${year}` : `صافي خسارة سنة ${year}`,
          })
        }

        // 4) فتح ديسمبر مؤقتاً إن كان مقفلاً حتى يمر قيد الإقفال
        if (closed[12]) {
          const { error: reopenError } = await supabase.from('finance_fiscal_periods').delete()
            .eq('tenant_id', tenantId).eq('year', year).eq('month', 12)
          if (reopenError) throw new Error('تعذر فتح ديسمبر مؤقتاً: ' + reopenError.message)
          decemberOpened = true
        }

        const result = await createJournalEntry({
          tenantId,
          date: `${year}-12-31`,
          description: `قيد الإقفال السنوي — السنة المالية ${year}`,
          referenceType: 'إقفال سنوي',
          source: 'آلي',
          lines: closingLines,
        })
        if (!result) throw new Error('تعذر ترحيل قيد الإقفال')
        annualJournalCreated = true
        entryNo = result.entryNumber
      }

      // 5) إقفال كل فترات السنة
      const { error: closeError } = await supabase.from('finance_fiscal_periods').upsert(
        Array.from({ length: 12 }, (_, i) => ({ tenant_id: tenantId, year, month: i + 1, status: 'مقفلة' })),
        { onConflict: 'tenant_id,year,month' }
      )
      if (closeError) throw new Error('تعذر إقفال فترات السنة: ' + closeError.message)

      toast.success(
        entryNo
          ? `🏁 أُقفلت السنة ${year} — القيد ${entryNo}${Math.abs(netProfit) > 0.009 ? ` · صافي ${netProfit > 0 ? 'الربح' : 'الخسارة'}: ${Math.abs(netProfit).toLocaleString()} ر.س → الأرباح المحتجزة` : ''}`
          : `🏁 أُقفلت فترات السنة ${year} — لا توجد إيرادات أو مصروفات تتطلب قيد إقفال`,
        { duration: 9000 }
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'خطأ غير معروف'
      if (decemberOpened) {
        const { error: restoreError } = await supabase.from('finance_fiscal_periods').upsert(
          { tenant_id: tenantId, year, month: 12, status: 'مقفلة' },
          { onConflict: 'tenant_id,year,month' }
        )
        if (restoreError) toast.error('تنبيه: تعذر إعادة إقفال ديسمبر؛ راجع الفترة فوراً', { duration: 12000 })
      }
      if (annualJournalCreated) {
        toast.error('تم تسجيل قيد الإقفال، لكن بعض الفترات لم تقفل؛ راجعها قبل إعادة المحاولة. ' + message, { duration: 12000 })
      } else {
        toast.error('خطأ في الإقفال السنوي: ' + message)
      }
    }
    setClosingYear(false)
    load()
  }

  const closedCount = Object.keys(closed).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ══ بطاقة الإقفال السنوي ══ */}
      <div className="card" style={{ padding: '16px 20px', borderRight: '4px solid ' + (yearCloseEntry ? '#c81e1e' : '#7c3aed'), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
            {yearCloseEntry ? `🏁 السنة المالية ${year} مقفلة نهائياً` : `الإقفال السنوي — ${year}`}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '3px' }}>
            {yearCloseEntry
              ? `قيد الإقفال: ${yearCloseEntry} — صُفّرت حسابات الإيرادات والمصروفات ورُحّل الصافي للأرباح المحتجزة`
              : 'يصفّر الإيرادات والمصروفات ويرحّل صافي الربح للأرباح المحتجزة (3200) ثم يقفل كل الفترات'}
          </div>
        </div>
        {!yearCloseEntry && (
          <button onClick={closeFiscalYear} disabled={closingYear}
            style={{ padding: '8px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', background: '#7c3aed', color: 'white' }}>
            {closingYear ? 'جاري الإقفال...' : `🏁 إقفال السنة المالية ${year}`}
          </button>
        )}
      </div>

      {/* شريط السنة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setYear(y => y - 1)} className="btn btn-ghost" style={{ padding: '6px 12px' }}>‹</button>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', minWidth: '70px', textAlign: 'center' }}>{year}</div>
          <button onClick={() => setYear(y => y + 1)} className="btn btn-ghost" style={{ padding: '6px 12px' }}>›</button>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
          🔒 {closedCount} فترة مقفلة · 🔓 {12 - closedCount} مفتوحة
        </div>
      </div>

      <div style={{ padding: '10px 14px', background: '#fef9ec', borderRadius: '10px', border: '1px solid #fde68a', fontSize: '0.78rem', color: '#92400e' }}>
        ℹ️ إقفال الفترة يمنع نهائياً ترحيل أو تعديل أو حذف أي قيد بتاريخ يقع فيها — الحماية على مستوى قاعدة البيانات نفسها وتشمل كل الوحدات (فواتير، مصروفات، خزينة...). أقفل الشهر بعد مراجعة قيوده وإصدار تقاريره.
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
          <div style={{ width: '28px', height: '28px', border: '3px solid var(--border)', borderTopColor: '#c81e1e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {MONTH_NAMES.map((name, i) => {
            const month     = i + 1
            const isClosed  = !!closed[month]
            const isCurrent = year === currentYear && month === currentMonth
            const isFuture  = year > currentYear || (year === currentYear && month > currentMonth)
            return (
              <div key={month} className="card" style={{
                padding: '16px',
                borderTop: '3px solid ' + (isClosed ? '#c81e1e' : isCurrent ? '#0ea77b' : 'var(--border)'),
                opacity: isFuture && !isClosed ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isClosed ? '🔒' : '🔓'} {name}
                      {isCurrent && <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '10px', background: '#ecfdf5', color: '#0ea77b', fontWeight: 700 }}>الحالي</span>}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>
                      {counts[month] ? `${counts[month]} قيد` : 'لا قيود'}
                    </div>
                    {isClosed && closed[month].closed_at && (
                      <div style={{ fontSize: '0.66rem', color: '#c81e1e', marginTop: '3px' }}>
                        أُقفلت {new Date(closed[month].closed_at!).toLocaleDateString('en-GB')}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => toggleMonth(month)} disabled={working === month}
                  style={{
                    marginTop: '12px', width: '100%', padding: '7px', borderRadius: '8px', cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: 700, transition: 'all 0.15s',
                    border: '1px solid ' + (isClosed ? '#bbf7d0' : '#fecaca'),
                    background: isClosed ? '#ecfdf5' : '#fef2f2',
                    color: isClosed ? '#0ea77b' : '#c81e1e',
                  }}>
                  {working === month ? '...' : isClosed ? '🔓 فتح الفترة' : '🔒 إقفال الفترة'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ════════════════════════════════════════
// الصفحة
// ════════════════════════════════════════
export default function FiscalPeriodsPage() {
  const { tenant } = useStore()
  if (!tenant) return <Spinner />
  return <FiscalPeriodsTab tenantId={tenant.id} />
}
