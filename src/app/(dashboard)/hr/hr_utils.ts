import type { GratuityResult } from './hr_types'

/**
 * Saudi Labor Law arts. 84-87, including prorating partial years and the
 * resignation boundary at EXACTLY five years. lastWage is the legally relevant
 * final wage (basic + fixed allowances, subject to documented exceptions).
 */
export function calcGratuity(
  hireDateStr: string,
  lastDayStr: string,
  lastWage: number,
  terminationType: string
): GratuityResult {
  const empty = (msg: string): GratuityResult => ({
    years: 0, months: 0, days: 0, fullAmount: 0, finalAmount: 0,
    reductionPct: 0, reductionLabel: '', breakdown: [], entitlement: msg,
    isEntitled: false,
  })
  const hire = new Date(hireDateStr + 'T00:00:00Z')
  const last = new Date(lastDayStr + 'T00:00:00Z')
  if (!hireDateStr || !lastDayStr || !Number.isFinite(lastWage) || lastWage <= 0 ||
      Number.isNaN(hire.getTime()) || Number.isNaN(last.getTime())) {
    return empty('بيانات غير مكتملة أو غير صالحة')
  }
  if (last <= hire) return empty('تاريخ الإنهاء يجب أن يكون بعد المباشرة')

  const addYears = (d: Date, n: number): Date => {
    const result = new Date(d)
    result.setUTCFullYear(d.getUTCFullYear() + n)
    return result
  }
  let years = last.getUTCFullYear() - hire.getUTCFullYear()
  if (addYears(hire, years) > last) years--
  const anniversary = addYears(hire, years)
  const nextAnniversary = addYears(hire, years + 1)
  const residualFraction = (last.getTime() - anniversary.getTime()) /
    (nextAnniversary.getTime() - anniversary.getTime())
  const serviceYears = years + residualFraction

  let months = (last.getUTCFullYear() - anniversary.getUTCFullYear()) * 12 +
    last.getUTCMonth() - anniversary.getUTCMonth()
  if (last.getUTCDate() < anniversary.getUTCDate()) months--
  months = Math.max(0, Math.min(months, 11))
  const monthAnchor = new Date(anniversary)
  monthAnchor.setUTCMonth(anniversary.getUTCMonth() + months)
  const days = Math.max(0, Math.round((last.getTime() - monthAnchor.getTime()) / 86400000))

  // The first five service years pay half a month's wage per year.
  const initial = Math.min(serviceYears, 5) * lastWage / 2
  const subsequent = Math.max(serviceYears - 5, 0) * lastWage
  const fullAmount = Math.round((initial + subsequent) * 100) / 100

  let reductionFactor = 1
  let entitlement = 'مكافأة وفق المادة 84 من نظام العمل'
  if (terminationType === 'استقالة') {
    reductionFactor = serviceYears < 2 ? 0 : serviceYears <= 5 ? 1/3 : serviceYears < 10 ? 2/3 : 1
    entitlement = 'مكافأة استقالة وفق المادة 85 من نظام العمل'
  } else if (terminationType === 'فصل تأديبي') {
    // Only if the conditions and evidence of Article 80 are documented.
    reductionFactor = 0
    entitlement = 'فصل تأديبي: لا يطبق استثناء المادة 80 إلا بعد التحقق من شروطه'
  } else if (terminationType === 'فصل') {
    // A generic employer dismissal does not automatically forfeit gratuity.
    entitlement = 'فصل من صاحب العمل؛ لا تسقط المكافأة دون ثبوت حالة المادة 80'
  }
  const finalAmount = Math.round(fullAmount * reductionFactor * 100) / 100
  const reductionPct = Math.round((1 - reductionFactor) * 100)
  const breakdown = [
    `أول خمس سنوات (أو جزء منها): ${initial.toFixed(2)} ر.س`,
    `سنوات الخدمة التالية (أو أجزاء منها): ${subsequent.toFixed(2)} ر.س`,
    `إجمالي سنوات الخدمة التقريبي: ${serviceYears.toFixed(4)}`,
  ]
  return {
    years, months, days, fullAmount, finalAmount, reductionPct,
    reductionLabel: reductionPct ? `تخفيض ${reductionPct}% وفق سبب الإنهاء` : '',
    breakdown, entitlement, isEntitled: finalAmount > 0,
  }
}

