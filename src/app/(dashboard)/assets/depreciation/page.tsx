'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { TrendingDown, Play, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { journalDepreciation } from '@/lib/journal'
import { getCostCenterIdForProject } from '@/lib/asset-coa'

type Asset = {
  id: number; asset_no: string; name: string; category: string
  monthly_depreciation: number; accumulated_depreciation: number
  book_value: number; total_cost: number; salvage_value: number
  last_depreciation_date?: string; status: string
  expense_account_id?: number; accum_account_id?: number
  project_id?: number
}

type DepLog = {
  id: number; asset_id: number; dep_date: string
  amount: number; month: number; year: number
  accumulated_after: number; book_value_after: number
  asset?: { name: string; asset_no: string }
}

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const fmt = (n: number) => Number(n).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

export default function DepreciationPage() {
  const { tenant } = useStore()
  const today = new Date()
  const [selMonth, setSelMonth] = useState(today.getMonth() + 1)
  const [selYear,  setSelYear]  = useState(today.getFullYear())
  const [assets,   setAssets]   = useState<Asset[]>([])
  const [logs,     setLogs]     = useState<DepLog[]>([])
  const [loading,  setLoading]  = useState(true)
  const [running,  setRunning]  = useState(false)
  const [preview,  setPreview]  = useState<{ asset: Asset; amount: number; already: boolean }[]>([])

  useEffect(() => { if (tenant) loadAll() }, [tenant?.id])
  useEffect(() => { if (assets.length) buildPreview() }, [assets, selMonth, selYear])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [aRes, lRes] = await Promise.all([
      supabase.from('finance_assets').select('*').eq('tenant_id', tenant.id).eq('status', 'نشط').order('asset_no'),
      supabase.from('finance_asset_depreciation').select('*, asset:finance_assets(name,asset_no)')
        .eq('tenant_id', tenant.id).order('dep_date', { ascending: false }).limit(200),
    ])
    setAssets(aRes.data || [])
    setLogs(lRes.data || [])
    setLoading(false)
  }

  function buildPreview() {
    const list = assets.map(a => {
      const alreadyDone = logs.some(l => l.asset_id === a.id && l.month === selMonth && l.year === selYear)
      // حساب الإهلاك — للرصيد المتناقص نحسب من القيمة الدفترية الحالية
      const depAmt = Math.min(
        Number(a.monthly_depreciation),
        Math.max(0, Number(a.book_value) - Number(a.salvage_value))
      )
      return { asset: a, amount: depAmt, already: alreadyDone }
    }).filter(p => p.amount > 0)
    setPreview(list)
  }

  async function runDepreciation() {
    if (!tenant) return
    const pending = preview.filter(p => !p.already)
    if (pending.length === 0) { toast.error('لا توجد أصول تحتاج إهلاكاً لهذا الشهر'); return }
    if (!confirm(`تنفيذ إهلاك ${ARABIC_MONTHS[selMonth-1]} ${selYear} لـ ${pending.length} أصل؟\nإجمالي الإهلاك: ${fmt(pending.reduce((s,p)=>s+p.amount,0))} ر.س`)) return
    setRunning(true)

    const depDate = `${selYear}-${String(selMonth).padStart(2,'0')}-01`
    const monthLabel = `${ARABIC_MONTHS[selMonth - 1]} ${selYear}`

    // جلب أكواد الحسابات
    const accountIds = Array.from(new Set(
      pending.flatMap(p => [p.asset.expense_account_id, p.asset.accum_account_id].filter((id): id is number => Boolean(id)))
    ))
    const { data: accRows } = await supabase.from('finance_accounts').select('id, code').in('id', accountIds)
    const codeMap = Object.fromEntries((accRows || []).map((a: any) => [a.id, a.code]))

    const depLines = (
      await Promise.all(
        pending
          .filter(p => p.asset.expense_account_id && p.asset.accum_account_id && codeMap[p.asset.expense_account_id] && codeMap[p.asset.accum_account_id])
          .map(async p => ({
            expenseCode: codeMap[p.asset.expense_account_id!],
            accumCode:   codeMap[p.asset.accum_account_id!],
            amount:      p.amount,
            description: `إهلاك: ${p.asset.name}`,
            costCenterId: await getCostCenterIdForProject(tenant.id, p.asset.project_id),
          }))
      )
    )

    if (depLines.length > 0) {
      const result = await journalDepreciation({
        tenantId: tenant.id, date: depDate, monthLabel, lines: depLines,
      })
      if (!result) { setRunning(false); return }
    } else {
      toast.error('لا توجد حسابات إهلاك مرتبطة بالأصول — أضف حسابات المصروف والمجمع لكل أصل')
      setRunning(false)
      return
    }

    for (const p of pending) {
      const newAccum    = Number(p.asset.accumulated_depreciation) + p.amount
      const newBookVal  = Math.max(Number(p.asset.salvage_value), Number(p.asset.total_cost) - newAccum)
      const fullyDep    = newBookVal <= Number(p.asset.salvage_value)

      // سجل الإهلاك
      await supabase.from('finance_asset_depreciation').insert({
        tenant_id: tenant.id, asset_id: p.asset.id,
        dep_date: depDate, month: selMonth, year: selYear,
        amount: p.amount, accumulated_after: newAccum, book_value_after: newBookVal,
      })

      // تحديث الأصل
      await supabase.from('finance_assets').update({
        accumulated_depreciation: newAccum,
        book_value: newBookVal,
        last_depreciation_date: depDate,
        status: fullyDep ? 'مُهلَك كلياً' : 'نشط',
      }).eq('id', p.asset.id)
    }

    toast.success(`✅ تم تنفيذ إهلاك ${pending.length} أصل — ${monthLabel}`)
    await loadAll()
    setRunning(false)
  }

  const totalMonthlyDep = preview.reduce((s,p) => s + p.amount, 0)
  const pendingCount    = preview.filter(p => !p.already).length
  const doneCount       = preview.filter(p => p.already).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingDown style={{ width: '20px', height: '20px', color: '#e6820a' }} />
            الإهلاك الشهري
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '2px' }}>حساب وتسجيل إهلاك الأصول الثابتة</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} className="select" style={{ width: 'auto' }}>
            {ARABIC_MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <input type="number" value={selYear} onChange={e => setSelYear(Number(e.target.value))} className="input" style={{ width: '88px' }} min="2020" max="2040" />
          <button onClick={runDepreciation} disabled={running || pendingCount === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: pendingCount > 0 ? 'pointer' : 'not-allowed', background: pendingCount > 0 ? '#e6820a' : '#d1d5db', color: 'white', fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit', opacity: running ? 0.7 : 1 }}>
            {running
              ? <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              : <Play style={{ width: '16px', height: '16px' }} />}
            تنفيذ الإهلاك ({pendingCount} أصل)
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي الإهلاك الشهري', value: fmt(totalMonthlyDep) + ' ر.س', color: '#e6820a', bg: '#fffbeb' },
          { label: 'أصول نشطة',              value: String(assets.length),           color: '#7c3aed', bg: '#f5f3ff', isCount: true },
          { label: 'تم تنفيذ إهلاكها',       value: String(doneCount),               color: '#0ea77b', bg: '#ecfdf5', isCount: true },
          { label: 'تنتظر التنفيذ',           value: String(pendingCount),            color: '#c81e1e', bg: '#fef2f2', isCount: true },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '16px', background: kpi.bg }}>
            <div style={{ fontSize: (kpi as any).isCount ? '2rem' : '1.2rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '3px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* جدول المعاينة */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.9rem' }}>
          معاينة إهلاك {ARABIC_MONTHS[selMonth-1]} {selYear}
        </div>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#e6820a', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : preview.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
            لا توجد أصول نشطة أو تم استنفاد إهلاكها
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['رقم الأصل','الأصل','الفئة','قسط الإهلاك','مجمع الإهلاك','القيمة الدفترية','نسبة الإهلاك','الحالة'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map(({ asset: a, amount, already }) => {
                  const newAccum   = Number(a.accumulated_depreciation) + (already ? 0 : amount)
                  const newBook    = Math.max(Number(a.salvage_value), Number(a.total_cost) - newAccum)
                  const depPct     = Number(a.total_cost) > 0 ? (newAccum / Number(a.total_cost)) * 100 : 0
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--bg2)', background: already ? '#f0fdf4' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = already ? '#dcfce7' : 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = already ? '#f0fdf4' : 'transparent')}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed', fontSize: '0.8rem' }}>{a.asset_no}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{a.name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px', background: '#f5f3ff', color: '#7c3aed', fontWeight: 600 }}>{a.category}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#e6820a', whiteSpace: 'nowrap' }}>{fmt(amount)} ر.س</td>
                      <td style={{ padding: '10px 12px', color: '#e6820a', whiteSpace: 'nowrap' }}>{fmt(newAccum)} ر.س</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1a56db', whiteSpace: 'nowrap' }}>{fmt(newBook)} ر.س</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', minWidth: '60px' }}>
                            <div style={{ height: '100%', borderRadius: '3px', background: depPct >= 90 ? '#c81e1e' : depPct >= 50 ? '#e6820a' : '#7c3aed', width: `${Math.min(depPct, 100)}%` }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{Math.round(depPct)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {already
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#0ea77b', fontWeight: 700 }}>
                              <CheckCircle style={{ width: '14px', height: '14px' }} /> تم التنفيذ
                            </span>
                          : <span style={{ fontSize: '0.75rem', color: '#e6820a', fontWeight: 700 }}>⏳ ينتظر</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700, fontSize: '0.82rem' }}>
                  <td colSpan={3} style={{ padding: '10px 12px' }}>الإجمالي ({preview.length} أصل)</td>
                  <td style={{ padding: '10px 12px', color: '#e6820a' }}>{fmt(totalMonthlyDep)} ر.س</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* سجل الإهلاك السابق */}
      {logs.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.9rem' }}>
            سجل الإهلاك السابق
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['الأصل','الشهر','مبلغ الإهلاك','مجمع بعده','القيمة الدفترية'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.slice(0,50).map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{(l as any).asset?.name || '#' + l.asset_id}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.82rem' }}>{ARABIC_MONTHS[l.month-1]} {l.year}</td>
                    <td style={{ padding: '10px 12px', color: '#e6820a', fontWeight: 700 }}>{fmt(l.amount)} ر.س</td>
                    <td style={{ padding: '10px 12px', color: '#e6820a' }}>{fmt(l.accumulated_after)} ر.س</td>
                    <td style={{ padding: '10px 12px', color: '#1a56db', fontWeight: 700 }}>{fmt(l.book_value_after)} ر.س</td>
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
