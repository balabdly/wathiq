import { supabase } from '@/lib/supabase'
import { complianceStatusFromExpiry } from '@/lib/fleet-types'
import { LIFECYCLE_PHASES, pmoPhaseToLifecycle } from '@/lib/project-lifecycle'

export type DashboardStats = {
  projects: {
    active: number
    completed: number
    delayed: number
    byPhase: Record<string, number>
    openRisks: number
    lessons: number
  }
  inventory: {
    warehouses: number
    materials: number
    lowStock: number
    projectCustody: number
  }
  qhse: {
    incidents: number
    openNcr: number
    openCapa: number
    openVisits: number
  }
  hr: {
    totalEmployees: number
    pendingLeaves: number
    draftPayrolls: number
    expiringIqama: number
  }
  finance: {
    monthRevenue: number
    monthExpenses: number
    cashBalance: number
    unpaidInvoices: number
    unpaidVendorInvoices: number
    openPurchaseOrders: number
  }
  assets: {
    total: number
    active: number
    bookValue: number
    maintenanceThisMonth: number
  }
  fleet: {
    totalUnits: number
    available: number
    openWorkOrders: number
    expiringDocs: number
    fuelMonthCost: number
  }
  visits: {
    thisMonth: number
    open: number
    safety: number
    quality: number
  }
  upcomingDeadlines: { name: string; daysLeft: number; id: number }[]
  recentInvoices: { number: string; client: string; amount: number; date: string }[]
}

