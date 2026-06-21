import type { GratuityResult } from './hr_types'

export function calcGratuity(
  hireDateStr: string,
  lastDayStr: string,
  basicSalary: number,
  terminationType: string
): GratuityResult {

  const empty = (msg: string): GratuityResult => ({
    years: 0, months: 0, days: 0, fullAmount: 0, finalAmount: 0,
    reductionPct: 0, reductionLabel: '', breakdown: [], entitlement: msg, isEntitled: false
  })

  if (!hireDateStr || !lastDayStr || !basicSalary) return empty('بيانات غير مكتملة')

  const hire = new Date(hireDateStr)
  const last = new Date(lastDayStr)
  if (last <= hire) return empty('تاريخ الإنهاء قبل تاريخ المباشرة')

  // ── حساب مدة الخدمة بدقة ──
  let years = last.getFullYear() - hire.getFullYear()
  let months = last.getMonth() - hire.getMonth()
  let days = last.getDate() - hire.getDate()
  if (days < 0) { months--; days += 30 }
  if (months < 0) { years--; months += 12 }
  const totalMonths = years * 12 + months
  const dailySalary = basicSalary / 30

  // ── تحديد الاستحقاق حسب نوع الإنهاء ──
  // المادة 84: مكافأة كاملة في حالات: إنهاء صاحب العمل، انتهاء العقد، وفاة، عجز
  // المادة 85: مكافأة مخفّضة في حالة الاستقالة
  // المادة 80: لا مكافأة في حالة الفصل بسبب مخالفة جسيمة

  type TermRule = { fullRights: boolean; reduction: (y: number) => number; note: string; minMonths: number }

  const TERM_RULES: Record<string, TermRule> = {
    // ← مكافأة كاملة — صاحب العمل هو المنهي
    'إنهاء عقد من صاحب العمل': { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة — المادة 84', minMonths: 1 },
    'انتهاء عقد':               { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة عند انتهاء مدة العقد — المادة 84', minMonths: 1 },
    'إنهاء باتفاق الطرفين':     { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة باتفاق الطرفين — المادة 84', minMonths: 1 },
    'إحالة للتقاعد':            { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة — إحالة للتقاعد', minMonths: 1 },
    'وفاة':                     { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة — تصرف لورثة الموظف', minMonths: 1 },
    'عجز كلي':                  { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة — عجز كلي عن العمل المادة 84', minMonths: 1 },
    'إغلاق المنشأة':            { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة — إغلاق المنشأة', minMonths: 1 },
    'تغيير جوهري في العقد':     { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة — رفض تغيير جوهري في العقد المادة 81', minMonths: 1 },

    // ← استقالة — مكافأة مخفّضة حسب المادة 85
    'استقالة': {
      fullRights: false,
      reduction: (y: number) => {
        if (y < 2)   return 0      // أقل من سنتين = لا شيء
        if (y < 5)   return 1/3    // 2-5 سنوات = ثلث
        if (y < 10)  return 2/3    // 5-10 سنوات = ثلثان
        return 1                    // 10 سنوات فأكثر = كاملة
      },
      note: 'استقالة — المادة 85 (تُخفَّض حسب سنوات الخدمة)',
      minMonths: 24,
    },

    // ← انتهاء عقد موسمي / جزئي
    'انتهاء عقد موسمي':   { fullRights: true, reduction: () => 1, note: 'مكافأة بنسبة أيام العمل الفعلية', minMonths: 1 },

    // ← فصل تأديبي — لا مكافأة (المادة 80)
    'فصل تأديبي':    { fullRights: false, reduction: () => 0, note: 'لا مكافأة — فصل بسبب مخالفة جسيمة المادة 80', minMonths: 0 },
    'فصل':           { fullRights: false, reduction: () => 0, note: 'لا مكافأة — فصل تأديبي المادة 80', minMonths: 0 },
  }

  const rule = TERM_RULES[terminationType] || { fullRights: true, reduction: () => 1, note: 'مكافأة كاملة', minMonths: 1 }

  // ── حساب المكافأة الكاملة الأساسية ──
  const breakdown: string[] = []
  let fullAmount = 0

  if (totalMonths < rule.minMonths) {
    const msg = rule.minMonths >= 24
      ? `أقل من سنتين خدمة (${years} سنة ${months} شهر) — لا تستحق مكافأة عند الاستقالة`
      : `مدة الخدمة أقل من الحد الأدنى المطلوب`
    return empty(msg)
  }

  // أول 5 سنوات → نصف شهر لكل سنة
  const firstFive = Math.min(years, 5)
  if (firstFive > 0) {
    const a = Math.round(dailySalary * 15 * firstFive)
    fullAmount += a
    breakdown.push(`${firstFive} سنة × 15 يوم (نصف شهر) = ${a.toLocaleString()} ر.س`)
  }

  // بعد 5 سنوات → شهر كامل لكل سنة
  if (years > 5) {
    const extra = years - 5
    const a = Math.round(dailySalary * 30 * extra)
    fullAmount += a
    breakdown.push(`${extra} سنة × 30 يوم (شهر كامل) = ${a.toLocaleString()} ر.س`)
  }

  // الأشهر المتبقية بالنسبة
  if (months > 0) {
    const dayRate = years >= 5 ? 30 : 15
    const a = Math.round(dailySalary * dayRate * months / 12)
    fullAmount += a
    breakdown.push(`${months} شهر متبقي × نسبة = ${a.toLocaleString()} ر.س`)
  }

  // الأيام المتبقية بالنسبة
  if (days > 0 && years >= 1) {
    const dayRate = years >= 5 ? 30 : 15
    const a = Math.round(dailySalary * dayRate * days / 365)
    fullAmount += a
    if (a > 0) breakdown.push(`${days} يوم متبقي = ${a.toLocaleString()} ر.س`)
  }

  // ── تطبيق نسبة التخفيض حسب نوع الإنهاء ──
  const reductionFactor = rule.reduction(years)
  const finalAmount = Math.round(fullAmount * reductionFactor)
  const reductionPct = Math.round((1 - reductionFactor) * 100)

  // وصف الاستحقاق
  let entitlement = rule.note
  if (terminationType === 'استقالة' && reductionFactor < 1 && reductionFactor > 0) {
    entitlement = `استقالة — ${years >= 5 ? 'ثلثا' : 'ثلث'} المكافأة (${100 - reductionPct}%) — المادة 85`
  }

  return {
    years, months, days,
    fullAmount, finalAmount,
    reductionPct,
    reductionLabel: reductionPct > 0 ? `تخفيض ${reductionPct}% بسبب الاستقالة` : '',
    breakdown,
    entitlement,
    isEntitled: finalAmount > 0,
  }
}

export function calcGOSI(nationality: string, basicSalary: number, housingAllow: number, transportAllow: number = 0) {
  const base = basicSalary + housingAllow + transportAllow
  if (nationality === 'سعودي') {
    return {
      employeeDeduction: Math.round(base * 0.0975),
      employerContribution: Math.round(base * 0.1175),
      employeePct: 9.75, employerPct: 11.75,
      breakdown: {
        employee: [
          { label: 'معاشات', pct: '9%', amount: Math.round(base * 0.09) },
          { label: 'ساند (تعطل)', pct: '0.75%', amount: Math.round(base * 0.0075) },
        ],
        employer: [
          { label: 'معاشات', pct: '9%', amount: Math.round(base * 0.09) },
          { label: 'ساند (تعطل)', pct: '1%', amount: Math.round(base * 0.01) },
          { label: 'أخطار مهنية', pct: '1.75%', amount: Math.round(base * 0.0175) },
        ],
      }
    }
  } else {
    return {
      employeeDeduction: 0, employerContribution: Math.round(base * 0.02),
      employeePct: 0, employerPct: 2,
      breakdown: {
        employee: [],
        employer: [{ label: 'أخطار مهنية', pct: '2%', amount: Math.round(base * 0.02) }],
      }
    }
  }
}

// ══════════════════════════════════════
// نافذة إضافة / تعديل موظف
