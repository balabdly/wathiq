'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { projectsApi, visitsApi, materialsApi, ledgerApi } from '@/lib/db'
import { formatDate, formatCurrency, daysUntil } from '@/lib/utils'
import { BarChart3, Download, TrendingUp, FolderOpen, ClipboardCheck, Package } from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid, Legend
} from 'recharts'

const COLORS = ['#1a56db', '#0ea77b', '#c81e1e', '#e6820a', '#8b5cf6', '#ec4899']

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="text-primary-500">{icon}</span>
        <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function ReportsPage() {
  const { tenant, activeBranch, projects, visits, materials, setProjects, setVisits, setMaterials } = useStore()
  const [loading, setLoading] = useState(true)
  const [ledger, setLedger]   = useState<any[]>([])

  useEffect(() => { loadData() }, [tenant?.id, activeBranch?.id])

  async function loadData() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const [p, v, m, l] = await Promise.all([
      projectsApi.getAll(tenant.id, activeBranch.id),
      visitsApi.getAll(tenant.id, activeBranch.id),
      materialsApi.getAll(tenant.id, activeBranch.id),
      ledgerApi.getRecent(tenant.id, activeBranch.id, 200),
    ])
    setProjects(p.data || [])
    setVisits(v.data || [])
    setMaterials(m.data || [])
    setLedger(l.data || [])
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  const now = new Date(); now.setHours(0,0,0,0)

  // ── Projects analytics ──
  const projByStatus = [
    { name: 'قيد التنفيذ', value: projects.filter(p => p.status === 'قيد التنفيذ').length },
    { name: 'مكتمل',       value: projects.filter(p => p.progress >= 100).length },
    { name: 'متأخر',       value: projects.filter(p => { if (p.progress >= 100 || !p.end_date) return false; return new Date(p.end_date) < now }).length },
    { name: 'تخطيط',       value: projects.filter(p => p.status === 'تحت التخطيط').length },
    { name: 'موقوف',       value: projects.filter(p => p.status === 'موقوف').length },
  ].filter(d => d.value > 0)

  const projByType = Array.from(new Set(projects.map(p => p.type).filter(Boolean))).map(type => ({
    name: type as string,
    value: projects.filter(p => p.type === type).length,
  }))

  const progressData = [...projects]
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 10)
    .map(p => ({
      name: p.name.length > 12 ? p.name.substring(0, 12) + '…' : p.name,
      progress: p.progress,
      fill: p.progress >= 100 ? '#0ea77b' : '#1a56db',
    }))

  const totalValue = projects.reduce((s, p) => s + (p.value || 0), 0)

  // ── Visits analytics ──
  const visitsByType = ['جودة','سلامة','كهربائية','ميدانية'].map(type => ({
    name: type,
    مطابق: visits.filter(v => v.type === type && v.specs === 'مطابق').length,
    'غير مطابق': visits.filter(v => v.type === type && v.specs === 'غير مطابق').length,
  })).filter(d => d.مطابق + d['غير مطابق'] > 0)

  const openNCR   = visits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length
  const closedNCR = visits.filter(v => v.specs === 'غير مطابق' && v.resolved_report).length

  // ── Materials analytics ──
  const lowMats = materials.filter(m => m.qty <= m.reorder).length
  const emptyMats = materials.filter(m => m.qty <= 0).length

  // ── Ledger monthly summary ──
  const monthlyLedger = (() => {
    const map: Record<string, { توريد: number; صرف: number }> = {}
    ledger.forEach(l => {
      const month = l.created_at?.substring(0, 7) || ''
      if (!map[month]) map[month] = { توريد: 0, صرف: 0 }
      if (l.type === 'توريد') map[month].توريد += l.qty
      if (l.type === 'صرف')   map[month].صرف   += l.qty
    })
    return Object.entries(map).sort().slice(-6).map(([month, d]) => ({
      name: month,
      ...d,
    }))
  })()

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            التقارير والإحصائيات
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">نظرة شاملة على أداء المنشأة</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي المشاريع', value: projects.length, sub: `${projects.filter(p=>p.progress>=100).length} مكتمل`, icon: <FolderOpen className="w-5 h-5" />, color: 'blue' },
          { label: 'قيمة المشاريع', value: formatCurrency(totalValue), sub: `${projects.filter(p=>p.status==='قيد التنفيذ').length} نشط`, icon: <TrendingUp className="w-5 h-5" />, color: 'green' },
          { label: 'إجمالي الزيارات', value: visits.length, sub: `${openNCR} NCR معلقة`, icon: <ClipboardCheck className="w-5 h-5" />, color: openNCR > 0 ? 'red' : 'green' },
          { label: 'مواد المخزون', value: materials.length, sub: `${lowMats} تحت الحد`, icon: <Package className="w-5 h-5" />, color: lowMats > 0 ? 'amber' : 'green' },
        ].map(kpi => {
          const colors: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-600' }
          return (
            <div key={kpi.label} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500">{kpi.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[kpi.color]}`}>{kpi.icon}</div>
              </div>
              <div className="text-xl font-bold text-gray-800">{kpi.value}</div>
              <div className="text-xs text-gray-400 mt-1">{kpi.sub}</div>
            </div>
          )
        })}
      </div>

      {/* Projects Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="توزيع حالة المشاريع" icon={<FolderOpen className="w-4 h-4" />}>
          {projByStatus.length === 0 ? <p className="text-center text-gray-400 py-8">لا توجد بيانات</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={projByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {projByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="نسب إنجاز المشاريع" icon={<FolderOpen className="w-4 h-4" />}>
          {progressData.length === 0 ? <p className="text-center text-gray-400 py-8">لا توجد بيانات</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={progressData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={85} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => [`${v}%`, 'الإنجاز']} />
                <Bar dataKey="progress" radius={4}>
                  {progressData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* Visits Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="الزيارات حسب النوع والنتيجة" icon={<ClipboardCheck className="w-4 h-4" />}>
          {visitsByType.length === 0 ? <p className="text-center text-gray-400 py-8">لا توجد بيانات</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={visitsByType}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="مطابق" fill="#0ea77b" radius={[4,4,0,0]} />
                <Bar dataKey="غير مطابق" fill="#c81e1e" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="حالة NCR" icon={<ClipboardCheck className="w-4 h-4" />}>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
              <div>
                <div className="font-bold text-2xl text-red-600">{openNCR}</div>
                <div className="text-sm text-red-500 mt-0.5">NCR معلقة — تحتاج إجراء</div>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl">⚠️</div>
            </div>
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div>
                <div className="font-bold text-2xl text-emerald-600">{closedNCR}</div>
                <div className="text-sm text-emerald-500 mt-0.5">NCR مغلقة</div>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl">✅</div>
            </div>
            {visits.length > 0 && (
              <div className="text-center text-sm text-gray-400">
                نسبة المطابقة: <span className="font-bold text-emerald-600">
                  {Math.round(visits.filter(v=>v.specs==='مطابق').length / visits.length * 100)}%
                </span>
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Inventory */}
      {monthlyLedger.length > 0 && (
        <Section title="حركات المخزون الشهرية" icon={<Package className="w-4 h-4" />}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyLedger}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="توريد" fill="#0ea77b" radius={[4,4,0,0]} />
              <Bar dataKey="صرف" fill="#1a56db" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Projects table */}
      {projects.length > 0 && (
        <Section title="تفاصيل المشاريع" icon={<FolderOpen className="w-4 h-4" />}>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المشروع</th>
                  <th>النوع</th>
                  <th>الحالة</th>
                  <th>الإنجاز</th>
                  <th>التسليم</th>
                  <th>القيمة</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const days = daysUntil(p.end_date)
                  const isLate = days !== null && days < 0 && p.progress < 100
                  return (
                    <tr key={p.id}>
                      <td className="font-medium text-gray-800 text-sm">{p.name}</td>
                      <td><span className="badge badge-blue text-xs">{p.type || '—'}</span></td>
                      <td>
                        <span className={`badge text-xs ${p.progress >= 100 ? 'badge-green' : isLate ? 'badge-red' : 'badge-blue'}`}>
                          {p.progress >= 100 ? 'مكتمل' : isLate ? 'متأخر' : p.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                            <div className={`h-full rounded-full ${p.progress>=100 ? 'bg-emerald-500' : isLate ? 'bg-red-400' : 'bg-primary-500'}`}
                              style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="text-xs font-bold text-gray-600">{p.progress}%</span>
                        </div>
                      </td>
                      <td className={`text-sm ${isLate ? 'text-red-500 font-medium' : 'text-gray-500'}`}>{formatDate(p.end_date)}</td>
                      <td className="text-sm text-gray-600">{p.value ? formatCurrency(p.value) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}