/** سقف الأجر الخاضع للتأمينات الاجتماعية (GOSI) — ر.س */
export const GOSI_CEILING = 45_000

/** أساس التأمينات: الراتب الأساسي + بدل السكن (بدون بدل النقل) مع تطبيق السقف */
export function gosiContributoryWage(basicSalary: number, housingAllow: number): number {
  return Math.min(basicSalary + housingAllow, GOSI_CEILING)
}

export type GosiScheme = 'existing' | 'new'

/**
 * GOSI branches differ for Saudi participants first covered from 03-Jul-2024
 * with no earlier pension/insurance contribution. Never infer scheme solely
 * from hire_date: the employee may have previously worked elsewhere.
 */
export function calcGOSI(
  nationality: string,
  basicSalary: number,
  housingAllow: number,
  _transportAllow = 0,
  scheme: GosiScheme = 'existing',
  contributionDate = new Date().toISOString().slice(0, 10),
) {
  const base = gosiContributoryWage(basicSalary, housingAllow)
  const round = (amount: number) => Math.round(amount * 100) / 100
  if (nationality !== 'سعودي') {
    return {
      employeeDeduction: 0, employerContribution: round(base * 0.02),
      employeePct: 0, employerPct: 2,
      breakdown: {
        employee: [],
        employer: [{ label: 'أخطار مهنية', pct: '2%', amount: round(base * 0.02) }],
      },
    }
  }
  let pensionPct = 9
  if (scheme === 'new') {
    pensionPct = contributionDate >= '2028-07-01' ? 11
      : contributionDate >= '2027-07-01' ? 10.5
      : contributionDate >= '2026-07-01' ? 10
      : contributionDate >= '2025-07-01' ? 9.5 : 9
  }
  const sandPct = 0.75
  const riskPct = 2
  const pension = round(base * pensionPct / 100)
  const sand = round(base * sandPct / 100)
  const risk = round(base * riskPct / 100)
  return {
    employeeDeduction: round(pension + sand),
    employerContribution: round(pension + sand + risk),
    employeePct: pensionPct + sandPct,
    employerPct: pensionPct + sandPct + riskPct,
    breakdown: {
      employee: [
        { label: 'معاشات', pct: pensionPct + '%', amount: pension },
        { label: 'ساند (تعطل)', pct: '0.75%', amount: sand },
      ],
      employer: [
        { label: 'معاشات', pct: pensionPct + '%', amount: pension },
        { label: 'ساند (تعطل)', pct: '0.75%', amount: sand },
        { label: 'أخطار مهنية', pct: '2%', amount: risk },
      ],
    },
  }
}

/**
 * مخصص مكافأة نهاية الخدمة الشهري (IAS 19 مبسّط)
 * أول 5 سنوات: 15 يوم/سنة ÷ 12 | بعد 5 سنوات: 30 يوم/سنة ÷ 12
 */
export function calcMonthlyEOSProvision(basicSalary: number, hireDateStr: string): number {
  if (!hireDateStr || !basicSalary) return 0
  const hire = new Date(hireDateStr)
  const today = new Date()
  if (today <= hire) return 0
  const years = (today.getTime() - hire.getTime()) / (365.25 * 24 * 3600 * 1000)
  const daily = basicSalary / 30
  const annualDays = years >= 5 ? 30 : 15
  return Math.round(daily * annualDays / 12)
}

// ══════════════════════════════════════
// نافذة إضافة / تعديل موظف
