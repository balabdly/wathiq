// ══════════════════════════════════════
// وثيق — Wathiq ERP Types
// ══════════════════════════════════════

export type UserRole =
  | 'مدير عام'
  | 'مدير مشروع'
  | 'مهندس جودة'
  | 'مهندس سلامة'
  | 'مشرف كهربائي'
  | 'مهندس مدني'
  | 'أمين مستودع'

export type ProjectType = '801' | '802' | '441' | '442' | '805' | '405' | 'O&M' | string

export type ProjectStatus =
  | 'تحت التخطيط'
  | 'قيد التنفيذ'
  | 'قيد الإغلاق'
  | 'مكتمل'
  | 'متأخر'
  | 'موقوف'
  | 'ملغي'

export type VisitType = 'جودة' | 'سلامة' | 'كهربائية' | 'ميدانية'
export type LedgerType = 'توريد' | 'صرف' | 'إرجاع للكهرباء' | 'نقل مخزني'

// ── الشركة / المستأجر ──
export interface Tenant {
  id: string
  name: string
  name_en?: string
  logo_url?: string
  phone?: string
  email?: string
  address?: string
  cr_number?: string
  sec_contractor_id?: string
  footer_text?: string
  plan: 'basic' | 'pro'
  is_active: boolean
  created_at: string
}

// ── الموظف ──
export interface Employee {
  id: number
  tenant_id: string
  branch_id?: number
  code?: string
  name: string
  role: UserRole
  username: string
  phone?: string
  email?: string
  permissions: string[]
  is_active: boolean
  created_at: string
}

// ── الفرع ──
export interface Branch {
  id: number
  tenant_id: string
  name: string
  location?: string
  description?: string
  color: string
  created_at: string
}

// ── المشروع ──
export interface Project {
  id: number
  tenant_id: string
  branch_id: number
  code?: string
  name: string
  type?: ProjectType
  status: ProjectStatus
  progress: number
  engineer?: string
  client_id?: number        // ربط بـ finance_clients
  client_name?: string      // اسم العميل (cached)
  value?: number
  start_date?: string
  end_date?: string
  location?: string
  description?: string
  notes?: string
  stages?: ProjectStage[]
  attachments?: Attachment[]
  timeline?: TimelineEntry[]
  history?: string[]
  created_at: string
  updated_at: string
}

export interface ProjectStage {
  id: string
  done: boolean
  note?: string
  attach?: string
  attachments?: Attachment[]
  startedAt?: string
  completedAt?: string
}

// ── الزيارة ──
export interface Visit {
  id: number
  tenant_id: string
  branch_id: number
  project_id?: number
  location?: string
  type: VisitType
  date: string
  engineer: string
  status: string
  specs: 'مطابق' | 'غير مطابق'
  corrective?: string
  notes?: string
  attachments?: Attachment[]
  resolved_report?: string
  resolved_date?: string
  resolved_by?: string
  resolved_files?: Attachment[]
  created_at: string
}

// ── المستودع ──
export interface Warehouse {
  id: number
  tenant_id: string
  branch_id: number
  name: string
  type?: 'SEC' | 'خاص' | 'مختلط'
  stock_type?: 'SEC' | 'خاص' | 'مختلط'
  capacity?: string
  location?: string
  created_at: string
}

// ── المادة ──
export interface Material {
  id: number
  tenant_id: string
  branch_id: number
  warehouse_id: number
  sku?: string
  catalog_no: string
  sec_number?: string
  name: string
  unit: string
  qty: number
  reorder: number
  source?: 'كهرباء' | 'خاص'
  notes?: string
  location?: string
  created_at: string
  updated_at: string
}

// ── حركة المخزون ──
export interface StockLedger {
  id: number
  tenant_id: string
  branch_id: number
  doc_code?: string
  clearance_no?: string
  vendor_name?: string
  type: LedgerType
  mat_name: string
  unit: string
  qty: number
  wh_name: string
  project_name?: string
  dispatch_note?: string
  client_name?: string
  qty_before?: number
  qty_after?: number
  created_at: string
}

// ── المشتريات ──
export interface Purchase {
  id: number
  tenant_id: string
  branch_id: number
  code?: string
  vendor?: string
  items?: string
  items_json?: string
  notes?: string
  date?: string
  status: string
  project_id?: number
  project_name?: string
  created_at: string
}

// ── العملاء/الموردون ──
export interface Client {
  id: number
  tenant_id: string
  name: string
  type: 'عميل' | 'مورد' | 'عميل/مورد'
  created_at: string
}

// ── وثائق QHSE ──
export interface QhseSection {
  docs: QhseDoc[]
  org_chart?: QhseFile
  custom_categories: string[]
}

export interface QhseDoc {
  id: string
  category: string
  name: string
  doc_number?: string
  issue_date?: string
  expiry_date?: string
  notes?: string
  file_url?: string
  file_name?: string
  added_by?: string
  added_at: string
}

export interface QhseFile {
  name: string
  url: string
  uploaded_at: string
}

// ── مشترك ──
export interface Attachment {
  name: string
  url?: string
  data?: string
  size?: number
  type?: string
  uploaded_at?: string
}

export interface TimelineEntry {
  date: string
  title: string
  description?: string
  user?: string
}

// ── API Response ──
export interface ApiResponse<T> {
  data?: T
  error?: string
  count?: number
}

// ── Dashboard Stats ──
export interface DashboardStats {
  activeProjects: number
  delayedProjects: number
  openNcr: number
  lowMaterials: number
  totalVisits: number
  expiredQhse: number
  soonExpiredQhse: number
}
