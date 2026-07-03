// src/lib/attachments.ts
// دوال مساعدة لمرفقات وحدة المالية — جدول finance_attachments الموحد
// reference_type: 'فاتورة مبيعات' | 'فاتورة مورد' | 'أمر شراء' | 'مصروف' | 'قيد' ...

import { supabase } from '@/lib/supabase'

export type FinanceAttachment = {
  id?:  number
  name: string
  type: string   // MIME type
  data: string   // base64 data URL
}

// ── تحميل مرفقات مرجع معين ──
export async function loadAttachments(
  tenantId: string,
  refType:  string,
  refId:    number
): Promise<FinanceAttachment[]> {
  const { data, error } = await supabase
    .from('finance_attachments')
    .select('id, file_name, file_type, file_data')
    .eq('tenant_id', tenantId)
    .eq('reference_type', refType)
    .eq('reference_id', refId)
    .order('id')

  if (error) {
    console.error('[attachments] خطأ في التحميل:', error.message)
    return []
  }
  return (data || []).map(r => ({
    id:   r.id,
    name: r.file_name,
    type: r.file_type || '',
    data: r.file_data,
  }))
}

// ── حفظ مرفقات مرجع معين ──
// نفس نمط المشروع في finance_invoice_items: حذف القديم ثم إدراج الحالي
export async function saveAttachments(
  tenantId: string,
  refType:  string,
  refId:    number,
  files:    FinanceAttachment[]
): Promise<boolean> {
  const { error: delError } = await supabase
    .from('finance_attachments')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('reference_type', refType)
    .eq('reference_id', refId)

  if (delError) {
    console.error('[attachments] خطأ في الحذف:', delError.message)
    return false
  }

  if (files.length === 0) return true

  const { error: insError } = await supabase
    .from('finance_attachments')
    .insert(files.map(f => ({
      tenant_id:      tenantId,
      reference_type: refType,
      reference_id:   refId,
      file_name:      f.name,
      file_type:      f.type || null,
      file_data:      f.data,
    })))

  if (insError) {
    console.error('[attachments] خطأ في الإدراج:', insError.message)
    return false
  }
  return true
}
