/** إدارة فرق المشاريع — أنواع وأدوار مشتركة */

export const TEAM_TYPES = ['ميداني', 'تصميم', 'EPC', 'O&M', 'مختلط'] as const
export type TeamType = typeof TEAM_TYPES[number]

export const TEAM_ROLES = ['قائد', 'مهندس', 'مشرف', 'فني', 'عضو'] as const
export type TeamRole = typeof TEAM_ROLES[number]

export type ProjectTeam = {
  id: number
  tenant_id: string
  branch_id: number
  name: string
  team_type: string
  lead_id?: number | null
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  lead?: { id: number; name: string; job_title?: string } | null
  member_count?: number
  project_count?: number
}

export type TeamMember = {
  id: number
  tenant_id: string
  team_id: number
  employee_id: number
  role_in_team: string
  is_active: boolean
  joined_at: string
  employee?: { id: number; name: string; job_title?: string; department?: string }
}

export const TEAM_TYPE_STYLE: Record<string, { color: string; bg: string }> = {
  'ميداني': { color: '#1a56db', bg: '#eff6ff' },
  'تصميم':  { color: '#7c3aed', bg: '#f5f3ff' },
  'EPC':    { color: '#0ea77b', bg: '#ecfdf5' },
  'O&M':    { color: '#e6820a', bg: '#fffbeb' },
  'مختلط':  { color: '#4b5563', bg: '#f3f4f6' },
}
