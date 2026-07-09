import { supabase } from '@/lib/supabase'

type AuditParams = {
  tenantId: string
  tableName: string
  recordId?: string | number | null
  action: 'INSERT' | 'UPDATE' | 'DELETE' | string
  oldData?: Record<string, unknown> | null
  newData?: Record<string, unknown> | null
  changedBy?: string | null
}

export async function logAudit(params: AuditParams) {
  const { error } = await supabase.from('wathiq_audit_log').insert({
    tenant_id: params.tenantId,
    table_name: params.tableName,
    record_id: params.recordId != null ? String(params.recordId) : null,
    action: params.action,
    old_data: params.oldData ?? null,
    new_data: params.newData ?? null,
    changed_by: params.changedBy ?? null,
  })
  if (error) console.warn('audit log failed:', error.message)
}
