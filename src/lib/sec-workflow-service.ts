import { supabase } from '@/lib/supabase'
import type { BillingModel, ExtractType, FollowUpStatus, MemoStatus, PmoPhase, WorkflowType, WoSource } from '@/lib/sec-workflow'
import { defaultBillingModel, defaultPmoPhase, defaultWoSource, statusForPhase } from '@/lib/sec-workflow'

export type FrameworkContract = {
  id: number
  tenant_id: string
  contract_no: string
  name: string
  client_name?: string
  start_date?: string
  end_date?: string
  is_active: boolean
}

export type FrameworkBoqItem = {
  id: number
  tenant_id: string
  contract_id: number
  item_code: string
  description_ar?: string
  description_en?: string
  unit: string
  unit_price: number
  line_type?: string
  is_active: boolean
}

export type MemoBoqLine = {
  item_code: string
  description?: string
  unit: string
  qty: number
  unit_price: number
}

export type FieldWorkMemo = {
  id: number
  tenant_id: string
  branch_id?: number
  internal_ref: string
  work_type: string
  location?: string
  description: string
  assigned_at?: string
  executed_at?: string
  team_id?: number
  assignee_name?: string
  sec_contact_name?: string
  sec_contact_phone?: string
  sec_contact_dept?: string
  follow_up_status: FollowUpStatus
  last_follow_up_at?: string
  next_follow_up_at?: string
  wo_number?: string
  wo_linked_at?: string
  project_id?: number
  status: MemoStatus
  estimated_amount?: number
  boq_lines?: MemoBoqLine[]
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
  team?: { name: string }
  project?: { id: number; name: string; code?: string }
}

export type MemoFollowUp = {
  id: number
  memo_id: number
  follow_up_at: string
  note: string
  created_by?: string
}

export type ProjectExtract = {
  id: number
  tenant_id: string
  project_id: number
  extract_type: ExtractType
  percentage: number
  amount: number
  boq_version_id?: number
  extract_ref?: string
  status: string
  notes?: string
}

async function nextMemoRef(tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `FW-${year}-`
  const { count } = await supabase
    .from('field_work_memos')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .like('internal_ref', `${prefix}%`)
  const n = (count || 0) + 1
  return `${prefix}${String(n).padStart(4, '0')}`
}

// ══ Framework contract & BOQ ══

