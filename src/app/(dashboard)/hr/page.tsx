'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import type { HREmployee, Department } from './hr_types'
import EmployeesList from './components/EmployeesList'
import HireEmployee  from './components/HireEmployee'
import Terminations  from './components/Terminations'
import JobOffers     from './components/JobOffers'
import HRModal       from './components/HRModal'

type TabId = 'employees' | 'joboffers' | 'hire' | 'terminations'

const TABS: { id: TabId; label: string; color: string }[] = [
  { id: 'employees',    label: '👥 ملفات الموظفين', color: '#1a56db' },
  { id: 'joboffers',    label: '📄 عروض العمل',      color: '#0ea77b' },
  { id: 'hire',         label: '➕ تعيين موظف',       color: '#7c3aed' },
  { id: 'terminations', label: '🚪 إنهاء الخدمة',    color: '#c81e1e' },
]

export default function HRPage() {
  const { tenant, currentUser } = useStore()
  const searchParams = useSearchParams()

  const [activeTab,   setActiveTab]   = useState<TabId>('employees')
  const [stats,       setStats]       = useState({ total: 0, active: 0, saudi: 0, expats: 0, totalSalaries: 0 })
  const [departments, setDepartments] = useState<Department[]>([])
  const [managers,    setManagers]    = useState<any[]>([])
  const [hrEmployees, setHREmployees] = useState<HREmployee[]>([])
  const [showModal,   setShowModal]   = useState(false)
  const [editEmp,     setEditEmp]     = useState<HREmployee | null>(null)

  const isAdmin = currentUser?.role === 'مدير عام'

  useEffect(() => { if (tenant) loadStats() }, [tenant?.id])

  // فتح مودال التعديل إذا جاء من صفحة تفاصيل الموظف
  useEffect(() => {
    const editId = searchParams?.get('editEmp') || sessionStorage.getItem('hr_edit_emp')
    if (!editId || !hrEmployees.length) return
    sessionStorage.removeItem('hr_edit_emp')
    const emp = hrEmployees.find(e => String(e.id) === editId)
    if (emp) { setEditEmp(emp); setShowModal(true) }
  }, [hrEmployees, searchParams])

  async function loadStats() {
    if (!tenant) return
    const [statsRes, mgRes, deptRes, empRes] = await Promise.all([
      supabase.from('hr_employees').select('nationality, basic_salary, housing_allow, transport_allow, other_allow, is_active').eq('tenant_id', tenant.id),
      supabase.from('employees').select('id, name, role').eq('tenant_id', tenant.id).eq('is_active', true),
      supabase.from('hr_departments').select('*, manager:employees(name, role)').eq('tenant_id', tenant.id).order('name'),
      supabase.from('hr_employees').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('employee_number'),
    ])
    const all = statsRes.data || []
    setStats({
      total:        all.length,
      active:       all.filter(e => e.is_active).length,
      saudi:        all.filter(e => e.nationality === 'سعودي').length,
      expats:       all.filter(e => e.nationality !== 'سعودي').length,
      totalSalaries: all.reduce((s, e) => s + (e.basic_salary || 0) + (e.housing_allow || 0) + (e.transport_allow || 0) + (e.other_allow || 0), 0),
    })
    setManagers(mgRes.data || [])
    setDepartments((deptRes.data || []) as Department[])
    setHREmployees((empRes.data || []) as HREmployee[])
  }

  async function handleSave(data: any) {
    if (!tenant) return
    try {
      const isEdit = !!(data.id)
      if (isEdit) {
        const updateId = data.id
        const hrPayload: Record<string, any> = {
          first_name: data.first_name || null, father_name: data.father_name || null,
          grandfather_name: data.grandfather_name || null, family_name: data.family_name || null,
          first_name_en: data.first_name_en || null, family_name_en: data.family_name_en || null,
          national_id: data.national_id || null, nationality: data.nationality,
          birth_date: data.birth_date || null, gender: data.gender, marital_status: data.marital_status,
          hire_date: data.hire_date || null, contract_type: data.contract_type,
          job_title: data.job_title || null, work_location: data.work_location || null,
          department: data.department || null,
          direct_manager: data.direct_manager && Number(data.direct_manager) > 0 ? Number(data.direct_manager) : null,
          basic_salary: data.basic_salary, housing_allow: data.housing_allow,
          transport_allow: data.transport_allow, other_allow: data.other_allow,
          gosi_enrolled: data.gosi_enrolled, gosi_pct: data.gosi_pct,
          bank_name: data.bank_name || null, iban: data.iban || null,
          iqama_number: data.iqama_number || null, iqama_expiry: data.iqama_expiry || null,
          notes: data.notes || null,
        }
        Object.keys(hrPayload).forEach(k => { if (hrPayload[k] === undefined) delete hrPayload[k] })
        const { error } = await supabase.from('hr_employees').update(hrPayload).eq('id', updateId)
        if (error) throw error
        toast.success('تم التعديل ✅')
      }
      await loadStats()
      setShowModal(false); setEditEmp(null)
    } catch (err: any) {
      toast.error('خطأ: ' + (err?.message || 'حدث خطأ'))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e' }}>الموارد البشرية</h1>
        <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>
          إدارة الموظفين والتوظيف وإنهاء الخدمة
        </p>
      </div>

      {/* التابات */}
      <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '12px', padding: '4px', gap: '4px', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, minWidth: '120px', padding: '9px 16px', borderRadius: '9px', border: 'none',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s',
              background: activeTab === tab.id ? 'white' : 'transparent',
              color:      activeTab === tab.id ? tab.color : 'var(--text3)',
              boxShadow:  activeTab === tab.id ? `0 2px 8px ${tab.color}33` : 'none',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* محتوى التابات */}
      {activeTab === 'employees' && tenant && (
        <EmployeesList
          tenantId={tenant.id}
          stats={stats}
          isAdmin={isAdmin}
          onEdit={(emp) => { setEditEmp(emp); setShowModal(true) }}
          onView={() => {}}
        />
      )}

      {activeTab === 'joboffers' && tenant && (
        <JobOffers tenant={tenant} hrEmployees={hrEmployees} />
      )}

      {activeTab === 'hire' && (
        <HireEmployee onSuccess={() => { setActiveTab('employees'); loadStats() }} />
      )}

      {activeTab === 'terminations' && tenant && (
        <Terminations tenantId={tenant.id} hrEmployees={hrEmployees} />
      )}

      {/* مودال التعديل */}
      {showModal && (
        <HRModal
          emp={editEmp}
          departments={departments}
          managers={managers}
          onClose={() => { setShowModal(false); setEditEmp(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
