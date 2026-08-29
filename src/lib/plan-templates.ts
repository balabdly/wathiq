import type { TenantModules, TenantPlanKey } from '@/lib/tenant-plans'

export type PlanTemplate = {
  id: string
  name: string
  plan: TenantPlanKey
  modules: TenantModules
  created_at: string
}

export const PLAN_TEMPLATES_KEY = 'plan_templates'

export function parsePlanTemplates(raw: string | null | undefined): PlanTemplate[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function serializePlanTemplates(templates: PlanTemplate[]): string {
  return JSON.stringify(templates)
}