export async function fetchFrameworkContracts(tenantId: string) {
  return supabase.from('framework_contracts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('contract_no')
}

export async function ensureDefaultSecContract(tenantId: string, contractNo = '4400023458') {
  const { data: existing } = await supabase.from('framework_contracts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('contract_no', contractNo)
    .maybeSingle()
  if (existing) return existing.id as number

  const { data, error } = await supabase.from('framework_contracts').insert({
    tenant_id: tenantId,
    contract_no: contractNo,
    name: 'العقد الموحد — شبكات التوزيع',
    client_name: 'الشركة السعودية للكهرباء',
    is_active: true,
  }).select('id').single()
  if (error) throw error
  return data.id as number
}

export async function fetchFrameworkBoqItems(tenantId: string, contractId: number, search = '') {
  let q = supabase.from('framework_boq_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('contract_id', contractId)
    .eq('is_active', true)
    .order('item_code')
  if (search) {
    q = q.or(`item_code.ilike.%${search}%,description_ar.ilike.%${search}%,description_en.ilike.%${search}%`)
  }
  return q.limit(500)
}

export async function importFrameworkBoqItems(
  tenantId: string,
  contractId: number,
  items: { item_code: string; unit: string; unit_price: number; description_ar?: string; description_en?: string }[],
) {
  const rows = items.map(it => ({
    tenant_id: tenantId,
    contract_id: contractId,
    item_code: it.item_code,
    unit: it.unit,
    unit_price: it.unit_price,
    description_ar: it.description_ar || null,
    description_en: it.description_en || null,
    line_type: 'Breakdown',
    is_active: true,
  }))
  return supabase.from('framework_boq_items')
    .upsert(rows, { onConflict: 'tenant_id,contract_id,item_code' })
}

export async function countFrameworkBoqItems(tenantId: string, contractId: number) {
  return supabase.from('framework_boq_items')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('contract_id', contractId)
}

// ══ Field work memos ══

export async function fetchFieldMemos(tenantId: string, statusFilter?: MemoStatus | 'pending_wo') {
  let q = supabase.from('field_work_memos')
    .select('*, team:teams(name), project:projects(id, name, code)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (statusFilter === 'pending_wo') {
    q = q.in('status', ['executed', 'awaiting_wo'])
  } else if (statusFilter) {
    q = q.eq('status', statusFilter)
  }
  return q
}

export async function createFieldMemo(payload: {
  tenant_id: string
  branch_id?: number
  work_type: string
  location?: string
  description: string
  assigned_at?: string
  team_id?: number
  assignee_name?: string
  sec_contact_name?: string
  sec_contact_phone?: string
  sec_contact_dept?: string
  boq_lines?: MemoBoqLine[]
  notes?: string
  created_by?: string
  status?: MemoStatus
  executed_at?: string
}) {
  const internal_ref = await nextMemoRef(payload.tenant_id)
  const estimated_amount = (payload.boq_lines || []).reduce(
    (s, l) => s + l.qty * l.unit_price, 0,
  )
  const status = payload.status || (payload.executed_at ? 'awaiting_wo' : 'draft')
  const follow_up_status = ['executed', 'awaiting_wo'].includes(status) ? 'awaiting_wo' as FollowUpStatus : 'awaiting_wo'

  return supabase.from('field_work_memos').insert({
    ...payload,
    internal_ref,
    estimated_amount,
    status,
    follow_up_status,
    boq_lines: payload.boq_lines || [],
  }).select('*, team:teams(name)').single()
}

export async function updateFieldMemo(id: number, patch: Partial<FieldWorkMemo>) {
  return supabase.from('field_work_memos')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, team:teams(name), project:projects(id, name, code)')
    .single()
}

export async function fetchMemoFollowUps(memoId: number) {
  return supabase.from('field_work_memo_followups')
    .select('*')
    .eq('memo_id', memoId)
    .order('follow_up_at', { ascending: false })
}

export async function addMemoFollowUp(payload: {
  tenant_id: string
  memo_id: number
  note: string
  created_by?: string
  follow_up_status?: FollowUpStatus
  next_follow_up_at?: string
}) {
  const { follow_up_status, next_follow_up_at, ...rest } = payload
  const { data, error } = await supabase.from('field_work_memo_followups').insert(rest).select().single()
  if (error) return { data: null, error }

  const memoPatch: Record<string, unknown> = {
    last_follow_up_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (follow_up_status) memoPatch.follow_up_status = follow_up_status
  if (next_follow_up_at) memoPatch.next_follow_up_at = next_follow_up_at

  await supabase.from('field_work_memos').update(memoPatch).eq('id', payload.memo_id)
  return { data, error: null }
}

/** ربط WO وإنشاء مشروع O&M */
export async function linkMemoToWo(payload: {
  memo: FieldWorkMemo
  wo_number: string
  tenant_id: string
  branch_id: number
  project_name?: string
}) {
  const { memo, wo_number, tenant_id, branch_id, project_name } = payload
  const name = project_name || `${memo.work_type} — ${memo.location || memo.internal_ref}`

  const { data: project, error: projErr } = await supabase.from('projects').insert({
    tenant_id,
    branch_id,
    name,
    code: wo_number,
    wo_number,
    wo_source: 'SAP',
    workflow_type: 'O&M_PRE_WO',
    billing_model: 'FULL_100',
    pmo_phase: 'O&M_EXEC',
    status: statusForPhase('O&M_EXEC'),
    field_memo_id: memo.id,
    sec_contract_no: '4400023458',
    location: memo.location,
    description: memo.description,
    estimated_value: memo.estimated_amount || 0,
    team_id: memo.team_id,
    client_name: 'الشركة السعودية للكهرباء',
    type: 'O&M',
  }).select('id, name, code').single()

  if (projErr) return { project: null, error: projErr }

  const { error: memoErr } = await supabase.from('field_work_memos').update({
    wo_number,
    wo_linked_at: new Date().toISOString(),
    project_id: project.id,
    status: 'wo_linked',
    follow_up_status: 'wo_linked',
    updated_at: new Date().toISOString(),
  }).eq('id', memo.id)

  return { project, error: memoErr }
}

// ══ Project extracts ══

export async function fetchProjectExtracts(tenantId: string, projectId: number) {
  return supabase.from('project_extracts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('created_at')
}

export async function createProjectExtract(payload: {
  tenant_id: string
  project_id: number
  extract_type: ExtractType
  percentage: number
  amount: number
  boq_version_id?: number
  extract_ref?: string
  created_by?: string
}) {
  return supabase.from('project_extracts').insert({
    ...payload,
    status: 'draft',
  }).select().single()
}

/** حقول workflow للمشروع الجديد */
export function buildWorkflowDefaults(wf: WorkflowType) {
  const pmo_phase = defaultPmoPhase(wf)
  return {
    workflow_type: wf,
    billing_model: defaultBillingModel(wf),
    wo_source: defaultWoSource(wf),
    pmo_phase,
    status: statusForPhase(pmo_phase),
    sec_contract_no: wf === 'FULL_SEC' ? '4400023458' : undefined,
  }
}

export type { WorkflowType, BillingModel, PmoPhase, WoSource }