export async function loadDashboardStats(tenantId: string): Promise<DashboardStats> {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const thisMonth = now.getMonth() + 1
  const thisYear = now.getFullYear()
  const monthStart = `${thisYear}-${String(thisMonth).padStart(2, '0')}-01`
  const today = now.toISOString().split('T')[0]
  const in60Days = new Date(now.getTime() + 60 * 86400000).toISOString().split('T')[0]

  const [
    projRes, risksRes, lessonsRes,
    whRes, matsRes, projMatRes, custodyRes,
    visRes, incRes, capaRes,
    empRes, leaveRes, payrollRes, iqamaRes,
    invoiceRes, expenseRes, cashRes, vendorInvRes, poRes,
    assetRes, maintRes,
    fleetRes, woRes, docRes, fuelRes,
  ] = await Promise.all([
    supabase.from('projects').select('id,name,status,progress,end_date,pmo_phase').eq('tenant_id', tenantId),
    supabase.from('project_risks').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('project_lessons').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('warehouses').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('materials').select('id,qty,reorder').eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('project_materials').select('id,qty,reorder,source').eq('tenant_id', tenantId),
    supabase.from('project_material_loans').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).neq('status', 'مُعاد كلياً'),
    supabase.from('visits').select('id,specs,type,resolved_report,lifecycle,date').eq('tenant_id', tenantId),
    supabase.from('qhse_incidents').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('qhse_capa').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).neq('status', 'مغلق'),
    supabase.from('hr_employees').select('id').eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('hr_leaves').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['معلق', 'بانتظار الموافقة']),
    supabase.from('hr_payroll').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('month', thisMonth).eq('year', thisYear).eq('status', 'مسودة'),
    supabase.from('hr_employees').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true).not('iqama_expiry', 'is', null).lte('iqama_expiry', in60Days),
    supabase.from('finance_invoices').select('invoice_number,total_amount,status,client_name,invoice_date')
      .eq('tenant_id', tenantId).order('invoice_date', { ascending: false }).limit(20),
    supabase.from('finance_expenses').select('total_amount,expense_date').eq('tenant_id', tenantId).gte('expense_date', monthStart),
    supabase.from('finance_cash_accounts').select('id,opening_balance').eq('tenant_id', tenantId),
    supabase.from('finance_vendor_invoices').select('total_amount,status').eq('tenant_id', tenantId).in('status', ['معتمدة', 'مرسلة', 'مدفوعة جزئياً']),
    supabase.from('finance_purchase_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['مسودة', 'مرسل']),
    supabase.from('finance_assets').select('book_value,status').eq('tenant_id', tenantId),
    supabase.from('finance_asset_maintenance').select('cost').eq('tenant_id', tenantId).gte('maintenance_date', monthStart),
    supabase.from('fleet_units').select('id,operational_status').eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('fleet_work_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['مفتوح', 'قيد التنفيذ']),
    supabase.from('fleet_compliance_docs').select('expiry_date,doc_type,is_active').eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('fleet_fuel_logs').select('cost').eq('tenant_id', tenantId).gte('fill_date', monthStart),
  ])

  const payrollSalaryRes = await supabase.from('hr_payroll').select('net_salary')
    .eq('tenant_id', tenantId).eq('month', thisMonth).eq('year', thisYear)

  const proj = projRes.data || []
  const vis = visRes.data || []
  const mats = matsRes.data || []
  const projMats = projMatRes.data || []
  const invs = invoiceRes.data || []
  const exps = expenseRes.data || []
  const assets = assetRes.data || []
  const fleetUnits = fleetRes.data || []

  const delayed = proj.filter(p => {
    if (p.progress >= 100 || p.status === 'مكتمل') return false
    if (!p.end_date) return p.status === 'متأخر'
    return new Date(p.end_date) < now
  })

  const byPhase: Record<string, number> = {}
  for (const phase of LIFECYCLE_PHASES) byPhase[phase.id] = 0
  for (const p of proj) {
    if (p.status === 'مكتمل') continue
    const life = pmoPhaseToLifecycle(p.pmo_phase)
    if (life) byPhase[life] = (byPhase[life] || 0) + 1
  }

  const upcoming = proj.filter(p => {
    if (!p.end_date || p.progress >= 100 || p.status === 'مكتمل') return false
    const diff = (new Date(p.end_date).getTime() - now.getTime()) / 86400000
    return diff >= 0 && diff <= 30
  }).sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime()).slice(0, 5)

  const monthRevenue = invs.filter(i => {
    if (!i.invoice_date) return false
    const d = new Date(i.invoice_date)
    return d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear
  }).reduce((s, i) => s + Number(i.total_amount), 0)

  const payrollTotal = (payrollSalaryRes.data || []).reduce((s, p) => s + Number(p.net_salary), 0)
  const monthExpenses = exps.reduce((s, e) => s + Number(e.total_amount), 0) + payrollTotal
  const cashBalance = (cashRes.data || []).reduce((s, c) => s + Number(c.opening_balance), 0)
  const unpaidInvoices = invs.filter(i => i.status === 'معتمدة' || i.status === 'مرسلة')
    .reduce((s, i) => s + Number(i.total_amount), 0)
  const unpaidVendor = (vendorInvRes.data || []).reduce((s, i) => s + Number(i.total_amount), 0)

  const lowWarehouse = mats.filter(m => Number(m.qty) <= Number(m.reorder) && Number(m.reorder) > 0).length
  const lowProject = projMats.filter(m => m.qty <= m.reorder && m.source !== 'كهرباء').length

  const visitsThisMonth = vis.filter(v => {
    if (!v.date) return false
    const d = new Date(v.date)
    return d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear
  })

  const docs = docRes.data || []
  const expiringDocs = docs.filter(d => {
    const st = complianceStatusFromExpiry(d.expiry_date, d.doc_type)
    return st === 'منتهي' || st === 'قريب الانتهاء'
  }).length

  return {
    projects: {
      active: proj.filter(p => p.status !== 'مكتمل').length,
      completed: proj.filter(p => p.status === 'مكتمل').length,
      delayed: delayed.length,
      byPhase,
      openRisks: risksRes.count || 0,
      lessons: lessonsRes.count || 0,
    },
    inventory: {
      warehouses: whRes.count || 0,
      materials: mats.length,
      lowStock: lowWarehouse + lowProject,
      projectCustody: custodyRes.count || 0,
    },
    qhse: {
      incidents: incRes.count || 0,
      openNcr: vis.filter(v => v.specs === 'غير مطابق' && !v.resolved_report).length,
      openCapa: capaRes.count || 0,
      openVisits: vis.filter(v => v.lifecycle !== 'اعتماد').length,
    },
    hr: {
      totalEmployees: (empRes.data || []).length,
      pendingLeaves: leaveRes.count || 0,
      draftPayrolls: payrollRes.count || 0,
      expiringIqama: iqamaRes.count || 0,
    },
    finance: {
      monthRevenue,
      monthExpenses,
      cashBalance,
      unpaidInvoices,
      unpaidVendorInvoices: unpaidVendor,
      openPurchaseOrders: poRes.count || 0,
    },
    assets: {
      total: assets.length,
      active: assets.filter(a => a.status === 'نشط').length,
      bookValue: assets.filter(a => a.status === 'نشط').reduce((s, a) => s + Number(a.book_value), 0),
      maintenanceThisMonth: (maintRes.data || []).reduce((s, m) => s + Number(m.cost), 0),
    },
    fleet: {
      totalUnits: fleetUnits.length,
      available: fleetUnits.filter(u => u.operational_status === 'متاح').length,
      openWorkOrders: woRes.count || 0,
      expiringDocs,
      fuelMonthCost: (fuelRes.data || []).reduce((s, r) => s + Number(r.cost), 0),
    },
    visits: {
      thisMonth: visitsThisMonth.length,
      open: vis.filter(v => v.lifecycle !== 'اعتماد').length,
      safety: vis.filter(v => v.type === 'سلامة').length,
      quality: vis.filter(v => v.type === 'جودة').length,
    },
    upcomingDeadlines: upcoming.map(p => ({
      name: p.name,
      id: p.id,
      daysLeft: Math.round((new Date(p.end_date!).getTime() - now.getTime()) / 86400000),
    })),
    recentInvoices: invs.slice(0, 5).map(i => ({
      number: i.invoice_number,
      client: i.client_name,
      amount: Number(i.total_amount),
      date: i.invoice_date,
    })),
  }
}
