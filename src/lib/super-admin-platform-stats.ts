import type { SupabaseClient } from '@supabase/supabase-js'
import { ALL_MODULE_KEYS, PLANS, normalizePlan, type TenantModuleKey } from '@/lib/tenant-plans'

export function daysUntilExpiry(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null
  const exp = new Date(expiresAt)
  exp.setHours(23, 59, 59, 999)
  return Math.ceil((exp.getTime() - Date.now()) / 86400000)
}

export async function computePlatformStats(admin: SupabaseClient) {
  const [
    { data: tenants, error: tenantsError },
    { data: employees, error: empError },
    { data: projects, error: projError },
  ] = await Promise.all([
    admin.from('tenants').select('*'),
    admin.from('employees').select('tenant_id, is_active, last_login_at'),
    admin.from('projects').select('tenant_id, status'),
  ])

  if (tenantsError) throw tenantsError
  if (empError) throw empError
  if (projError) throw projError

  const tenantList = tenants || []
  const activeTenants = tenantList.filter(t => t.is_active !== false)
  const expiredTenants = tenantList.filter(t => {
    const d = daysUntilExpiry(t.expires_at)
    return d !== null && d <= 0
  })

  let mrr = 0
  for (const t of activeTenants) {
    const d = daysUntilExpiry(t.expires_at)
    if (d !== null && d <= 0) continue
    const plan = PLANS[normalizePlan(t.plan)]
    mrr += plan?.price || 0
  }

  const activeUsersByTenant = new Map<string, number>()
  const totalLogins7d = { count: 0 }
  const weekAgo = Date.now() - 7 * 86400000

  for (const e of employees || []) {
    if (e.is_active) {
      activeUsersByTenant.set(e.tenant_id, (activeUsersByTenant.get(e.tenant_id) || 0) + 1)
    }
    if (e.last_login_at && new Date(e.last_login_at).getTime() >= weekAgo) {
      totalLogins7d.count++
    }
  }

  const moduleUsage: Record<TenantModuleKey, number> = Object.fromEntries(
    ALL_MODULE_KEYS.map(k => [k, 0]),
  ) as Record<TenantModuleKey, number>

  for (const t of activeTenants) {
    const mods = t.modules || {}
    for (const key of ALL_MODULE_KEYS) {
      if (mods[key] !== false) moduleUsage[key]++
    }
  }

  const topModules = ALL_MODULE_KEYS
    .map(key => ({ key, count: moduleUsage[key] }))
    .sort((a, b) => b.count - a.count)

  const activeProjects = (projects || []).filter(p => p.status !== 'مغلق').length

  const expiringAlerts = {
    expired: [] as { id: string; name: string; days: number }[],
    within7: [] as { id: string; name: string; days: number }[],
    within14: [] as { id: string; name: string; days: number }[],
    within30: [] as { id: string; name: string; days: number }[],
  }

  for (const t of tenantList) {
    const days = daysUntilExpiry(t.expires_at)
    if (days === null) continue
    const row = { id: t.id as string, name: t.name || String(t.id), days }
    if (days <= 0) expiringAlerts.expired.push(row)
    else if (days <= 7) expiringAlerts.within7.push(row)
    else if (days <= 14) expiringAlerts.within14.push(row)
    else if (days <= 30) expiringAlerts.within30.push(row)
  }

  return {
    totalTenants: tenantList.length,
    activeTenants: activeTenants.length,
    suspendedTenants: tenantList.filter(t => t.is_active === false).length,
    expiredTenants: expiredTenants.length,
    maintenanceTenants: tenantList.filter(t => !!(t as { maintenance_mode?: boolean }).maintenance_mode).length,
    totalActiveUsers: Array.from(activeUsersByTenant.values()).reduce((s, n) => s + n, 0),
    loginsLast7Days: totalLogins7d.count,
    activeProjects,
    mrr,
    topModules,
    expiringAlerts,
    userCountsByTenant: Object.fromEntries(activeUsersByTenant),
  }
}
