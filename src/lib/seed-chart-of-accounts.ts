import { supabase } from '@/lib/supabase'
import { CHART_OF_ACCOUNTS_SEED, coaAccountClass } from '@/data/chart-of-accounts-seed'
import { buildCoaRepairRules, COA_NAME_FIXES } from '@/data/coa-repair-rules'

export type SeedCoaResult = {
  inserted: number
  skipped: number
  total: number
}

export type RepairCoaResult = {
  updated: number
  orphansRemaining: number
  legacy5Root: boolean
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

/**
 * إصلاح الهرمية واليتامى — يحدّث الحسابات الموجودة بدل تخطيها
 * يُفضّل استدعاء RPC repair_tenant_coa_hierarchy إن وُجدت
 */
export async function repairChartOfAccounts(tenantId: string): Promise<RepairCoaResult> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('repair_tenant_coa_hierarchy', {
    p_tenant_id: tenantId,
  })

  if (!rpcError && rpcData) {
    const res = rpcData as { rows_updated?: number; orphans_remaining?: number; legacy_5_root?: boolean }
    return {
      updated: res.rows_updated ?? 0,
      orphansRemaining: res.orphans_remaining ?? 0,
      legacy5Root: res.legacy_5_root ?? false,
    }
  }

  // fallback من التطبيق إذا لم تُطبَّق الـ migration بعد
  const { data: rootAcc } = await supabase
    .from('finance_accounts')
    .select('name')
    .eq('tenant_id', tenantId)
    .eq('code', '1000')
    .maybeSingle()

  const isLegacy5Root = rootAcc?.name === 'الأصول'
  const rules = buildCoaRepairRules(isLegacy5Root)

  const { data: allAcc } = await supabase
    .from('finance_accounts')
    .select('id, code')
    .eq('tenant_id', tenantId)

  const codeToId = new Map((allAcc || []).map(a => [a.code, a.id]))
  let updated = 0

  for (const fix of COA_NAME_FIXES) {
    const { data: rows } = await supabase
      .from('finance_accounts')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('code', fix.code)
      .eq('name', fix.wrongName)

    for (const row of rows || []) {
      await supabase.from('finance_accounts').update({
        name: fix.correctName,
        name_en: fix.correctNameEn,
      }).eq('id', row.id)
      updated++
    }
  }

  const sorted = [...rules].sort((a, b) => a.level - b.level)
  const ROOT_CODES = new Set(['1000', '2000', '3000', '4000', '5000'])

  for (const rule of sorted) {
    const id = codeToId.get(rule.code)
    if (!id) continue
    if (isLegacy5Root && ROOT_CODES.has(rule.code)) continue

    const parentId = rule.parent_code ? codeToId.get(rule.parent_code) ?? null : null

    const { error } = await supabase
      .from('finance_accounts')
      .update({
        parent_id:      parentId,
        level:          rule.level,
        is_parent:      rule.is_parent,
        account_type:   rule.account_type,
        normal_balance: rule.normal_balance,
        account_class:  coaAccountClass(rule.account_type as Parameters<typeof coaAccountClass>[0]),
      })
      .eq('id', id)

    if (!error) updated++
  }

  const { count } = await supabase
    .from('finance_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('parent_id', null)
    .not('code', 'in', '(1000,2000,3000,4000,5000)')

  return {
    updated,
    orphansRemaining: count ?? 0,
    legacy5Root: isLegacy5Root,
  }
}
