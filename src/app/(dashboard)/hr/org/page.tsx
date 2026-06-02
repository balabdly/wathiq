'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, Pencil, Trash2, X, Save, Download, ZoomIn, ZoomOut, Maximize2, Building2, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'

// ══════════════════════════════════════
// Types
// ══════════════════════════════════════
type Branch = { id: number; name: string; manager_id?: number; manager?: any }
type Division = {
  id: number; name: string; branch_id: number | null; manager_id: number | null
  color: string; manager?: { name: string }
  departments?: Department[]
}
type Department = {
  id: number; name: string; division_id: number | null; manager_id: number | null
  manager?: { name: string }; job_titles?: JobTitle[]
}
type JobTitle = {
  id: number; name: string; department_id: number | null; grade_id: number | null
  grade?: { grade_code: string; grade_name: string }
  employee_count?: number
}
type JobGrade = {
  id: number; grade_code: string; grade_name: string
  salary_min: number; salary_mid: number; salary_max: number
}
type JobDescription = {
  id: number; job_title_id: number; grade_id: number | null
  description: string; responsibilities: string; qualifications: string
  job_title?: { name: string }; grade?: { grade_code: string; grade_name: string }
}
type Employee = { id: number; name: string; role: string }
type Tenant = { id: string; name: string; ceo_id?: number; ceo_name?: string }

const DIVISION_COLORS = ['#1a56db','#0ea77b','#e6820a','#c81e1e','#7c3aed','#0891b2','#be185d']

