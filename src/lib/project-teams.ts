/** إدارة فرق المشاريع — أنواع وأدوار مشتركة */

export const TEAM_TYPES = ['ميداني', 'كهربائي', 'سلامة', 'جودة'] as const
export type TeamType = typeof TEAM_TYPES[number]

/** تخصصات فرعية لكل نوع فريق */
export const TEAM_SPECIALIZATIONS: Record<TeamType, readonly string[]> = {
  'ميداني': [
    'شبكات', 'طرق', 'حفر', 'بنية تحتية', 'صيانة', 'عام',
  ],
  'كهربائي': [
    'عدادات', 'خطوط هوائية', 'محطات', 'كابلات', 'إنارة', 'صيانة', 'عام',
  ],
  'سلامة': [
    'HSE ميداني', 'تفتيش', 'تدريب', 'مراقبة', 'عام',
  ],
  'جودة': [
    'QC ميداني', 'مختبر', 'تفتيش', 'توثيق', 'عام',
  ],
}

export function getTeamSpecializations(teamType: string): readonly string[] {
  if ((TEAM_TYPES as readonly string[]).includes(teamType)) {
    return TEAM_SPECIALIZATIONS[teamType as TeamType]
  }
  return []
}

export function formatTeamTypeLabel(team: { team_type: string; specialization?: string | null }): string {
  const spec = team.specialization?.trim()
  if (spec) return `${team.team_type} · ${spec}`
  return team.team_type
}

export const TEAM_ROLES = ['قائد', 'مهندس', 'مشرف', 'فني', 'عضو'] as const
export type TeamRole = typeof TEAM_ROLES[number]

export type ProjectTeam = {
  id: number
  tenant_id: string
  branch_id: number
  name: string
  team_type: string
  specialization?: string | null
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

export type TeamProjectLog = {
  id: number
  tenant_id: string
  team_id: number
  project_id: number
  author_id?: number | null
  author_name: string
  notes?: string | null
  log_date?: string
  created_at: string
  files?: TeamProjectLogFile[]
}

export type TeamProjectLogFile = {
  id: number
  log_id: number
  file_name: string
  file_path: string
  file_type?: string
  file_size?: number
}

export const TEAM_TYPE_STYLE: Record<string, { color: string; bg: string }> = {
  'ميداني':   { color: '#1a56db', bg: '#eff6ff' },
  'كهربائي':  { color: '#e6820a', bg: '#fffbeb' },
  'سلامة':    { color: '#c81e1e', bg: '#fef2f2' },
  'جودة':     { color: '#0ea77b', bg: '#ecfdf5' },
  /* أنواع قديمة — للبيانات السابقة */
  'تصميم':    { color: '#7c3aed', bg: '#f5f3ff' },
  'EPC':      { color: '#0ea77b', bg: '#ecfdf5' },
  'O&M':      { color: '#e6820a', bg: '#fffbeb' },
  'مختلط':    { color: '#4b5563', bg: '#f3f4f6' },
}

export type AssigneeOption = {
  id: number
  name: string
  job_title?: string
  role_in_team?: string
}

const ENGINEERING_TITLES = [
  'مهندس', 'مدير مشروع', 'مهندس مشروع', 'مهندس كهرباء',
  'مهندس ميداني', 'مشرف', 'مشرف مشروع',
]

/** الاسم الكامل من سجل HR — name أو تركيب الأجزاء */
export function getHrEmployeeName(e: {
  name?: string | null
  first_name?: string | null
  father_name?: string | null
  grandfather_name?: string | null
  family_name?: string | null
}): string {
  if (e.name?.trim()) return e.name.trim()
  const built = [e.first_name, e.father_name, e.grandfather_name, e.family_name].filter(Boolean).join(' ').trim()
  return built || '—'
}

/** أعضاء الفريق للإسناد — أو مهندسين الفرع إن لم يُحدَّد فريق */
export async function fetchAssigneeOptions(
  supabase: { from: (t: string) => any },
  tenantId: string,
  teamId?: number | null,
): Promise<AssigneeOption[]> {
  if (teamId) {
    const { data: members } = await supabase
      .from('team_members')
      .select('role_in_team, employee:hr_employees(id, name, first_name, father_name, grandfather_name, family_name, job_title)')
      .eq('tenant_id', tenantId)
      .eq('team_id', teamId)
      .eq('is_active', true)
    const opts = (members || [])
      .map((m: { role_in_team: string; employee: Record<string, unknown> | null }) => {
        if (!m.employee) return null
        const emp = m.employee as { id: number; name?: string; job_title?: string; first_name?: string; father_name?: string; grandfather_name?: string; family_name?: string }
        return {
          id: emp.id,
          name: getHrEmployeeName(emp),
          job_title: emp.job_title,
          role_in_team: m.role_in_team,
        }
      })
      .filter(Boolean) as AssigneeOption[]
    if (opts.length > 0) return opts
  }

  const { data: all } = await supabase
    .from('hr_employees')
    .select('id, name, first_name, father_name, grandfather_name, family_name, job_title')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')
  const list = all || []
  const eng = list.filter((e: { job_title?: string }) =>
    ENGINEERING_TITLES.some(t => (e.job_title || '').includes(t)))
  return (eng.length > 0 ? eng : list).map((e: Record<string, unknown>) => ({
    id: e.id as number,
    name: getHrEmployeeName(e as Parameters<typeof getHrEmployeeName>[0]),
    job_title: e.job_title as string | undefined,
  }))
}

/** بيانات الفريق الكاملة لعرض تبويب الفريق */
export async function fetchTeamWithMembers(
  supabase: { from: (t: string) => any },
  tenantId: string,
  teamId: number,
): Promise<{ team: ProjectTeam | null; members: TeamMember[] }> {
  const [teamRes, membersRes] = await Promise.all([
    supabase.from('teams').select('*').eq('id', teamId).eq('tenant_id', tenantId).single(),
    supabase.from('team_members')
      .select('*, employee:hr_employees(id, name, first_name, father_name, grandfather_name, family_name, job_title, department)')
      .eq('tenant_id', tenantId)
      .eq('team_id', teamId)
      .eq('is_active', true),
  ])
  const members = ((membersRes.data || []) as TeamMember[]).map(m => {
    const raw = (m as { employee?: Record<string, unknown> }).employee
    const employee = raw ? {
      id: raw.id as number,
      name: getHrEmployeeName(raw as Parameters<typeof getHrEmployeeName>[0]),
      job_title: raw.job_title as string | undefined,
      department: raw.department as string | undefined,
    } : undefined
    return { ...m, employee }
  })
  const team = teamRes.data as ProjectTeam | null
  if (team?.lead_id) {
    const leadEmp = members.find(m => m.employee_id === team.lead_id)?.employee
    team.lead = leadEmp ? { id: leadEmp.id, name: leadEmp.name, job_title: leadEmp.job_title } : null
  }
  return { team, members }
}
