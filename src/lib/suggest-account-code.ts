/**
 * توليد كود حساب تلقائي — النظام الخماسي المباشر (مرجع أبو خالد، يوليو 2026)
 *
 * الجذور الخمسة ثابتة بأرقام مفردة:
 *   1 الأصول | 2 الالتزامات | 3 حقوق الملكية | 4 الإيرادات | 5 المصروفات
 *
 * كل مستوى فرعي يضيف خانة واحدة فقط على كود الأب مباشرة:
 *   1 → 11 → 111 → 1111   (وليس "+1" على قيمة الأب كرقم)
 *
 * هذا الملف هو المصدر الوحيد للترقيم في كل الشاشات (شجرة الحسابات، الخزينة، العهد)
 * — لا يوجد إدخال يدوي للكود في أي واجهة، الحقل يُقفل ويُعرض تلقائياً فقط.
 */

const ROOT_CODE: Record<string, string> = {
  'أصول':        '1',
  'خصوم':        '2',
  'حقوق ملكية':  '3',
  'إيرادات':     '4',
  'مصروفات':     '5',
}

/** كود حساب فرعي: يضيف خانة واحدة على كود الأب — أول ابن ينتهي بـ1، الذي يليه بـ2... */
export function suggestChildAccountCode(
  parentCode: string,
  siblingCodes: string[],
  options?: { excludeCode?: string; allCodes?: string[] }
): string {
  const childLen = parentCode.length + 1

  const siblingLastDigits = siblingCodes
    .filter(c => c !== options?.excludeCode)
    .filter(c => c.startsWith(parentCode) && c.length === childLen)
    .map(c => parseInt(c.slice(-1)))
    .filter(n => !isNaN(n))

  let nextDigit = siblingLastDigits.length > 0 ? Math.max(...siblingLastDigits) + 1 : 1

  const taken = new Set(options?.allCodes || siblingCodes)
  let code = parentCode + String(nextDigit)
  // تجاوز نادر لتسعة أبناء تحت أب واحد — يمدد الرقم الأخير بدل الاصطدام
  while (taken.has(code)) { nextDigit++; code = parentCode + String(nextDigit) }

  return code
}

/** كود حساب رئيسي (بدون أب) — رقم مفرد ثابت حسب النوع من الجذور الخمسة المعتمدة */
export function suggestRootAccountCode(
  accountType: string,
  existingRootCodes: string[]
): string {
  const fixed = ROOT_CODE[accountType]
  if (fixed && !existingRootCodes.includes(fixed)) return fixed

  for (let d = 6; d <= 9; d++) {
    if (!existingRootCodes.includes(String(d))) return String(d)
  }
  return String(existingRootCodes.length + 1)
}
