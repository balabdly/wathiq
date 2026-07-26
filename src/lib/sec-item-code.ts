/**
 * SEC / UDS: أرقام المواد والأعمال في الصور والنظام غالباً بدون البادئة 90
 * بينما المستودع والكتalog يحفظ الرقم الكامل (901234567).
 */

export const SEC_ITEM_CODE_PREFIX = '90'

export function normalizeSecItemCode(code: string): string {
  return String(code || '').replace(/\s+/g, '').toUpperCase()
}

/** كل الصيغ القابلة للمقارنة (مع/بدون 90) */
export function secItemCodeVariants(code: string): string[] {
  const n = normalizeSecItemCode(code)
  if (!n) return []
  const set = new Set<string>([n])
  if (/^\d+$/.test(n)) {
    if (!n.startsWith(SEC_ITEM_CODE_PREFIX)) {
      set.add(SEC_ITEM_CODE_PREFIX + n)
    } else if (n.length > SEC_ITEM_CODE_PREFIX.length) {
      set.add(n.slice(SEC_ITEM_CODE_PREFIX.length))
    }
  }
  return Array.from(set)
}

/** هل الرمزان يشيران لنفس بند SEC؟ */
export function secItemCodesMatch(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false
  const va = secItemCodeVariants(a)
  const vb = secItemCodeVariants(b)
  return va.some(x => vb.includes(x))
}

/** توسيع الرقم القصير من UDS/صورة إلى الصيغة الكاملة */
export function expandSecItemCode(code: string): string {
  const n = normalizeSecItemCode(code)
  if (!n) return ''
  if (/^\d+$/.test(n) && !n.startsWith(SEC_ITEM_CODE_PREFIX) && n.length >= 4) {
    return SEC_ITEM_CODE_PREFIX + n
  }
  return n
}

export function lookupSecCodeMap<T>(map: Map<string, T>, code: string): T | undefined {
  for (const v of secItemCodeVariants(code)) {
    const hit = map.get(v)
    if (hit !== undefined) return hit
  }
  return undefined
}

export function indexSecCodeMap(map: Map<string, number>, code: string, index: number): void {
  for (const v of secItemCodeVariants(code)) {
    if (!map.has(v)) map.set(v, index)
  }
}

export function findSecCodeIndex(map: Map<string, number>, code: string): number | undefined {
  for (const v of secItemCodeVariants(code)) {
    const idx = map.get(v)
    if (idx !== undefined) return idx
  }
  return undefined
}

export type SecCodeMaterialFields = {
  id: number
  catalog_no?: string | null
  sec_number?: string | null
  mat_code?: string | null
  item_code?: string | null
}

export function findMaterialBySecCode<T extends SecCodeMaterialFields>(
  materials: T[],
  code: string,
): T | undefined {
  if (!code.trim()) return undefined
  return materials.find(m => {
    const fields = [m.catalog_no, m.sec_number, m.mat_code, m.item_code]
    return fields.some(f => f && secItemCodesMatch(String(f), code))
  })
}

/** أفضل رقم للعرض/الحفظ — يفضّل الصيغة الكاملة من المستودع إن وُجدت */
export function resolveSecDisplayCode(
  inputCode: string,
  material?: { sec_number?: string | null; catalog_no?: string | null; mat_code?: string | null; item_code?: string | null } | null,
): string {
  if (material) {
    return material.sec_number || material.catalog_no || material.mat_code || material.item_code || expandSecItemCode(inputCode)
  }
  return expandSecItemCode(inputCode) || normalizeSecItemCode(inputCode)
}
