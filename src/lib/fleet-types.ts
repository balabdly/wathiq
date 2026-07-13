import { supabase } from '@/lib/supabase'

export const FLEET_CATEGORIES = ['معدات ثقيلة', 'شاحنة', 'سيارة'] as const
export type FleetCategory = typeof FLEET_CATEGORIES[number]

export const FLEET_SUB_CATEGORIES = ['حفر', 'نقل', 'رفع', 'فحص', 'تمديد', 'تركيب', 'خدمة', 'أخرى'] as const

export const FLEET_STATUSES = ['متاح', 'مخصص', 'صيانة', 'معطل', 'مستبعد'] as const

export const DVIR_RESULTS = ['سليم', 'ملاحظة', 'موقوف'] as const

export const WORK_TYPES = ['حفر', 'نقل', 'رفع', 'فحص', 'تمديد', 'تركيب', 'أخرى'] as const

export const WO_TYPES = ['PM', 'CM'] as const
export const WO_SOURCES = ['داخلي', 'خارجي'] as const
export const WO_STATUSES = ['مفتوح', 'قيد التنفيذ', 'مكتمل', 'ملغي'] as const

export const COMPLIANCE_TYPES = ['استمارة', 'تأمين', 'فحص دوري', 'شهادة فحص طرف ثالث', 'شهادة رفع', 'أخرى'] as const

export const COMPLIANCE_STATUSES = ['ساري', 'قريب الانتهاء', 'منتهي', 'قيد التجديد', 'مُجدَّد'] as const

export type DvirCheckItem = { id: string; label: string; critical?: boolean }

export const DVIR_TEMPLATES: Record<FleetCategory, { name: string; checklist: DvirCheckItem[] }> = {
  'معدات ثقيلة': {
    name: 'فحص معدات ثقيلة',
    checklist: [
      { id: 'hydraulic', label: 'نظام هيدروليك / زيت', critical: true },
      { id: 'tracks', label: 'سلاسل / إطارات', critical: true },
      { id: 'bucket', label: 'دلو / ذراع / ملحقات', critical: true },
      { id: 'lights', label: 'إنذارات وإضاءة' },
      { id: 'leaks', label: 'تسريبات واضحة', critical: true },
      { id: 'cabin', label: 'مقصورة القيادة / مرايا' },
      { id: 'fire', label: 'طفاية حريق' },
    ],
  },
  'شاحنة': {
    name: 'فحص شاحنات',
    checklist: [
      { id: 'tires', label: 'إطارات وضغط', critical: true },
      { id: 'brakes', label: 'فرامل', critical: true },
      { id: 'lights', label: 'إضاءة وإشارات' },
      { id: 'load', label: 'صندوق / ربط الحمولة', critical: true },
      { id: 'fluids', label: 'زيت / ماء / وقود' },
      { id: 'horn', label: 'بوق ومرايا' },
    ],
  },
  'سيارة': {
    name: 'فحص سيارات',
    checklist: [
      { id: 'tires', label: 'إطارات', critical: true },
      { id: 'brakes', label: 'فرامل', critical: true },
      { id: 'lights', label: 'إضاءة' },
      { id: 'tools', label: 'أدوات فحص / قياس' },
      { id: 'docs', label: 'وثائق المركبة في المركبة' },
      { id: 'clean', label: 'نظافة وسلامة المقصورة' },
    ],
  },
}

export const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  'متاح':   { bg: '#ecfdf5', color: '#0ea77b' },
  'مخصص':   { bg: '#eff6ff', color: '#1a56db' },
  'صيانة':  { bg: '#fffbeb', color: '#e6820a' },
  'معطل':   { bg: '#fef2f2', color: '#c81e1e' },
  'مستبعد': { bg: '#f3f4f6', color: '#6b7280' },
}

export const fmt = (n: number) => Number(n).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

/** Supabase أحياناً يُرجع العلاقة كمصفوفة — نأخذ العنصر الأول */
export function unwrapJoin<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined
  return Array.isArray(value) ? value[0] : value
}

/** تهيئة قوالب DVIR لـ tenant */
export async function ensureDvirTemplates(tenantId: string) {
  const { data: existing } = await supabase
    .from('fleet_dvir_templates')
    .select('category')
    .eq('tenant_id', tenantId)

  const have = new Set((existing || []).map(r => r.category))
  const toInsert = FLEET_CATEGORIES
    .filter(c => !have.has(c))
    .map(c => ({
      tenant_id: tenantId,
      category: c,
      name: DVIR_TEMPLATES[c].name,
      checklist: DVIR_TEMPLATES[c].checklist,
    }))

  if (toInsert.length) {
    await supabase.from('fleet_dvir_templates').insert(toInsert)
  }
}

/** توليد رقم أسطول */
export async function nextFleetNo(tenantId: string): Promise<string> {
  const { count } = await supabase
    .from('fleet_units')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  return `FLT-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
}

/** توليد رقم أمر عمل */
export async function nextWorkOrderNo(tenantId: string): Promise<string> {
  const { count } = await supabase
    .from('fleet_work_orders')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  return `FWO-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
}

/** إنشاء مسودة حادث QHSE عند فحص «موقوف» */
export async function createQhseDraftFromDvir(params: {
  tenantId: string
  branchId?: number
  unitName: string
  fleetNo: string
  operatorName?: string
  projectId?: number
  notes?: string
}): Promise<number | null> {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('qhse_incidents')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', params.tenantId)

  const incidentNo = `INC-${year}-${String((count || 0) + 1).padStart(4, '0')}`
  const { data, error } = await supabase.from('qhse_incidents').insert({
    tenant_id: params.tenantId,
    branch_id: params.branchId || null,
    incident_no: incidentNo,
    incident_date: new Date().toISOString().split('T')[0],
    title: `معدات موقوفة — ${params.unitName} (${params.fleetNo})`,
    incident_type: 'عطل معدات / خطر تشغيل',
    severity: 'متوسط',
    status: 'مسودة — من الأسطول',
    project_id: params.projectId || null,
    description: params.notes || `فحص DVIR: المعدة موقوفة عن التشغيل. المشغّل: ${params.operatorName || '—'}`,
    immediate_action: 'إيقاف التشغيل حتى إغلاق أمر الصيانة',
    reported_by: params.operatorName || 'نظام الأسطول',
  }).select('id').single()

  if (error || !data) return null
  return data.id
}

/** @deprecated استخدم complianceStatusFromExpiry من fleet-compliance.ts */
export function complianceStatusFromExpiry(expiryDate?: string | null, docType?: string): string {
  if (!expiryDate) return 'ساري'
  const exp = new Date(expiryDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = (exp.getTime() - today.getTime()) / 86400000
  if (diff < 0) return 'منتهي'
  const alertDays = docType === 'شهادة فحص طرف ثالث' ? 60 : docType === 'شهادة رفع' ? 45 : 30
  if (diff <= alertDays) return 'قريب الانتهاء'
  return 'ساري'
}
