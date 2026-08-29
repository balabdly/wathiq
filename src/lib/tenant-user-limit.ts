import type { SupabaseClient } from '@supabase/supabase-js'

export async function countActiveTenantUsers(
  client: SupabaseClient,
  tenantId: string,
): Promise<number> {
  const { count, error } = await client
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (error) throw error
  return count ?? 0
}

export async function assertTenantUserLimit(
  client: SupabaseClient,
  tenantId: string,
  maxUsers: number | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const limit = maxUsers ?? 999
  if (limit >= 999) return { ok: true }

  const active = await countActiveTenantUsers(client, tenantId)
  if (active >= limit) {
    return {
      ok: false,
      error: `وصلت الشركة للحد الأقصى (${limit} مستخدم نشط). رقِّ الخطة أو عطّل مستخدماً.`,
    }
  }
  return { ok: true }
}
