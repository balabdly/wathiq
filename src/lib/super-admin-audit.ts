import type { SupabaseClient } from '@supabase/supabase-js'

export type SuperAdminAuditAction =
  | 'tenant_created'
  | 'tenant_updated'
  | 'tenant_toggled'
  | 'subscription_extended'
  | 'admin_password_reset'
  | 'maintenance_toggled'
  | 'tenant_exported'

export async function logSuperAdminAction(
  admin: SupabaseClient,
  entry: {
    action: SuperAdminAuditAction
    tenantId?: string | null
    tenantName?: string | null
    details?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await admin.from('platform_audit_log').insert({
      action: entry.action,
      tenant_id: entry.tenantId ?? null,
      tenant_name: entry.tenantName ?? null,
      details: entry.details ?? {},
    })
  } catch (err) {
    console.error('[super-admin-audit]', err)
  }
}
