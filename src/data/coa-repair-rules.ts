/**
 * قواعد إصلاح شجرة الحسابات للشركات ذات الهيكل القديم (5 جذور رئيسية)
 * 1000 الأصول | 2000 الخصوم | 3000 حقوق الملكية | 4000 الإيرادات | 5000 المصروفات
 */
import { CHART_OF_ACCOUNTS_SEED } from '@/data/chart-of-accounts-seed'

/** حسابات أُدرجت بدون أب — يجب ربطها فوراً */
export const ORPHAN_PARENT_FIX: Record<string, string> = {
  '1250': '1200',
  '1310': '1300',
  '2160': '2100',
  '2320': '2300',
  '2420': '2400',
  '4110': '4100',
  '5240': '5200', // في الهيكل القديم تحت مصروفات الموظفين
}

/** في الهيكل القديم: حسابات كانت جذراً مستقلاً → تُنقل تحت الجذر الرئيسي */
export const LEGACY_NEST_UNDER: Record<string, string> = {
  '1500': '1000',
  '1600': '1000',
  '1700': '1000',
  '1800': '1000',
  '2500': '2000',
  '5500': '5000',
  '5600': '5000',
  '5700': '5000',
  '5800': '5000',
  '6000': '5000',
}

export type CoaRepairRule = {
  code: string
  name: string
  name_en: string
  account_type: string
  normal_balance: string
  is_parent: boolean
  level: number
  parent_code: string | null
}

/** قواعد الإصلاح الكاملة — من الشجرة المعيارية + تعديلات الهيكل القديم */
export function buildCoaRepairRules(isLegacy5Root: boolean): CoaRepairRule[] {
  return CHART_OF_ACCOUNTS_SEED.map(acc => {
    let parentCode = acc.parent_code ?? null
    let level = acc.level

    if (ORPHAN_PARENT_FIX[acc.code]) {
      parentCode = ORPHAN_PARENT_FIX[acc.code]
    } else if (isLegacy5Root && LEGACY_NEST_UNDER[acc.code]) {
      parentCode = LEGACY_NEST_UNDER[acc.code]
      if (acc.level === 1) level = 2
    }

    return {
      code: acc.code,
      name: acc.name,
      name_en: acc.name_en,
      account_type: acc.account_type,
      normal_balance: acc.normal_balance,
      is_parent: acc.is_parent,
      level,
      parent_code: parentCode,
    }
  })
}

/** أسماء خاطئة / مكررة شائعة في البيانات القديمة */
export const COA_NAME_FIXES: { code: string; wrongName: string; correctName: string; correctNameEn: string }[] = [
  { code: '1200', wrongName: 'الأصول الثابتة', correctName: 'الذمم المدينة', correctNameEn: 'Accounts Receivable' },
  { code: '2200', wrongName: 'الخصوم طويلة الأجل', correctName: 'القروض قصيرة الأجل', correctNameEn: 'Short-term Loans' },
]