// ══════════════════════════════════════
// Org Chart SVG
// ══════════════════════════════════════
function OrgChart({ branches, divisions, hasBranches, allDivisions, ceoId, allEmployees }: {
  branches: Branch[]; divisions: Division[]; hasBranches: boolean; allDivisions: Division[]
  ceoId: number | null; allEmployees: Employee[]
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // ── حسابات الرسم ──
  const NODE_W = 160; const NODE_H = 54
  const H_GAP = 30;  const V_GAP = 70

  type OrgNode = {
    id: string; label: string; sublabel?: string; color: string
    x: number; y: number; w: number; h: number; type: 'company'|'branch'|'division'|'dept'|'title'
  }
  type OrgEdge = { x1: number; y1: number; x2: number; y2: number; color: string }

  const nodes: OrgNode[] = []
  const edges: OrgEdge[] = []

  // شركة + CEO
  const companyX = 400
  const ceoEmp = allEmployees.find(e => e.id === ceoId)
  const companyLabel = 'الشركة'
  const companySubLabel = ceoEmp ? `👑 ${ceoEmp.name}` : 'المقر الرئيسي'
  nodes.push({ id: 'company', label: companyLabel, sublabel: companySubLabel, color: '#1a1a2e', x: companyX, y: 20, w: 200, h: 62, type: 'company' })

  if (hasBranches && branches.length > 0) {
    // مع فروع
    const branchSpacing = Math.max(NODE_W + H_GAP, (branches.length > 1 ? 800 / (branches.length - 1) : 0))
    const totalBranchW = (branches.length - 1) * branchSpacing
    const branchStartX = companyX + 90 - totalBranchW / 2

    branches.forEach((br, bi) => {
      const brX = branchStartX + bi * branchSpacing
      const brY = 20 + 58 + V_GAP
      nodes.push({ id: `br-${br.id}`, label: br.name, sublabel: 'فرع', color: '#2563eb', x: brX, y: brY, w: NODE_W, h: NODE_H, type: 'branch' })
      edges.push({ x1: companyX + 90, y1: 20 + 58, x2: brX + NODE_W/2, y2: brY, color: '#94a3b8' })

      const brDivs = divisions.filter(d => d.branch_id === br.id)
      const divSpacing = Math.max(NODE_W + H_GAP, brDivs.length > 1 ? 300 / (brDivs.length) : NODE_W + H_GAP)
      const divStartX = brX + NODE_W/2 - (brDivs.length - 1) * divSpacing / 2

      brDivs.forEach((div, di) => {
        const divX = divStartX + di * divSpacing - NODE_W/2
        const divY = brY + NODE_H + V_GAP
        nodes.push({ id: `div-${div.id}`, label: div.name, sublabel: div.manager?.name || '—', color: div.color || '#1a56db', x: divX, y: divY, w: NODE_W, h: NODE_H, type: 'division' })
        edges.push({ x1: brX + NODE_W/2, y1: brY + NODE_H, x2: divX + NODE_W/2, y2: divY, color: div.color || '#1a56db' })
        renderDepts(div, divX, divY, div.color || '#1a56db')
      })
    })
  } else {
    // بدون فروع
    const divs = allDivisions
    const spacing = Math.max(NODE_W + H_GAP, divs.length > 1 ? 900 / divs.length : NODE_W + H_GAP)
    const totalW = (divs.length - 1) * spacing
    const startX = companyX + 90 - totalW / 2

    divs.forEach((div, di) => {
      const divX = startX + di * spacing - NODE_W/2
      const divY = 20 + 58 + V_GAP
      nodes.push({ id: `div-${div.id}`, label: div.name, sublabel: div.manager?.name || '—', color: div.color || '#1a56db', x: divX, y: divY, w: NODE_W, h: NODE_H, type: 'division' })
      edges.push({ x1: companyX + 90, y1: 20 + 58, x2: divX + NODE_W/2, y2: divY, color: div.color || '#1a56db' })
      renderDepts(div, divX, divY, div.color || '#1a56db')
    })
  }

  function renderDepts(div: Division, divX: number, divY: number, color: string) {
    const depts = div.departments || []
    if (depts.length === 0) return
    const spacing = Math.max(NODE_W + H_GAP - 20, 140)
    const totalW = (depts.length - 1) * spacing
    const startX = divX + NODE_W/2 - totalW/2

    depts.forEach((dept, di) => {
      const dX = startX + di * spacing - (NODE_W - 20)/2
      const dY = divY + NODE_H + V_GAP - 10
      nodes.push({ id: `dept-${dept.id}`, label: dept.name, sublabel: dept.manager?.name || '—', color, x: dX, y: dY, w: NODE_W - 20, h: NODE_H - 6, type: 'dept' })
      edges.push({ x1: divX + NODE_W/2, y1: divY + NODE_H, x2: dX + (NODE_W-20)/2, y2: dY, color })

      const titles = dept.job_titles || []
      const tSpacing = 110
      const tTotalW = (titles.length - 1) * tSpacing
      const tStartX = dX + (NODE_W-20)/2 - tTotalW/2
      titles.forEach((t, ti) => {
        const tX = tStartX + ti * tSpacing - 55
        const tY = dY + (NODE_H-6) + V_GAP - 20
        nodes.push({ id: `title-${t.id}`, label: t.name, sublabel: t.grade?.grade_code || '', color: color + 'bb', x: tX, y: tY, w: 110, h: 44, type: 'title' })
        edges.push({ x1: dX + (NODE_W-20)/2, y1: dY + (NODE_H-6), x2: tX + 55, y2: tY, color: color + '88' })
      })
    })
  }

  const svgW = Math.max(1000, ...nodes.map(n => n.x + n.w + 40))
  const svgH = Math.max(500, ...nodes.map(n => n.y + n.h + 60))

  // Pan/Zoom
  const onMouseDown = (e: React.MouseEvent) => { setDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }) }
  const onMouseMove = (e: React.MouseEvent) => { if (dragging) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }) }
  const onMouseUp = () => setDragging(false)

  function exportSVG() {
    if (!svgRef.current) return
    const data = new XMLSerializer().serializeToString(svgRef.current)
    const blob = new Blob([data], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'org-chart.svg'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: '#f8fafc' }}>
      {/* أدوات التحكم */}
      <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, display: 'flex', gap: '6px' }}>
        <button onClick={() => setZoom(z => Math.min(z + 0.15, 2))} style={{ padding: '6px 10px', background: 'white', border: '1px solid var(--border)', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
          <ZoomIn style={{ width: '14px', height: '14px' }} />
        </button>
        <button onClick={() => setZoom(z => Math.max(z - 0.15, 0.4))} style={{ padding: '6px 10px', background: 'white', border: '1px solid var(--border)', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
          <ZoomOut style={{ width: '14px', height: '14px' }} />
        </button>
        <button onClick={() => { setZoom(0.8); setPan({ x: 0, y: 0 }) }} style={{ padding: '6px 10px', background: 'white', border: '1px solid var(--border)', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
          <Maximize2 style={{ width: '14px', height: '14px' }} /> إعادة ضبط
        </button>
        <button onClick={exportSVG} style={{ padding: '6px 10px', background: 'white', border: '1px solid var(--border)', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
          <Download style={{ width: '14px', height: '14px' }} /> تصدير
        </button>
        <span style={{ padding: '6px 10px', background: 'white', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '0.78rem', color: 'var(--text3)' }}>{Math.round(zoom * 100)}%</span>
      </div>

      {/* SVG */}
      <div style={{ overflow: 'hidden', height: '520px', cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        <svg ref={svgRef} width={svgW} height={svgH}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '50% 0', transition: dragging ? 'none' : 'transform 0.1s' }}
          viewBox={`0 0 ${svgW} ${svgH}`}>
          <defs>
            <filter id="shadow">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* الخطوط */}
          {edges.map((e, i) => (
            <path key={i}
              d={`M ${e.x1} ${e.y1} C ${e.x1} ${(e.y1 + e.y2) / 2}, ${e.x2} ${(e.y1 + e.y2) / 2}, ${e.x2} ${e.y2}`}
              fill="none" stroke={e.color} strokeWidth="1.5" opacity="0.6" />
          ))}

          {/* العقد */}
          {nodes.map(n => (
            <g key={n.id} filter="url(#shadow)">
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="8"
                fill={n.type === 'company' ? '#1a1a2e' : n.type === 'title' ? 'white' : 'white'}
                stroke={n.type === 'title' ? n.color : n.color}
                strokeWidth={n.type === 'company' ? 0 : n.type === 'title' ? 1 : 2} />

              {/* شريط لوني أعلى */}
              {n.type !== 'company' && n.type !== 'title' && (
                <rect x={n.x} y={n.y} width={n.w} height="4" rx="8"
                  fill={n.color} />
              )}

              {/* النص الرئيسي */}
              <text x={n.x + n.w / 2} y={n.y + n.h / 2 - (n.sublabel ? 8 : 0)}
                textAnchor="middle" dominantBaseline="central"
                fontSize={n.type === 'company' ? 14 : n.type === 'title' ? 11 : 12}
                fontWeight="700"
                fill={n.type === 'company' ? 'white' : n.type === 'title' ? n.color : '#1a1a2e'}
                fontFamily="'Segoe UI', Tahoma, sans-serif">
                {n.label.length > 16 ? n.label.substring(0, 15) + '…' : n.label}
              </text>

              {/* النص الفرعي */}
              {n.sublabel && (
                <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 10}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize="9" fill={n.type === 'company' ? 'rgba(255,255,255,0.6)' : '#94a3b8'}
                  fontFamily="'Segoe UI', Tahoma, sans-serif">
                  {n.sublabel.length > 18 ? n.sublabel.substring(0, 17) + '…' : n.sublabel}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {nodes.length <= 1 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,250,252,0.9)' }}>
          <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏢</div>
            <div style={{ fontSize: '0.875rem' }}>أضف إدارات وأقساماً لرؤية المخطط التنظيمي</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════
export default function OrgStructurePage() {
  const { tenant } = useStore()
  const [ceoId, setCeoId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'chart'|'ceo'|'branches'|'divisions'|'departments'|'jobtitles'|'grades'|'descriptions'>('chart')
  const [branches, setBranches] = useState<Branch[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([])
  const [grades, setGrades] = useState<JobGrade[]>([])
  const [descriptions, setDescriptions] = useState<JobDescription[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [managers, setManagers] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const hasBranches = branches.length > 1

  // ── Modal states ──
  const [branchModal, setBranchModal] = useState(false)
  const [editBranch, setEditBranch]   = useState<any>(null)
  const [divModal, setDivModal]   = useState(false)
  const [editDiv, setEditDiv]     = useState<Division | null>(null)
  const [gradeModal, setGradeModal] = useState(false)
  const [editGrade, setEditGrade] = useState<JobGrade | null>(null)
  const [descModal, setDescModal] = useState(false)
  const [editDesc, setEditDesc]   = useState<JobDescription | null>(null)

  useEffect(() => { if (tenant) loadAll() }, [tenant?.id])

  async function loadAll() {
    if (!tenant) return
    setLoading(true)
    const [brRes, divRes, deptRes, titleRes, gradeRes, descRes, empRes] = await Promise.all([
      supabase.from('branches').select('id, name, manager_id, manager:employees!branches_manager_id_fkey(name)'),
      supabase.from('org_divisions').select('*, manager:employees!org_divisions_manager_id_fkey(name)').eq('tenant_id', tenant.id).order('name'),
      supabase.from('hr_departments').select('*, manager:employees!hr_departments_manager_id_fkey(name)').eq('tenant_id', tenant.id).order('name'),
      supabase.from('hr_job_titles').select('*, grade:org_job_grades(grade_code, grade_name)').eq('tenant_id', tenant.id).order('name'),
      supabase.from('org_job_grades').select('*').eq('tenant_id', tenant.id).order('grade_code'),
      supabase.from('org_job_descriptions').select('*, job_title:hr_job_titles(name), grade:org_job_grades(grade_code, grade_name)').eq('tenant_id', tenant.id),
      supabase.from('employees').select('id, name, role').eq('tenant_id', tenant.id).eq('is_active', true),
    ])

    const brs = brRes.data || []
    const divs = divRes.data || []
    const depts = deptRes.data || []
    const titles = titleRes.data || []

    // جلب عدد الموظفين لكل مسمى
    const { data: hrEmps } = await supabase.from('hr_employees').select('job_title').eq('tenant_id', tenant.id).eq('is_active', true)
    const countMap: Record<string, number> = {}
    ;(hrEmps || []).forEach((e: any) => { if (e.job_title) countMap[e.job_title] = (countMap[e.job_title] || 0) + 1 })

    // ربط الأقسام بالإدارات
    const divsWithDepts = divs.map((div: any) => ({
      ...div,
      departments: depts
        .filter((d: any) => d.division_id === div.id)
        .map((d: any) => ({
          ...d,
          job_titles: titles.filter((t: any) => t.department_id === d.id).map((t: any) => ({ ...t, employee_count: countMap[t.name] || 0 })),
        })),
    }))

    // normalize manager (Supabase returns array for foreign key joins)
    const normalizedBrs = brs.map((b: any) => ({
      ...b,
      manager: Array.isArray(b.manager) ? b.manager[0] : b.manager
    }))
    setBranches(normalizedBrs as any[]); setDivisions(divsWithDepts); setDepartments(depts)
    setJobTitles(titles.map((t: any) => ({ ...t, employee_count: countMap[t.name] || 0 })))
    setGrades(gradeRes.data || []); setDescriptions(descRes.data || [])
    setEmployees(empRes.data || [])
    setManagers((empRes.data || []).filter((e: any) => ['مدير عام','مدير مشروع','مدير قسم'].includes(e.role)))
    // جلب CEO من tenant
    if (tenant) {
      const { data: tenantData } = await supabase.from('tenants').select('ceo_id').eq('id', tenant.id).single()
      if (tenantData?.ceo_id) setCeoId(tenantData.ceo_id)
    }
    setLoading(false)
  }


  // ══ CRUD: الفروع ══
  async function saveBranch(form: any) {
    const payload: any = { name: form.name }
    if (form.manager_id) payload.manager_id = Number(form.manager_id)
    // بعض الجداول تحتوي tenant_id وبعضها لا
    try {
      if (form.id) {
        const { error } = await supabase.from('branches').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        // جرب مع tenant_id أولاً
        const payloadWithTenant = { ...payload, tenant_id: tenant?.id }
        const { error } = await supabase.from('branches').insert(payloadWithTenant)
        if (error) {
          // إذا فشل، جرب بدون tenant_id
          const { error: err2 } = await supabase.from('branches').insert(payload)
          if (err2) throw err2
        }
      }
      await loadAll(); toast.success('تم الحفظ ✅')
    } catch (err: any) {
      toast.error('خطأ: ' + err.message)
    }
  }
  async function deleteBranch(id: number) {
    if (!confirm('حذف هذا الفرع؟ سيؤثر على الإدارات والموظفين المرتبطين به')) return
    await supabase.from('branches').delete().eq('id', id)
    await loadAll(); toast.success('تم الحذف')
  }

  // ══ CRUD: الإدارات ══
  async function saveDivision(form: any) {
    const payload = { tenant_id: tenant?.id, name: form.name, branch_id: form.branch_id || null, manager_id: form.manager_id || null, color: form.color }
    if (editDiv) await supabase.from('org_divisions').update(payload).eq('id', editDiv.id)
    else await supabase.from('org_divisions').insert(payload)
    await loadAll(); setDivModal(false); setEditDiv(null); toast.success('تم الحفظ ✅')
  }
  async function deleteDivision(id: number) {
    if (!confirm('حذف هذه الإدارة؟')) return
    await supabase.from('org_divisions').delete().eq('id', id)
    await loadAll(); toast.success('تم الحذف')
  }

  // ══ CRUD: الدرجات ══
  async function saveGrade(form: any) {
    const payload = { tenant_id: tenant?.id, grade_code: form.grade_code, grade_name: form.grade_name, salary_min: Number(form.salary_min), salary_mid: Number(form.salary_mid), salary_max: Number(form.salary_max) }
    if (editGrade) await supabase.from('org_job_grades').update(payload).eq('id', editGrade.id)
    else await supabase.from('org_job_grades').insert(payload)
    await loadAll(); setGradeModal(false); setEditGrade(null); toast.success('تم الحفظ ✅')
  }
  async function deleteGrade(id: number) {
    if (!confirm('حذف هذه الدرجة؟')) return
    await supabase.from('org_job_grades').delete().eq('id', id)
    await loadAll(); toast.success('تم الحذف')
  }

  // ══ CRUD: الأوصاف ══
  async function saveDesc(form: any) {
    const payload = { tenant_id: tenant?.id, job_title_id: Number(form.job_title_id), grade_id: form.grade_id || null, description: form.description, responsibilities: form.responsibilities, qualifications: form.qualifications }
    if (editDesc) await supabase.from('org_job_descriptions').update(payload).eq('id', editDesc.id)
    else await supabase.from('org_job_descriptions').insert(payload)
    await loadAll(); setDescModal(false); setEditDesc(null); toast.success('تم الحفظ ✅')
  }

  const TABS = [
    { id: 'chart',        label: '🏢 المخطط التنظيمي' },
    { id: 'ceo',          label: '👑 المدير التنفيذي' },
    { id: 'branches',     label: '🌿 الفروع' },
    { id: 'divisions',    label: '🏗️ الإدارات' },
    { id: 'departments',  label: '🏢 الأقسام' },
    { id: 'jobtitles',   label: '💼 المسميات' },
    { id: 'grades',       label: '📊 الدرجات الوظيفية' },
    { id: 'descriptions', label: '📄 الأوصاف الوظيفية' },
  ]

  return (
    <div className="space-y-5 fade-in">
      {/* العنوان */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            🏛️ الهيكل التنظيمي
          </h1>
          <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>
            {hasBranches ? `${branches.length} فروع · ` : ''}{divisions.length} إدارة · {departments.length} قسم · {jobTitles.length} مسمى وظيفي
          </p>
        </div>
        {activeTab === 'branches' && (
          <button onClick={() => { setEditBranch(null); setBranchModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> إضافة فرع
          </button>
        )}
        {activeTab === 'divisions' && (
          <button onClick={() => { setEditDiv(null); setDivModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> إضافة إدارة
          </button>
        )}
        {activeTab === 'departments' && (
          <div /> 
        )}
        {activeTab === 'jobtitles' && (
          <div />
        )}
        {activeTab === 'grades' && (
          <button onClick={() => { setEditGrade(null); setGradeModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> إضافة درجة
          </button>
        )}
        {activeTab === 'descriptions' && (
          <button onClick={() => { setEditDesc(null); setDescModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> إضافة وصف
          </button>
        )}
      </div>

      {/* التابات */}
      <div style={{ display: 'flex', gap: '6px', background: '#e5e7eb', padding: '5px', borderRadius: '12px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            style={{ padding: '7px 16px', borderRadius: '9px', fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === t.id ? 'var(--primary)' : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text3)',
              boxShadow: activeTab === t.id ? '0 2px 8px rgba(26,86,219,0.3)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ══ المخطط التنظيمي ══ */}
          {activeTab === 'chart' && (
            <OrgChart branches={branches} divisions={divisions} hasBranches={hasBranches} allDivisions={divisions} ceoId={ceoId} allEmployees={employees} />
          )}

          {/* ══ المدير التنفيذي ══ */}
          {activeTab === 'ceo' && (
            <div className="card" style={{ padding: '28px', maxWidth: '520px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  👑 المدير التنفيذي (CEO)
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text3)', lineHeight: 1.6 }}>
                  يظهر على رأس المخطط التنظيمي ويمثل القيادة العليا للشركة
                </p>
              </div>
              {ceoId && employees.find(e => e.id === ceoId) && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>
                    {employees.find(e => e.id === ceoId)?.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{employees.find(e => e.id === ceoId)?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#92400e' }}>{employees.find(e => e.id === ceoId)?.role} · المدير التنفيذي</div>
                  </div>
                  <button type="button" onClick={async () => {
                    if (!tenant) return
                    await supabase.from('tenants').update({ ceo_id: null }).eq('id', tenant.id)
                    setCeoId(null); toast.success('تم الإلغاء')
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}>
                    <X style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {ceoId ? 'تغيير المدير التنفيذي' : 'تحديد المدير التنفيذي'} <span className="text-red-500">*</span>
                </label>
                <select
                  value={ceoId || ''}
                  onChange={async (e) => {
                    const id = Number(e.target.value)
                    if (!id || !tenant) return
                    const { error } = await supabase.from('tenants').update({ ceo_id: id }).eq('id', tenant.id)
                    if (error) { toast.error('خطأ: ' + error.message); return }
                    setCeoId(id); toast.success('✅ تم تحديد المدير التنفيذي')
                  }}
                  className="select">
                  <option value="">— اختر المدير التنفيذي —</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} — {e.role}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ══ الفروع ══ */}
          {activeTab === 'branches' && (
          <button onClick={() => { setEditBranch(null); setBranchModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> إضافة فرع
          </button>
        )}
        {activeTab === 'divisions' && (
            <div className="space-y-3">
              {divisions.length === 0 ? (
                <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🏗️</div>
                  <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>لا توجد إدارات بعد</p>
                  <button onClick={() => setDivModal(true)} className="btn btn-primary">
                    <Plus style={{ width: '16px', height: '16px' }} /> إضافة أول إدارة
                  </button>
                </div>
              ) : (
                divisions.map(div => (
                  <div key={div.id} className="card" style={{ overflow: 'hidden' }}>
                    {/* رأس الإدارة */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', background: div.color + '10' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: div.color }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{div.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                            {div.manager?.name ? `👤 ${div.manager.name}` : '⚠️ لا يوجد مدير'}
                            {hasBranches && div.branch_id && ` · ${branches.find(b => b.id === div.branch_id)?.name}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ background: div.color + '20', color: div.color, borderRadius: '20px', padding: '3px 12px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {div.departments?.length || 0} قسم
                        </span>
                        <button onClick={() => { setEditDiv(div); setDivModal(true) }} className="btn btn-ghost btn-xs"><Pencil style={{ width: '13px', height: '13px' }} /></button>
                        <button onClick={() => deleteDivision(div.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}><Trash2 style={{ width: '13px', height: '13px' }} /></button>
                      </div>
                    </div>
                    {/* الأقسام */}
                    {(div.departments || []).length > 0 && (
                      <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {(div.departments || []).map(dept => (
                          <div key={dept.id} style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '8px 12px', border: `1px solid ${div.color}30`, fontSize: '0.82rem' }}>
                            <div style={{ fontWeight: 600 }}>{dept.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                              {dept.manager?.name || '—'} · {(dept.job_titles || []).length} مسمى
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══ الأقسام ══ */}
          {activeTab === 'departments' && tenant && (
            <DepartmentsTab tenantId={tenant.id} managers={managers} divisions={divisions} onUpdate={loadAll} />
          )}

          {/* ══ المسميات الوظيفية ══ */}
          {activeTab === 'jobtitles' && tenant && (
            <JobTitlesTab tenantId={tenant.id} grades={grades} />
          )}

          {/* ══ الدرجات الوظيفية ══ */}
          {activeTab === 'grades' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              {grades.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📊</div>
                  <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>لا توجد درجات وظيفية بعد</p>
                  <button onClick={() => setGradeModal(true)} className="btn btn-primary">
                    <Plus style={{ width: '16px', height: '16px' }} /> إضافة أول درجة
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                        {['الكود','اسم الدرجة','الحد الأدنى','المتوسط','الحد الأعلى','نطاق الراتب',''].map(h => (
                          <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map(g => {
                        const range = g.salary_max - g.salary_min
                        const midPct = range > 0 ? ((g.salary_mid - g.salary_min) / range) * 100 : 50
                        return (
                          <tr key={g.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '6px', padding: '3px 10px', fontWeight: 700, fontSize: '0.82rem' }}>{g.grade_code}</span>
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 600 }}>{g.grade_name}</td>
                            <td style={{ padding: '12px 14px', color: '#0ea77b' }}>{g.salary_min.toLocaleString()} ر.س</td>
                            <td style={{ padding: '12px 14px', color: 'var(--primary)', fontWeight: 600 }}>{g.salary_mid.toLocaleString()} ر.س</td>
                            <td style={{ padding: '12px 14px', color: '#c81e1e' }}>{g.salary_max.toLocaleString()} ر.س</td>
                            <td style={{ padding: '12px 14px', minWidth: '150px' }}>
                              <div style={{ position: 'relative', height: '8px', background: '#e5e7eb', borderRadius: '4px' }}>
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, #c81e1e, #0ea77b)', borderRadius: '4px' }} />
                                <div style={{ position: 'absolute', top: '-3px', right: `${100 - midPct}%`, width: '14px', height: '14px', background: 'var(--primary)', borderRadius: '50%', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                <button onClick={() => { setEditGrade(g); setGradeModal(true) }} className="btn btn-ghost btn-xs"><Pencil style={{ width: '13px', height: '13px' }} /></button>
                                <button onClick={() => deleteGrade(g.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}><Trash2 style={{ width: '13px', height: '13px' }} /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══ الأوصاف الوظيفية ══ */}
          {activeTab === 'descriptions' && (
            <div className="space-y-3">
              {descriptions.length === 0 ? (
                <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📄</div>
                  <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>لا توجد أوصاف وظيفية بعد</p>
                  <button onClick={() => setDescModal(true)} className="btn btn-primary">
                    <Plus style={{ width: '16px', height: '16px' }} /> إضافة وصف
                  </button>
                </div>
              ) : (
                descriptions.map(d => (
                  <div key={d.id} className="card" style={{ padding: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{d.job_title?.name}</div>
                        {d.grade && <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>{d.grade.grade_code} — {d.grade.grade_name}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setEditDesc(d); setDescModal(true) }} className="btn btn-ghost btn-xs"><Pencil style={{ width: '13px', height: '13px' }} /></button>
                        <button onClick={async () => { if (confirm('حذف؟')) { await supabase.from('org_job_descriptions').delete().eq('id', d.id); await loadAll(); toast.success('تم') } }} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}><Trash2 style={{ width: '13px', height: '13px' }} /></button>
                      </div>
                    </div>
                    {d.description && <p style={{ fontSize: '0.82rem', color: 'var(--text3)', marginBottom: '8px', lineHeight: 1.6 }}>{d.description}</p>}
                    {d.responsibilities && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>المهام والمسؤوليات</div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{d.responsibilities}</p>
                      </div>
                    )}
                    {d.qualifications && (
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0ea77b', marginBottom: '4px' }}>المؤهلات المطلوبة</div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{d.qualifications}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}


      {/* ══ Modal: فرع ══ */}
      {branchModal && (
        <BranchModal
          branch={editBranch} employees={employees}
          onClose={() => { setBranchModal(false); setEditBranch(null) }}
          onSave={saveBranch}
        />
      )}

      {/* ══ Modal: إدارة ══ */}
      {divModal && (
        <DivisionModal
          div={editDiv} branches={branches} hasBranches={hasBranches} employees={employees}
          onClose={() => { setDivModal(false); setEditDiv(null) }}
          onSave={saveDivision}
        />
      )}

      {/* ══ Modal: درجة ══ */}
      {gradeModal && (
        <GradeModal
          grade={editGrade}
          onClose={() => { setGradeModal(false); setEditGrade(null) }}
          onSave={saveGrade}
        />
      )}

      {/* ══ Modal: وصف ══ */}
      {descModal && (
        <DescriptionModal
          desc={editDesc} jobTitles={jobTitles} grades={grades}
          onClose={() => { setDescModal(false); setEditDesc(null) }}
          onSave={saveDesc}
        />
      )}
    </div>
  )
}


// ── Modal: فرع ──
function BranchModal({ branch, employees, onClose, onSave }: any) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    id: branch?.id || null,
    name: branch?.name || '',
    manager_id: branch?.manager_id || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('اسم الفرع مطلوب'); return }
    setSaving(true); await onSave(form); setSaving(false)
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{branch ? 'تعديل الفرع' : 'إضافة فرع جديد'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الفرع <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: الفرع الرئيسي - الرياض" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">مدير الفرع</label>
              <select value={form.manager_id} onChange={e => set('manager_id', e.target.value)} className="select">
                <option value="">— بدون مدير —</option>
                {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} حفظ
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal: إدارة ──
function DivisionModal({ div, branches, hasBranches, employees, onClose, onSave }: any) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: div?.name || '', branch_id: div?.branch_id || '',
    manager_id: div?.manager_id || '', color: div?.color || '#1a56db',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!form.name.trim()) { toast.error('اسم الإدارة مطلوب'); return }
    setSaving(true); await onSave(form); setSaving(false)
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{div ? 'تعديل الإدارة' : 'إضافة إدارة جديدة'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الإدارة <span className="text-red-500">*</span></label><input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="مثال: إدارة الهندسة" /></div>
            {hasBranches && (
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">الفرع</label>
                <select value={form.branch_id} onChange={e => set('branch_id', e.target.value)} className="select">
                  <option value="">— بدون فرع محدد —</option>
                  {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">مدير الإدارة</label>
              <select value={form.manager_id} onChange={e => set('manager_id', e.target.value)} className="select">
                <option value="">— بدون مدير —</option>
                {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">اللون</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {DIVISION_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => set('color', c)}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', background: c, border: form.color === c ? '3px solid #1a1a2e' : '2px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} حفظ
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal: درجة وظيفية ──
function GradeModal({ grade, onClose, onSave }: any) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ grade_code: grade?.grade_code || '', grade_name: grade?.grade_name || '', salary_min: grade?.salary_min || 0, salary_mid: grade?.salary_mid || 0, salary_max: grade?.salary_max || 0 })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!form.grade_code || !form.grade_name) { toast.error('الكود والاسم مطلوبان'); return }
    setSaving(true); await onSave(form); setSaving(false)
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{grade ? 'تعديل الدرجة' : 'إضافة درجة وظيفية'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">كود الدرجة *</label><input value={form.grade_code} onChange={e => set('grade_code', e.target.value)} className="input" placeholder="G1" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">اسم الدرجة *</label><input value={form.grade_name} onChange={e => set('grade_name', e.target.value)} className="input" placeholder="مبتدئ" /></div>
            </div>
            <div style={{ background: 'var(--bg2)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '10px', color: 'var(--text)' }}>💰 نطاق الراتب (ر.س)</div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">الحد الأدنى</label><input type="number" value={form.salary_min} onChange={e => set('salary_min', e.target.value)} className="input" min="0" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">المتوسط</label><input type="number" value={form.salary_mid} onChange={e => set('salary_mid', e.target.value)} className="input" min="0" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">الحد الأعلى</label><input type="number" value={form.salary_max} onChange={e => set('salary_max', e.target.value)} className="input" min="0" /></div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} حفظ
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal: وصف وظيفي ──
function DescriptionModal({ desc, jobTitles, grades, onClose, onSave }: any) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ job_title_id: desc?.job_title_id || '', grade_id: desc?.grade_id || '', description: desc?.description || '', responsibilities: desc?.responsibilities || '', qualifications: desc?.qualifications || '' })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!form.job_title_id) { toast.error('المسمى الوظيفي مطلوب'); return }
    setSaving(true); await onSave(form); setSaving(false)
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-bold text-gray-800">{desc ? 'تعديل الوصف الوظيفي' : 'إضافة وصف وظيفي'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">المسمى الوظيفي *</label>
                <select value={form.job_title_id} onChange={e => set('job_title_id', e.target.value)} className="select">
                  <option value="">— اختر المسمى —</option>
                  {jobTitles.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">الدرجة الوظيفية</label>
                <select value={form.grade_id} onChange={e => set('grade_id', e.target.value)} className="select">
                  <option value="">— بدون درجة —</option>
                  {grades.map((g: any) => <option key={g.id} value={g.id}>{g.grade_code} — {g.grade_name}</option>)}
                </select>
              </div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">وصف الوظيفة</label><textarea value={form.description} onChange={e => set('description', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} placeholder="نبذة عامة عن الوظيفة..." /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">المهام والمسؤوليات</label><textarea value={form.responsibilities} onChange={e => set('responsibilities', e.target.value)} className="input" style={{ minHeight: '90px', resize: 'none' }} placeholder="- مسؤولية 1&#10;- مسؤولية 2&#10;..." /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">المؤهلات المطلوبة</label><textarea value={form.qualifications} onChange={e => set('qualifications', e.target.value)} className="input" style={{ minHeight: '70px', resize: 'none' }} placeholder="- مؤهل 1&#10;- خبرة 2 سنة..." /></div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} حفظ
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


function DepartmentsTab({ tenantId, managers, divisions, onUpdate }: {
  tenantId: string
  managers: any[]
  divisions: Division[]
  onUpdate?: () => void
}) {
  const [depts, setDepts] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', manager_id: '', division_id: '' })
  const [editId, setEditId] = useState<number | null>(null)
  const noEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') e.preventDefault() }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('hr_departments')
      .select('*, manager:employees(name, role)')
      .eq('tenant_id', tenantId)
      .order('name')
    setDepts(data || [])
    setLoading(false)
  }

  async function save() {
    if (!form.name.trim()) { toast.error('أدخل اسم القسم'); return }
    if (!form.division_id) { toast.error('يجب تحديد الإدارة أولاً'); return }
    if (!form.manager_id) { toast.error('اختر مدير القسم'); return }
    const payload: any = {
      tenant_id: tenantId,
      name: form.name.trim(),
      manager_id: Number(form.manager_id),
      division_id: Number(form.division_id),
    }
    if (editId) {
      await supabase.from('hr_departments').update(payload).eq('id', editId)
    } else {
      await supabase.from('hr_departments').insert(payload)
    }
    setForm({ name: '', manager_id: '', division_id: '' })
    setEditId(null)
    await load()
    onUpdate?.()
    toast.success('تم الحفظ ✅')
  }

  async function remove(id: number) {
    if (!confirm('حذف هذا القسم؟ سيتأثر الموظفون المرتبطون به')) return
    await supabase.from('hr_departments').delete().eq('id', id)
    setDepts(d => d.filter(x => x.id !== id))
    onUpdate?.()
    toast.success('تم الحذف')
  }

  return (
    <div className="space-y-4">
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>
          {editId ? '✏️ تعديل القسم' : '➕ إضافة قسم جديد'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الإدارة <span className="text-red-500">*</span></label>
            <select value={(form as any).division_id} onChange={e => setForm(f => ({ ...f, division_id: e.target.value }))} className="select">
              <option value="">— اختر الإدارة أولاً —</option>
              {divisions.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {divisions.length === 0 && (
              <p style={{ fontSize: '0.72rem', color: '#c81e1e', marginTop: '4px' }}>⚠️ أضف إدارات أولاً</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم القسم <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input" placeholder="مثال: قسم المشاريع"
              onKeyDown={noEnter}
              disabled={!(form as any).division_id}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">مدير القسم <span className="text-red-500">*</span></label>
            <select value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))} className="select" disabled={!(form as any).division_id}>
              <option value="">— اختر المدير —</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={save} className="btn btn-primary btn-sm">
            <Save style={{ width: '14px', height: '14px' }} />
            {editId ? 'حفظ التعديل' : 'إضافة القسم'}
          </button>
          {editId && (
            <button onClick={() => { setForm({ name: '', manager_id: '', division_id: '' }); setEditId(null) }} className="btn btn-ghost btn-sm">
              إلغاء
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : depts.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <Building2 style={{ width: '40px', height: '40px', color: 'var(--border)', margin: '0 auto 10px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد أقسام بعد</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {depts.map((d, i) => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: i < depts.length - 1 ? '1px solid var(--bg2)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fffbeb', color: '#e6820a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 style={{ width: '16px', height: '16px' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{d.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                    {d.manager
                      ? `👤 ${d.manager.name}`
                      : <span style={{ color: '#c81e1e' }}>⚠️ لا يوجد مدير</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => { setForm({ name: d.name, manager_id: d.manager_id ? String(d.manager_id) : '', division_id: (d as any).division_id ? String((d as any).division_id) : '' }); setEditId(d.id) }}
                  className="btn btn-ghost btn-xs">
                  <Pencil style={{ width: '14px', height: '14px' }} />
                </button>
                <button onClick={() => remove(d.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                  <Trash2 style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════
// تاب المسميات الوظيفية
// ══════════════════════════════════════

function JobTitlesTab({ tenantId, grades }: { tenantId: string; grades: JobGrade[] }) {
  const [titles, setTitles] = useState<JobTitle[]>([])
  const [depts, setDepts] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', department_id: '', grade_id: '' })
  const [editId, setEditId] = useState<number | null>(null)
  const noEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') e.preventDefault() }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [tRes, dRes] = await Promise.all([
      supabase.from('hr_job_titles').select('*, department:hr_departments(name)').eq('tenant_id', tenantId).order('name'),
      supabase.from('hr_departments').select('id, name').eq('tenant_id', tenantId).order('name'),
    ])
    setTitles((tRes.data || []) as JobTitle[])
    setDepts((dRes.data || []) as Department[])
    setLoading(false)
  }

  async function save() {
    if (!form.department_id) { toast.error('يجب تحديد القسم أولاً'); return }
    if (!form.name.trim()) { toast.error('أدخل اسم المسمى الوظيفي'); return }
    const payload = {
      tenant_id: tenantId,
      name: form.name.trim(),
      department_id: Number(form.department_id),
    }
    if (editId) {
      await supabase.from('hr_job_titles').update(payload).eq('id', editId)
    } else {
      await supabase.from('hr_job_titles').insert(payload)
    }
    setForm({ name: '', department_id: '', grade_id: '' })
    setEditId(null)
    await load()
    toast.success('تم الحفظ ✅')
  }

  async function remove(id: number) {
    if (!confirm('حذف هذا المسمى؟')) return
    await supabase.from('hr_job_titles').delete().eq('id', id)
    setTitles(t => t.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  const grouped = depts.map(d => ({
    dept: d,
    titles: titles.filter(t => t.department_id === d.id),
  })).filter(g => g.titles.length > 0)

  return (
    <div className="space-y-4">
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>
          {editId ? '✏️ تعديل المسمى' : '➕ إضافة مسمى وظيفي'}
        </div>
        {depts.length === 0 ? (
          <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.875rem', color: '#e6820a' }}>
            ⚠️ يجب إضافة أقسام أولاً من تاب الأقسام
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '10px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">القسم <span className="text-red-500">*</span></label>
                <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} className="select">
                  <option value="">— اختر القسم —</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المسمى الوظيفي <span className="text-red-500">*</span></label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input" placeholder="مثال: مهندس كهرباء"
                  onKeyDown={noEnter}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={save} className="btn btn-primary btn-sm">
                <Save style={{ width: '14px', height: '14px' }} />
                {editId ? 'حفظ التعديل' : 'إضافة المسمى'}
              </button>
              {editId && (
                <button onClick={() => { setForm({ name: '', department_id: '', grade_id: '' }); setEditId(null) }} className="btn btn-ghost btn-sm">
                  إلغاء
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : titles.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <Briefcase style={{ width: '40px', height: '40px', color: 'var(--border)', margin: '0 auto 10px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد مسميات وظيفية بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(g => (
            <div key={g.dept.id} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 style={{ width: '14px', height: '14px', color: '#e6820a' }} />
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{g.dept.name}</span>
                <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>{g.titles.length} مسمى</span>
              </div>
              {g.titles.map((t, i) => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: i < g.titles.length - 1 ? '1px solid var(--bg2)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Briefcase style={{ width: '12px', height: '12px' }} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t.name}</span>
                      {(t as any).grade && <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: '1px' }}>{(t as any).grade.grade_code} — {(t as any).grade.grade_name}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => { setForm({ name: t.name, department_id: t.department_id ? String(t.department_id) : '', grade_id: t.grade_id ? String(t.grade_id) : '' }); setEditId(t.id) }}
                      className="btn btn-ghost btn-xs">
                      <Pencil style={{ width: '14px', height: '14px' }} />
                    </button>
                    <button onClick={() => remove(t.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
