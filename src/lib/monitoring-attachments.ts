export type MonitoringAttachmentPhase = 'initiation' | 'planning' | 'execution' | 'close' | 'visits' | 'other'

/** تصنيف مرفق المشروع حسب المرحلة — يدعم صيغ «مرحلة — فئة» و«مرحلة البدء —» */
export function categorizeMonitoringAttachment(category: string): MonitoringAttachmentPhase {
  const c = (category || '').trim()
  if (!c) return 'other'
  if (c.startsWith('مرحلة البدء')) return 'initiation'
  if (c.startsWith('التخطيط —') || c.startsWith('التخطيط -')) return 'planning'
  if (c.startsWith('التنفيذ —') || c.startsWith('التنفيذ -')) return 'execution'
  if (c.startsWith('الإغلاق —') || c.startsWith('الإغلاق -')) return 'close'
  if (c.includes('تصريح') || c.includes('جودة') || c.includes('مقايسة') || c.includes('موافقة') || c.includes('مخطط')) {
    return 'planning'
  }
  if (c.includes('تنفيذ') || c.includes('team-logs') || c.includes('team-log')) return 'execution'
  if (c.includes('إغلاق') || c.includes('closure') || c.includes('مستخلص') || c.includes('بلدية') || c.includes('إخلاء')) {
    return 'close'
  }
  return 'other'
}

export function attachmentsForPhase<T extends { category: string }>(
  items: T[],
  phase: Exclude<MonitoringAttachmentPhase, 'visits' | 'other'>,
): T[] {
  return items.filter(a => categorizeMonitoringAttachment(a.category) === phase)
}
