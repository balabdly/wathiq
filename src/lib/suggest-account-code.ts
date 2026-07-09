/**
 * توليد كود حساب فرعي تلقائي — خوارزمية موحّدة (شجرة الحسابات / الخزينة / العهد)
 *
 * أول ابن: كود الأب + 1  (مثال: 1110 → 1111)
 * الأبناء التاليون: max(الإخوة) + 1
 */
export function suggestChildAccountCode(
  parentCode: string,
  siblingCodes: string[],
  options?: { excludeCode?: string; allCodes?: string[] }
): string {
  const parentNum = parseInt(parentCode)
  const base = !isNaN(parentNum) ? parentNum : 0

  const siblings = siblingCodes
    .filter(c => c !== options?.excludeCode)
    .map(c => parseInt(c))
    .filter(n => !isNaN(n) && n > 0)

  let next = siblings.length > 0 ? Math.max(...siblings) + 1 : base + 1

  const taken = new Set([...(options?.allCodes || siblingCodes)])
  while (taken.has(String(next))) next++

  return String(next)
}

/** كود حساب رئيسي بدون أب حسب نوع الحساب */
export function suggestRootAccountCode(
  accountType: string,
  existingRootCodes: string[]
): string {
  const TYPE_START: Record<string, number> = {
    'أصول': 1000, 'خصوم': 2000, 'حقوق ملكية': 3000,
    'إيرادات': 4000, 'تكلفة': 5000, 'مصروفات': 6000,
  }
  const start = TYPE_START[accountType] || 9000
  const existing = existingRootCodes
    .map(c => parseInt(c))
    .filter(n => !isNaN(n) && n >= start && n < start + 1000)

  const maxE = existing.length > 0 ? Math.max(...existing) : start - 100
  let code = maxE + 100
  const taken = new Set(existingRootCodes)
  while (taken.has(String(code))) code += 10
  return String(code)
}
