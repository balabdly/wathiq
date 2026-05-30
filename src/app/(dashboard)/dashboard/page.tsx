'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { projectsApi, visitsApi, materialsApi } from '@/lib/db'
import {
  FolderOpen, AlertTriangle, Package, CheckCircle2,
  Clock, TrendingUp, ArrowLeft, Shield
} from 'lucide-react'
import Link from 'next/link'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { DashboardStats } from '@/types'

const COLORS = ['#1a56db', '#0ea77b', '#c81e1e', '#e6820a']

export default function DashboardPage() {
  const { currentUser, tenant, activeBranch, projects, visits, materials,
          setProjects, setVisits, setMaterials } = useStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (tenant && activeBranch) loadData()
  }, [tenant?.id, activeBranch?.id])

  async function loadData() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    try {
      const [p, v, m] = await Promise.all([
        projectsApi.getAll(tenant.id, activeBranch.id),
        visitsApi.getAll(tenant.id, activeBranch.id),
        materialsApi.getAll(tenant.id, activeBranch.id),
      ])
      setProjects(p.data || [])
      setVisits(v.data || [])
      setMaterials(m.data || [])

      const now = new Date(); now.setHours(0,0,0,0)
      const proj = p.data || []
      const vis  = v.data  || []
      const mats = m.data  || []

      const delayed = proj.filter(pr => {
        if (pr.progress >= 100) return false
        if (!pr.end_date) return pr.status === 'متأخر'
        return new Date(pr.end_date) < now
      })

      setStats({
        activeProjects:   proj.filter(pr => pr.status !== 'مكتمل').length,
        delayedProjects:  delayed.length,
        openNcr:          vis.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length,
        lowMaterials:     mats.filter(m => m.qty <= m.reorder).length,
        totalVisits:      vis.length,
        expiredQhse:      0,
        soonExpiredQhse:  0,
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  const now = new Date(); now.setHours(0,0,0,0)
  const delayed = projects.filter(p => {
    if (p.progress >= 100) return false
    if (!p.end_date) return p.status === 'متأخر'
    return new Date(p.end_date) < now
  })
  const upcoming = projects.filter(p => {
    if (!p.end_date || p.progress >= 100) return false
    const diff = (new Date(p.end_date).getTime() - now.getTime()) / 86400000
    return diff >= 0 && diff <= 30
  }).sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime())
  const openNcr = visits.filter(v => v.specs === 'غير مطابق' && !v.resolved_report)
  const lowMats = materials.filter(m => m.qty <= m.reorder).sort((a, b) => a.qty - b.qty)

  // بيانات المخططات
  const statusData = [
    { name: 'قيد التنفيذ', value: projects.filter(p => p.status === 'قيد التنفيذ').length },
    { name: 'مكتمل',       value: projects.filter(p => p.progress >= 100).length },
    { name: 'متأخر',       value: delayed.length },
    { name: 'تخطيط',       value: projects.filter(p => p.status === 'تحت التخطيط').length },
  ].filter(d => d.value > 0)

  const progressData = projects.slice(0, 8).map(p => ({
    name: p.name.substring(0, 10) + (p.name.length > 10 ? '…' : ''),
    progress: p.progress,
    fill: p.progress >= 100 ? '#0ea77b' : delayed.find(d => d.id === p.id) ? '#c81e1e' : '#1a56db'
  }))

  const greeting = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير'

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {greeting}، {currentUser?.name.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {activeBranch?.name} · {new Date().toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="المشاريع النشطة"
          value={stats?.activeProjects || 0}
          sub={stats?.delayedProjects ? `${stats.delayedProjects} متأخر ⚠` : 'كلها في الوقت'}
          subColor={stats?.delayedProjects ? 'text-red-500' : 'text-emerald-500'}
          icon={<FolderOpen className="w-5 h-5" />}
          color="blue"
          href="/projects"
        />
        <KpiCard
          label="NCR معلقة"
          value={stats?.openNcr || 0}
          sub={stats?.openNcr ? 'تحتاج إجراء تصحيحي' : 'لا توجد ملاحظات'}
          subColor={stats?.openNcr ? 'text-red-500' : 'text-emerald-500'}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={stats?.openNcr ? 'red' : 'green'}
          href="/visits"
        />
        <KpiCard
          label="مواد منخفضة"
          value={stats?.lowMaterials || 0}
          sub={stats?.lowMaterials ? 'تحت حد الأمان' : 'المخزون آمن'}
          subColor={stats?.lowMaterials ? 'text-amber-500' : 'text-emerald-500'}
          icon={<Package className="w-5 h-5" />}
          color={stats?.lowMaterials ? 'amber' : 'green'}
          href="/inventory"
        />
        <KpiCard
          label="إجمالي الزيارات"
          value={stats?.totalVisits || 0}
          sub={`${visits.filter(v=>v.specs==='مطابق').length} مطابق`}
          subColor="text-emerald-500"
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="green"
          href="/visits"
        />
      </div>

      {/* Alerts + Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertCard
          title="⚠ تنبيهات عاجلة"
          color="red"
          items={[
            ...delayed.map(p => ({
              icon: '🔴',
              text: p.name,
              sub: `متأخر ${Math.round((now.getTime()-new Date(p.end_date!).getTime())/86400000)} يوم`,
              href: '/projects'
            })),
            ...openNcr.slice(0,3).map(v => ({
              icon: '⚠️',
              text: `NCR: ${v.type}`,
              sub: v.date || '',
              href: '/visits'
            })),
          ]}
          emptyMsg="✅ لا توجد تنبيهات عاجلة"
        />
        <AlertCard
          title="📅 مواعيد التسليم"
          color="blue"
          items={upcoming.map(p => {
            const diff = Math.round((new Date(p.end_date!).getTime()-now.getTime())/86400000)
            return {
              icon: diff <= 7 ? '🔴' : diff <= 14 ? '🟡' : '🟢',
              text: p.name,
              sub: diff === 0 ? 'اليوم!' : diff === 1 ? 'غداً' : `${diff} يوم`,
              href: '/projects'
            }
          })}
          emptyMsg="لا توجد مشاريع خلال 30 يوماً"
        />
      </div>

      {/* NCR + Low Materials */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertCard
          title="🔴 NCR معلقة"
          color="red"
          items={openNcr.map(v => ({
            icon: '🔴',
            text: `${v.type} — ${v.date}`,
            sub: v.engineer,
            href: '/visits'
          }))}
          emptyMsg="✅ لا توجد ملاحظات NCR معلقة"
        />
        <AlertCard
          title="⚠ مواد تحت حد الأمان"
          color="amber"
          items={lowMats.slice(0,8).map(m => ({
            icon: m.qty <= 0 ? '⛔' : '⚠️',
            text: m.name,
            sub: `الكمية: ${m.qty} ${m.unit}`,
            href: '/inventory'
          }))}
          emptyMsg="✅ جميع المواد فوق حد الأمان"
        />
      </div>

      {/* Charts */}
      {projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-700 mb-4 text-sm">توزيع حالة المشاريع</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value})=>`${name}: ${value}`} labelLine={false}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-gray-700 mb-4 text-sm">نسب إنجاز المشاريع</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={progressData} layout="vertical">
                <XAxis type="number" domain={[0,100]} tick={{fontSize:11}} />
                <YAxis type="category" dataKey="name" width={80} tick={{fontSize:11}} />
                <Tooltip formatter={(v) => [`${v}%`, 'الإنجاز']} />
                <Bar dataKey="progress" radius={4}>
                  {progressData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ── مكونات مساعدة ──
function KpiCard({ label, value, sub, subColor, icon, color, href }: any) {
  const colors: any = {
    blue:  'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    red:   'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <Link href={href} className="card p-5 hover:shadow-md transition-shadow block">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className={`text-xs mt-1 ${subColor}`}>{sub}</div>
    </Link>
  )
}

function AlertCard({ title, color, items, emptyMsg }: any) {
  const borders: any = {
    red: 'border-red-100 bg-red-50/50',
    blue: 'border-blue-100 bg-blue-50/50',
    amber: 'border-amber-100 bg-amber-50/50',
  }
  return (
    <div className="card overflow-hidden">
      <div className={`px-4 py-3 border-b ${borders[color]}`}>
        <h3 className="font-semibold text-sm text-gray-700">{title}</h3>
      </div>
      <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">{emptyMsg}</p>
        ) : items.map((item: any, i: number) => (
          <Link key={i} href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
            <span className="text-base">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-700 truncate">{item.text}</div>
              <div className="text-xs text-gray-400 mt-0.5">{item.sub}</div>
            </div>
            <ArrowLeft className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
