import { supabase } from '@/lib/supabase'
import {
  FLEET_CATEGORIES, FLEET_SUB_CATEGORIES, FLEET_STATUSES,
  ensureDvirTemplates,
} from '@/lib/fleet-types'

export const FLEET_IMPORT_COLUMNS = [
  'اسم المعدة',
  'الفئة',
  'التصنيف التشغيلي',
  'اللوحة',
  'رقم الشاسيه',
  'الشركة المصنعة',
  'الموديل',
  'سنة الصنع',
  'ساعات العداد',
  'كيلومتر',
  'الحالة',
  'رقم الأصل المحاسبي',
  'ملاحظات',
] as const

export const FLEET_IMPORT_REQUIRED = ['اسم المعدة', 'الفئة'] as const

export type FleetImportRow = {
  rowIndex: number
  valid: boolean
  errors: string[]
  payload?: Record<string, unknown>
  preview: {
    name: string
    category: string
    sub_category: string
    plate_no: string
  }
}

const CATEGORY_ALIASES: Record<string, string> = {
  'معدات ثقيلة': 'معدات ثقيلة',
  'معدات': 'معدات ثقيلة',
  'معدة': 'معدات ثقيلة',
  'heavy': 'معدات ثقيلة',
  'شاحنة': 'شاحنة',
  'شاحنات': 'شاحنة',
  'truck': 'شاحنة',
  'قلاب': 'شاحنة',
  'سيارة': 'سيارة',
  'سيارات': 'سيارة',
  'car': 'سيارة',
  'مركبة': 'سيارة',
}

function str(v: unknown): string {
  return String(v ?? '').trim()
}

function num(v: unknown): number {
  const n = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : NaN
}

function normalizeCategory(raw: string): string | null {
  const key = raw.trim().toLowerCase()
  for (const [alias, cat] of Object.entries(CATEGORY_ALIASES)) {
    if (alias.toLowerCase() === key || cat === raw.trim()) return cat
  }
  if ((FLEET_CATEGORIES as readonly string[]).includes(raw.trim())) return raw.trim()
  return null
}

function primaryMeterForCategory(category: string): string {
  if (category === 'سيارة') return 'كم'
  if (category === 'شاحنة') return 'كم'
  return 'ساعات'
}

export function parseFleetImportRow(
  raw: Record<string, unknown>,
  rowIndex: number,
  assetNoToId: Map<string, number>,
): FleetImportRow {
  const errors: string[] = []
  const name = str(raw['اسم المعدة'])
  const categoryRaw = str(raw['الفئة'])
  const subRaw = str(raw['التصنيف التشغيلي']) || 'أخرى'
  const plate = str(raw['اللوحة'])
  const chassis = str(raw['رقم الشاسيه'])
  const make = str(raw['الشركة المصنعة'])
  const model = str(raw['الموديل'])
  const yearRaw = str(raw['سنة الصنع'])
  const hoursRaw = str(raw['ساعات العداد'])
  const kmRaw = str(raw['كيلومتر'])
  const statusRaw = str(raw['الحالة']) || 'متاح'
  const assetNo = str(raw['رقم الأصل المحاسبي'])
  const notes = str(raw['ملاحظات'])

  if (!name) errors.push('اسم المعدة مطلوب')
  if (name.startsWith('#')) errors.push('صف تعليمات — تُتخطى')

  const category = categoryRaw ? normalizeCategory(categoryRaw) : null
  if (!categoryRaw) errors.push('الفئة مطلوبة')
  else if (!category) errors.push(`الفئة "${categoryRaw}" غير معروفة — استخدم: معدات ثقيلة | شاحنة | سيارة`)

  let sub_category = subRaw
  if (subRaw && !(FLEET_SUB_CATEGORIES as readonly string[]).includes(subRaw)) {
    errors.push(`التصنيف "${subRaw}" غير معروف`)
    sub_category = 'أخرى'
  }

  let operational_status = statusRaw
  if (!(FLEET_STATUSES as readonly string[]).includes(statusRaw)) {
    errors.push(`الحالة "${statusRaw}" غير صحيحة`)
    operational_status = 'متاح'
  }

  let model_year: number | null = null
  if (yearRaw) {
    const y = num(yearRaw)
    if (!Number.isFinite(y) || y < 1970 || y > 2035) errors.push('سنة الصنع غير صحيحة')
    else model_year = Math.round(y)
  }

  const hour_meter = hoursRaw === '' ? 0 : num(hoursRaw)
  if (hoursRaw && !Number.isFinite(hour_meter)) errors.push('ساعات العداد يجب أن تكون رقماً')

  const km_reading = kmRaw === '' ? 0 : num(kmRaw)
  if (kmRaw && !Number.isFinite(km_reading)) errors.push('كيلومتر يجب أن يكون رقماً')

  let asset_id: number | undefined
  if (assetNo) {
    const id = assetNoToId.get(assetNo.toUpperCase())
    if (!id) errors.push(`رقم الأصل "${assetNo}" غير موجود في النظام`)
    else asset_id = id
  }

  const valid = errors.length === 0 && !!name && !!category

  const payload: Record<string, unknown> = {
    name,
    category: category!,
    sub_category,
    plate_no: plate || null,
    chassis_no: chassis || null,
    make: make || null,
    model: model || null,
    model_year,
    primary_meter: primaryMeterForCategory(category!),
    hour_meter: Number.isFinite(hour_meter) ? hour_meter : 0,
    km_reading: Number.isFinite(km_reading) ? km_reading : 0,
    operational_status,
    notes: notes || null,
    is_active: true,
  }
  if (asset_id) payload.asset_id = asset_id

  return {
    rowIndex,
    valid,
    errors,
    payload: valid ? payload : undefined,
    preview: { name, category: category || categoryRaw, sub_category, plate_no: plate },
  }
}

