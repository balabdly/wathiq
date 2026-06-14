'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine,
  RotateCcw, ArrowLeftRight, Warehouse, FolderOpen,
  TrendingUp, TrendingDown, Clock, ChevronLeft
} from 'lucide-react'

const MOVEMENT_META: Record<string, { color: string; bg: string; icon: any; sign: string }> = {
  'استلام':       { color: '#0ea77b', bg: '#ecfdf5', icon: ArrowDownToLine, sign: '+' },
  'صرف':          { color: '#c81e1e', bg: '#fef2f2', icon: ArrowUpFromLine, sign: '-' },
  'إرجاع':        { color: '#7c3aed', bg: '#f5f3ff', icon: RotateCcw,       sign: ''  },
  'إرجاع للعميل': { color: '#7c3aed', bg: '#f5f3ff', icon: RotateCcw,       sign: ''  },
  'تحويل':        { color: '#0891b2', bg: '#ecfeff', icon: ArrowLeftRight,  sign: ''  },
}

const fmt = (n: number) => Number(n).toLocaleString('ar-SA')

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60)  return `منذ ${mins} د`
  if (hours < 24) return `منذ ${hours} س`
  return `منذ ${days} يوم`
}

function KPICard({ label, value, sub, color, bg, icon: Icon, onClick, alert }: any) {
  return (
    <div onClick={onClick} style={{
      background: bg, border: `1px solid ${color}22`, borderRadius: '14px', padding: '20px',
      cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.15s, box-shadow 0.15s',
      position: 'relative',
    }}
      onMouseEnter={e => { if (onClick) { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)' } }}
      onMouseLeave={e => { if (onClick) { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'none' } }}
    >
      {alert && <div style={{ position: 'absolute', top: '12px', left: '12px', width: '8px', height: '8px', borderRadius: '50%', background: '#c81e1e' }} className="pulse-dot" />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: '22px', height: '22px', color }} />
        </div>
        {onClick && <ChevronLeft style={{ width: '16px', height: '16px', color: `${color}88` }} />}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text, #1e293b)', fontWeight: 600, marginTop: '6px' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text3, #94a3b8)', marginTop: '3px' }}>{sub}</div>}
    </div>
  )
}

export default function InventoryOverviewPage() {
  const router = useRouter()
  const { tenant } = useStore()
  const [loading,         setLoading]         = useState(true)
  const [kpis,            setKpis]            = useState({ total: 0, low: 0, out: 0, warehouses: 0, movements: 0, projects: 0 })
  const [recentMovements, setRecentMovements] = useState<any[]>([])
  const [warehouseStats,  setWarehouseStats]  = useState<any[]>([])
  const [alertItems,      setAlertItems]      = useState<any[]>([])
  const [chartData,       setChartData]       = useState<{ label: string; in: number; out: number }[]>([])

  useEffect(() => { if (tenant) loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)

    const [whRes, recentRes, chartRes, projRes, allPrivateRes] = await Promise.all([
      supabase.from('warehouses').select('id, name, location').eq('tenant_id', tenant.id).order('name'),
      supabase.from('stock_ledger').select('id, type, mat_name, unit, qty, wh_name, project_name, created_at')
        .eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(8),
      supabase.from('stock_ledger').select('type, qty, created_at')
        .eq('tenant_id', tenant.id).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      supabase.from('project_materials').select('project_id').eq('tenant_id', tenant.id),
      supabase.from('materials').select('id, name, unit, qty, reorder, source, is_active, warehouse:warehouses(name)')
        .eq('tenant_id', tenant.id).eq('is_active', true),
    ])

    const allMats   = allPrivateRes.data || []
    const privateMats = allMats.filter(m => m.source !== 'SEC')
    const lowItems  = privateMats.filter(m => Number(m.qty) > 0 && Number(m.reorder) > 0 && Number(m.qty) <= Number(m.reorder))
    const outItems  = privateMats.filter(m => Number(m.qty) === 0)
    const whList    = whRes.data || []

    // إحصائيات المستودعات
    const whStats = whList.map(wh => ({
      ...wh,
      total: allMats.filter(m => (m as any).warehouse_id === wh.id).length,
    }))

    // الرسم البياني
    const days: Record<string, { in: number; out: number }> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = d.toLocaleDateString('ar-SA', { weekday: 'short' })
      days[key] = { in: 0, out: 0 }
    }
    ;(chartRes.data || []).forEach((m: any) => {
      const key = new Date(m.created_at).toLocaleDateString('ar-SA', { weekday: 'short' })
      if (!days[key]) return
      if (m.type === 'استلام') days[key].in += Number(m.qty)
      else if (m.type === 'صرف') days[key].out += Number(m.qty)
    })

    // الحركات آخر 7 أيام
    const mov7 = (chartRes.data || []).length

    // المشاريع الفريدة
    const uniqueProjects = new Set((projRes.data || []).map((p: any) => p.project_id)).size

    setKpis({ total: allMats.length, low: lowItems.length, out: outItems.length, warehouses: whList.length, movements: mov7, projects: uniqueProjects })
    setAlertItems([...outItems.slice(0, 4).map(m => ({ ...m, isOut: true })), ...lowItems.slice(0, 4).map(m => ({ ...m, isOut: false }))])
    setRecentMovements(recentRes.data || [])
    setWarehouseStats(whStats)
    setChartData(Object.entries(days).map(([label, v]) => ({ label, ...v })))
    setLoading(false)
  }

  const maxVal = Math.max(...chartData.map(d => Math.max(d.in, d.out)), 1)

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* العنوان */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package style={{ width: '22px', height: '22px', color: '#d97706' }} />
            المخزون — نظرة عامة
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '2px' }}>متابعة المواد والحركات والتنبيهات</p>
        </div>
        <button onClick={loadAll} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RotateCcw style={{ width: '14px', height: '14px' }} /> تحديث
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px' }}>
        <KPICard label="إجمالي المواد"       value={fmt(kpis.total)}     sub="مادة نشطة في المخزون"    color="#1a56db" bg="#eff6ff" icon={Package}      onClick={() => router.push('/inventory/materials')} />
        <KPICard label="تحت حد الأمان"       value={fmt(kpis.low)}      sub="تحتاج إعادة طلب"          color="#d97706" bg="#fffbeb" icon={TrendingDown}  onClick={() => router.push('/inventory/materials')} alert={kpis.low > 0} />
        <KPICard label="نفذت من المخزون"     value={fmt(kpis.out)}      sub="مواد رصيدها صفر"           color="#c81e1e" bg="#fef2f2" icon={AlertTriangle} onClick={() => router.push('/inventory/materials')} alert={kpis.out > 0} />
        <KPICard label="حركات هذا الأسبوع"   value={fmt(kpis.movements)} sub="آخر 7 أيام"               color="#0891b2" bg="#ecfeff" icon={TrendingUp}   onClick={() => router.push('/inventory/movements')} />
        <KPICard label="المستودعات"           value={fmt(kpis.warehouses)} sub="مستودع نشط"             color="#7c3aed" bg="#f5f3ff" icon={Warehouse}     onClick={() => router.push('/inventory/warehouses')} />
        <KPICard label="مشاريع بمواد"         value={fmt(kpis.projects)}  sub="مشروع عليه مواد"          color="#0f766e" bg="#f0fdfa" icon={FolderOpen}   onClick={() => router.push('/inventory/projects')} />
      </div>

      {/* صف التنبيهات + الرسم البياني */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* التنبيهات */}
        <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <AlertTriangle style={{ width: '16px', height: '16px', color: '#c81e1e' }} /> تنبيهات المخزون
            </div>
            <button onClick={() => router.push('/inventory/materials')} style={{ fontSize: '0.75rem', color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer' }}>عرض الكل ←</button>
          </div>
          {alertItems.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>كل المواد ضمن الحدود الآمنة</div>
            </div>
          ) : alertItems.map((m: any, i) => (
            <div key={i} style={{ padding: '12px 18px', borderBottom: '1px solid var(--bg2, #f8fafc)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{(m.warehouse as any)?.name || '—'}</div>
              </div>
              <div style={{ textAlign: 'center', margin: '0 12px' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: m.isOut ? '#c81e1e' : '#d97706' }}>{m.isOut ? '٠' : fmt(Number(m.qty))}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{m.unit}</div>
              </div>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', background: m.isOut ? '#fef2f2' : '#fffbeb', color: m.isOut ? '#c81e1e' : '#d97706' }}>
                {m.isOut ? 'نفذ' : 'منخفض'}
              </span>
            </div>
          ))}
        </div>

        {/* الرسم البياني */}
        <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <TrendingUp style={{ width: '16px', height: '16px', color: '#0ea77b' }} /> حركة المواد — آخر 7 أيام
            </div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              {[['#0ea77b', 'استلام'], ['#c81e1e', 'صرف']].map(([color, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--text3)' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: color }} /> {label}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
              {chartData.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '4px' }}>
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', width: '100%' }}>
                    <div title={`استلام: ${d.in}`} style={{ flex: 1, background: '#0ea77b', borderRadius: '3px 3px 0 0', height: `${Math.max(2, (d.in / maxVal) * 100)}px`, transition: 'height 0.4s' }} />
                    <div title={`صرف: ${d.out}`}   style={{ flex: 1, background: '#c81e1e', borderRadius: '3px 3px 0 0', height: `${Math.max(2, (d.out / maxVal) * 100)}px`, transition: 'height 0.4s' }} />
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* آخر الحركات */}
      <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Clock style={{ width: '16px', height: '16px', color: '#0891b2' }} /> آخر الحركات
          </div>
          <button onClick={() => router.push('/inventory/movements')} style={{ fontSize: '0.75rem', color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer' }}>عرض الكل ←</button>
        </div>
        {recentMovements.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.875rem' }}>لا توجد حركات بعد</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2, #f8fafc)' }}>
                  {['النوع', 'المادة', 'الكمية', 'المستودع', 'المشروع', 'الوقت'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentMovements.map((m: any, i) => {
                  const mv = MOVEMENT_META[m.type] || { color: '#6b7280', bg: '#f9fafb', icon: Package, sign: '' }
                  const MvIcon = mv.icon
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--bg2, #f8fafc)' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: mv.bg, color: mv.color, borderRadius: '20px', padding: '3px 10px', fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                          <MvIcon style={{ width: '12px', height: '12px' }} /> {m.type}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontWeight: 600 }}>{m.mat_name}</td>
                      <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 700, color: mv.color }}>
                        {mv.sign}{fmt(Number(m.qty))} {m.unit}
                      </td>
                      <td style={{ padding: '11px 14px', color: 'var(--text3)' }}>{m.wh_name || '—'}</td>
                      <td style={{ padding: '11px 14px', color: 'var(--text3)' }}>{m.project_name || '—'}</td>
                      <td style={{ padding: '11px 14px', color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{timeAgo(m.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* المستودعات */}
      <div style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Warehouse style={{ width: '16px', height: '16px', color: '#7c3aed' }} /> المستودعات
          </div>
          <button onClick={() => router.push('/inventory/warehouses')} style={{ fontSize: '0.75rem', color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer' }}>إدارة ←</button>
        </div>
        {warehouseStats.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.875rem' }}>
            لا توجد مستودعات — <button onClick={() => router.push('/inventory/warehouses')} style={{ color: '#1a56db', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>أضف مستودعاً</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1px', background: 'var(--border)' }}>
            {warehouseStats.map((wh: any) => (
              <div key={wh.id} onClick={() => router.push('/inventory/warehouses')} style={{ background: 'var(--card-bg, white)', padding: '16px 20px', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2, #f8fafc)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--card-bg, white)'}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '4px' }}>{wh.name}</div>
                {wh.location && <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '8px' }}>📍 {wh.location}</div>}
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7c3aed' }}>{wh.total}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>مادة</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pulse-dot { animation: pulse-anim 2s infinite; }
        @keyframes pulse-anim { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.4); } }
      `}</style>
    </div>
  )
}
