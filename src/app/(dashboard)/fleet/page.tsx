'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Truck, Wrench, AlertTriangle, Fuel, FileWarning, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { fmt, STATUS_STYLE, complianceStatusFromExpiry } from '@/lib/fleet-types'
import { FleetPageHeader } from './FleetPageHeader'

type Unit = { id: number; fleet_no: string; name: string; category: string; operational_status: string }

export default function FleetDashboardPage() {
  const { tenant } = useStore()
  const [units, setUnits] = useState<Unit[]>([])
  const [openWO, setOpenWO] = useState(0)
  const [expiringDocs, setExpiringDocs] = useState(0)
  const [stoppedToday, setStoppedToday] = useState(0)
  const [fuelMonth, setFuelMonth] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (tenant) load() }, [tenant?.id])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'

    const [uRes, woRes, docRes, dvirRes, fuelRes] = await Promise.all([
      supabase.from('fleet_units').select('id,fleet_no,name,category,operational_status')
        .eq('tenant_id', tenant.id).eq('is_active', true).order('fleet_no'),
      supabase.from('fleet_work_orders').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).in('status', ['مفتوح', 'قيد التنفيذ']),
      supabase.from('fleet_compliance_docs').select('expiry_date').eq('tenant_id', tenant.id),
      supabase.from('fleet_dvir_logs').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).eq('check_date', today).eq('result', 'موقوف'),
      supabase.from('fleet_fuel_logs').select('cost').eq('tenant_id', tenant.id).gte('fill_date', monthStart),
    ])

    setUnits(uRes.data || [])
    setOpenWO(woRes.count || 0)
    setStoppedToday(dvirRes.count || 0)
    setFuelMonth((fuelRes.data || []).reduce((s, r) => s + Number(r.cost), 0))

    const docs = docRes.data || []
    setExpiringDocs(docs.filter(d => {
      const st = complianceStatusFromExpiry(d.expiry_date)
      return st === 'منتهي' || st === 'قريب الانتهاء'
    }).length)

    setLoading(false)
  }

  const byStatus = (s: string) => units.filter(u => u.operational_status === s).length
  const byCat = (c: string) => units.filter(u => u.category === c).length

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <FleetPageHeader
        title="لوحة قيادة الأسطول"
        description="متابعة المعدات والشاحنات والسيارات — تشغيل، صيانة، وقود، امتثال"
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'إجمالي الأسطول', value: String(units.length), icon: Truck, color: '#0d9488', bg: '#f0fdfa' },
          { label: 'متاح للتشغيل', value: String(byStatus('متاح')), icon: CheckCircle, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'أوامر عمل مفتوحة', value: String(openWO), icon: Wrench, color: '#e6820a', bg: '#fffbeb' },
          { label: 'موقوف اليوم (DVIR)', value: String(stoppedToday), icon: AlertTriangle, color: '#c81e1e', bg: '#fef2f2' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '16px', background: k.bg }}>
            <k.icon style={{ width: '18px', height: '18px', color: k.color, marginBottom: '6px' }} />
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { label: 'معدات ثقيلة', count: byCat('معدات ثقيلة'), target: 25 },
          { label: 'شاحنات', count: byCat('شاحنة'), target: 10 },
          { label: 'سيارات', count: byCat('سيارة'), target: 20 },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{c.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0d9488', marginTop: '4px' }}>
              {c.count} <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>/ ~{c.target}</span>
            </div>
            <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', marginTop: '8px' }}>
              <div style={{ height: '100%', borderRadius: '3px', background: '#0d9488', width: `${Math.min(100, (c.count / c.target) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <FileWarning style={{ width: '18px', height: '18px', color: '#e6820a' }} />
            <span style={{ fontWeight: 700 }}>تنبيهات الامتثال</span>
            <span style={{ marginRight: 'auto', fontSize: '0.82rem', color: expiringDocs ? '#c81e1e' : '#0ea77b', fontWeight: 700 }}>
              {expiringDocs} وثيقة
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text3)', marginBottom: '10px' }}>استمارات، تأمين، فحص دوري منتهية أو قريبة الانتهاء</p>
          <Link href="/fleet/compliance" style={{ fontSize: '0.82rem', color: '#0d9488', fontWeight: 600 }}>عرض الامتثال ←</Link>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Fuel style={{ width: '18px', height: '18px', color: '#1a56db' }} />
            <span style={{ fontWeight: 700 }}>وقود الشهر الحالي</span>
            <span style={{ marginRight: 'auto', fontWeight: 800, color: '#1a56db' }}>{fmt(fuelMonth)} ر.س</span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text3)', marginBottom: '10px' }}>تسجيل فقط — بدون تحميل تلقائي على المشاريع</p>
          <Link href="/fleet/fuel" style={{ fontSize: '0.82rem', color: '#0d9488', fontWeight: 600 }}>سجل الوقود ←</Link>
        </div>
      </div>

      {units.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.9rem' }}>حالة الأسطول</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  {['الرقم', 'الاسم', 'الفئة', 'الحالة'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {units.slice(0, 15).map(u => {
                  const st = STATUS_STYLE[u.operational_status] || STATUS_STYLE['متاح']
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0d9488' }}>{u.fleet_no}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{u.name}</td>
                      <td style={{ padding: '8px 12px', fontSize: '0.78rem' }}>{u.category}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', background: st.bg, color: st.color, fontWeight: 700 }}>{u.operational_status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {units.length > 15 && (
            <div style={{ padding: '10px 16px', textAlign: 'center' }}>
              <Link href="/fleet/units" style={{ fontSize: '0.82rem', color: '#0d9488' }}>عرض الكل ({units.length})</Link>
            </div>
          )}
        </div>
      )}

      {units.length === 0 && (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <Truck style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af', marginBottom: '12px' }}>لم يُسجَّل أي معدة بعد — ابدأ بإدخال الـ 55 وحدة</p>
          <Link href="/fleet/units" className="btn btn-primary" style={{ background: '#0d9488', display: 'inline-flex' }}>تسجيل أول معدة</Link>
        </div>
      )}
    </div>
  )
}