export async function downloadFleetImportTemplate() {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const headers = [...FLEET_IMPORT_COLUMNS]
  const examples = [
    ['حفار كاتربيلر 320D', 'معدات ثقيلة', 'حفر', '', 'CAT0320-001', 'Caterpillar', '320D', 2019, 4200, 0, 'متاح', '', ''],
    ['لودر BOBCAT S650', 'معدات ثقيلة', 'رفع', '', 'BOB-S650-12', 'Bobcat', 'S650', 2021, 2100, 0, 'متاح', '', ''],
    ['قلاب مرسيدس 24M', 'شاحنة', 'نقل', 'أ ب ج 1234', 'WDB123456', 'Mercedes', 'Actros', 2020, 8500, 125000, 'متاح', '', ''],
    ['تريلا flatbed', 'شاحنة', 'نقل', 'د هـ و 5678', '', 'Volvo', 'FH16', 2018, 12000, 98000, 'متاح', '', ''],
    ['بيك أب فورد رanger', 'سيارة', 'فحص', 'ز ط ي 9012', '', 'Ford', 'Ranger', 2022, 0, 45000, 'متاح', '', 'سيارة فحص مواقع'],
    ['تويوتا هايلux', 'سيارة', 'خدمة', 'ح م ن 3456', '', 'Toyota', 'Hilux', 2023, 0, 28000, 'متاح', '', ''],
    ...Array(44).fill(['', 'معدات ثقيلة', 'حفر', '', '', '', '', '', 0, 0, 'متاح', '', '']),
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])
  ws['!cols'] = [
    { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
    { wch: 10 }, { wch: 18 }, { wch: 24 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'الأسطول')

  const wsInfo = XLSX.utils.aoa_to_sheet([
    ['الحقل', 'إلزامي؟', 'القيم المسموحة', 'ملاحظة'],
    ['اسم المعدة', 'نعم', '—', 'اسم واضح — لا يتكرر'],
    ['الفئة', 'نعم', 'معدات ثقيلة | شاحنة | سيارة', 'يمكن كتابة: معدات / شاحنة / سيارة'],
    ['التصنيف التشغيلي', 'لا', FLEET_SUB_CATEGORIES.join(' | '), 'افتراضي: أخرى'],
    ['اللوحة', 'لا', '—', 'مهم للشاحنات والسيارات'],
    ['رقم الشاسيه', 'لا', '—', ''],
    ['الشركة المصنعة', 'لا', '—', ''],
    ['الموديل', 'لا', '—', ''],
    ['سنة الصنع', 'لا', '1970–2035', ''],
    ['ساعات العداد', 'لا', 'رقم', 'للمعدات الثقيلة'],
    ['كيلومتر', 'لا', 'رقم', 'للشاحنات والسيارات'],
    ['الحالة', 'لا', FLEET_STATUSES.join(' | '), 'افتراضي: متاح'],
    ['رقم الأصل المحاسبي', 'لا', 'AST-2026-0001', 'يربط بسجل الأصول إن وُجد'],
    ['ملاحظات', 'لا', '—', ''],
    ['', '', '', ''],
    ['# تلميح', '', '', 'يُولَّد رقم الأسطول تلقائياً (FLT-2026-xxxx) عند الاستيراد'],
    ['# الحد', '', '', 'يمكن استيراد مئات الوحدات دفعة واحدة'],
  ])
  wsInfo['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 45 }, { wch: 35 }]
  XLSX.utils.book_append_sheet(wb, wsInfo, 'تعليمات')

  XLSX.writeFile(wb, 'نموذج_استيراد_الأسطول.xlsx')
}

export async function bulkImportFleetUnits(
  tenantId: string,
  rows: FleetImportRow[],
): Promise<{ imported: number; failed: number; errors: string[] }> {
  const valid = rows.filter(r => r.valid && r.payload)
  if (valid.length === 0) return { imported: 0, failed: 0, errors: ['لا توجد صفوف صالحة'] }

  await ensureDvirTemplates(tenantId)

  const { count } = await supabase
    .from('fleet_units')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  let seq = (count || 0) + 1
  const year = new Date().getFullYear()
  const batch: Record<string, unknown>[] = valid.map(r => ({
    ...r.payload!,
    tenant_id: tenantId,
    fleet_no: `FLT-${year}-${String(seq++).padStart(4, '0')}`,
  }))

  const errors: string[] = []
  let imported = 0
  const CHUNK = 50

  for (let i = 0; i < batch.length; i += CHUNK) {
    const chunk = batch.slice(i, i + CHUNK)
    const { error } = await supabase.from('fleet_units').insert(chunk)
    if (error) {
      errors.push(`دفعة ${Math.floor(i / CHUNK) + 1}: ${error.message}`)
    } else {
      imported += chunk.length
    }
  }

  return { imported, failed: valid.length - imported, errors }
}

export function parseFleetExcelRows(
  json: Record<string, unknown>[],
  assetNoToId: Map<string, number>,
): FleetImportRow[] {
  return json
    .map((raw, i) => parseFleetImportRow(raw, i + 2, assetNoToId))
    .filter(r => r.preview.name.length > 0)
}
