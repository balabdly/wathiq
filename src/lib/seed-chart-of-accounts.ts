import { supabase } from '@/lib/supabase'
import { CHART_OF_ACCOUNTS_SEED, coaAccountClass } from '@/data/chart-of-accounts-seed'

export type SeedCoaResult = {
  inserted: number
  skipped: number
  total: number
}

/**
 * زرع شجرة الحسابات المعيارية لشركة — يتخطى الأكواد الموجودة مسبقاً
 */
export async function seedChartOfAccounts(tenantId: string): Promise<SeedCoaResult> {
  const { data: existing } = await supabase
    .from('finance_accounts')
    .select('code')
    .eq('tenant_id', tenantId)

  const existingCodes = new Set((existing || []).map(a => a.code))
  const codeToId = new Map<string, number>()

  // جلب معرّفات الحسابات الموجودة لربط الأبناء
  if (existingCodes.size > 0) {
    const { data: existingRows } = await supabase
      .from('finance_accounts')
      .select('id, code')
      .eq('tenant_id', tenantId)
    ;(existingRows || []).forEach(r => codeToId.set(r.code, r.id))
  }

  let inserted = 0
  let skipped = 0

  const sorted = [...CHART_OF_ACCOUNTS_SEED].sort((a, b) => a.level - b.level)

  for (const acc of sorted) {
    if (existingCodes.has(acc.code)) {
      skipped++
      continue
    }

    const parentId = acc.parent_code ? codeToId.get(acc.parent_code) ?? null : null

    const { data, error } = await supabase
      .from('finance_accounts')
      .insert({
        tenant_id:      tenantId,
        code:           acc.code,
        name:           acc.name,
        name_en:        acc.name_en,
        account_type:   acc.account_type,
        account_class:  coaAccountClass(acc.account_type),
        normal_balance: acc.normal_balance,
        parent_id:      parentId,
        level:          acc.level,
        is_parent:      acc.is_parent,
        is_active:      true,
      })
      .select('id, code')
      .single()

    if (error || !data) {
      console.error(`[seedCoa] فشل إدراج ${acc.code}:`, error?.message)
      skipped++
      continue
    }

    codeToId.set(data.code, data.id)
    existingCodes.add(data.code)
    inserted++
  }

  return { inserted, skipped, total: CHART_OF_ACCOUNTS_SEED.length }
}
