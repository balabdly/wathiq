// ══════════════════════════════════════
// HR Types — وثيق
// ══════════════════════════════════════

export type HREmployee = {
  id: number; tenant_id: string; employee_id?: number
  employee_number?: string
  name?: string
  first_name?: string; father_name?: string
  grandfather_name?: string; family_name?: string
  first_name_en?: string; family_name_en?: string
  national_id?: string; nationality?: string; birth_date?: string
  gender?: string; marital_status?: string; hire_date?: string
  contract_type?: string; job_title?: string; department?: string
  work_location?: string
  basic_salary?: number; housing_allow?: number; transport_allow?: number; other_allow?: number
  gosi_enrolled?: boolean; gosi_pct?: number
  iqama_number?: string; iqama_expiry?: string
  passport_number?: string; passport_expiry?: string
  bank_name?: string; iban?: string; notes?: string
  phone?: string; email?: string; mobile?: string
  is_active: boolean; direct_manager?: number
}

export type Department = {
  id: number; tenant_id: string; name: string; manager_id?: number
  manager?: { name: string; role: string }
}

export type JobTitle = {
  id: number; tenant_id: string; name: string; department_id?: number
  department?: { name: string }
}

export type Termination = {
  id: number; tenant_id: string; employee_id?: number; hr_employee_id: number
  termination_type: string; termination_date: string
  last_working_day: string; years_of_service: number
  gratuity_amount: number; notes?: string; status: string
  employee?: { name: string; job_title?: string }
}

export type GratuityResult = {
  years: number; months: number; days: number
  fullAmount: number
  finalAmount: number
  reductionPct: number
  reductionLabel: string
  breakdown: string[]
  entitlement: string
  isEntitled: boolean
}
