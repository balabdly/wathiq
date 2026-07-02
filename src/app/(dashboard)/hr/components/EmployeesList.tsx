'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Users, Search, Eye, Pencil, Trash2, ChevronRight, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import type { HREmployee } from '../hr_types'
import { calcGOSI } from '../hr_utils'

const PAGE_SIZE = 10

export default function EmployeesList({
  tenantId, stats, isAdmin,
  onEdit, onView,
}: {
  tenantId: string
  stats: { total: number; active: number; saudi: number; expats: number; totalSalaries: number }
  isAdmin: boolean
  onEdit: (emp: HREmployee) => void
  onView: (emp: HREmployee) => void
}) {
  const router     = useRouter()
  const now        = new Date()
  const [employees, setEmployees] = useState<HREmployee[]>([])
  const [loading,   setLoading]   = useState(false)
  const [search,    setSearch]    = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [listMode,  setListMode]  = useState<'idle' | 'search' | 'all'>('idle')
  const [page,      setPage]      = useState(1)
  const [totalCount,setTotalCount]= useState(0)

  // ── جلب كل الموظفين مع pagination ──
  async function loadAll(p = 1) {
    setLoading(true)
    setListMode('all')
    setPage(p)
    const from = (p - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1
    const { data, count } = await supabase
      .from('hr_employees')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('employee_number', { ascending: true })
      .range(from, to)
    setEmployees(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }

  // ── بحث ──
  async function doSearch(q: string) {
    if (!q.trim()) return
    setLoading(true)
    setListMode('search')
    setSearch(q)
    setPage(1)
    const { data, count } = await supabase
      .from('hr_employees')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .or(`employee_number.eq.${q},first_name.ilike.%${q}%,family_name.ilike.%${q}%,father_name.ilike.%${q}%,name.ilike.%${q}%`)
      .order('employee_number', { ascending: true })
      .range(0, PAGE_SIZE - 1)
    setEmployees(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }

  // ── حذف ──
  async function handleDelete(emp: HREmployee) {
    if (!confirm(`حذف الموظف "${getEmpName(emp)}"؟`)) return
    await supabase.from('hr_employees').update({ is_active: false }).eq('id', emp.id).eq('tenant_id', tenantId)
    toast.success('تم حذف الموظف')
    loadAll(page)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  
  // ✅ دالة محسّنة للحصول على الاسم الكامل
  const getEmpName = (e: HREmployee): string => {
    // أولاً: استخدم حقل name إن كان موجوداً
    if (e.name && e.name.trim()) return e.name
    // بديل: ركب الاسم من الأجزاء
    return [e.first_name, e.father_name, e.family_name].filter(Boolean).join(' ') || '—'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        {[
          { label: 'الموظفون النشطون', value: stats.active,                                    color: '#1a56db', bg: '#eff6ff' },
          { label: 'إجمالي الرواتب',   value: `${stats.totalSalaries.toLocaleString()} ر.س`,  color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'سعوديون',           value: stats.saudi,                                    color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'وافدون',            value: stats.expats,                                   color: '#e6820a', bg: '#fffbeb' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '12px', padding: '14px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '4px' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* شريط البحث */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ width: '15px', height: '15px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch(searchInput)}
              className="input"
              style={{ paddingRight: '34px', width: '220px' }}
              placeholder="بحث بالاسم أو الرقم..."
            />
          </div>
          <button onClick={() => doSearch(searchInput)} className="btn btn-primary btn-sm" disabled={!searchInput.trim()}>
            بحث
          </button>
          <button onClick={() => { loadAll(1); setSearchInput('') }} className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)' }}>
            <Users style={{ width: '13px', height: '13px' }} /> عرض الكل ({stats.total})
          </button>
          {listMode !== 'idle' && (
            <button onClick={() => { setListMode('idle'); setEmployees([]); setSearchInput(''); setSearch('') }}
              className="btn btn-ghost btn-sm" style={{ color: 'var(--text3)', fontSize: '0.78rem' }}>
              ✕ إخفاء
            </button>
          )}
        </div>
      </div>

      {/* المحتوى */}
      {listMode === 'idle' ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '48px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <Users style={{ width: '44px', height: '44px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>ابحث عن موظف أو اضغط "عرض الكل"</p>
          <button onClick={() => loadAll(1)} className="btn btn-primary btn-sm">
            عرض جميع الموظفين
          </button>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : employees.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <Users style={{ width: '48px', height: '48px', color: 'var(--border)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text3)' }}>لا توجد نتائج</p>
        </div>
      ) : (
        <>
          {/* الجدول */}
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                    {['#', 'الرقم الوظيفي', 'الاسم', 'القسم / المسمى', 'الجنسية', 'تاريخ التعيين', 'الراتب الأساسي', 'صافي الراتب', 'GOSI', 'الحالة', 'الإجراءات'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, idx) => {
                    const totalSal   = Number(emp.basic_salary || 0) + Number(emp.housing_allow || 0) + Number(emp.transport_allow || 0) + Number(emp.other_allow || 0)
                    const iqamaDays  = emp.iqama_expiry
                      ? Math.ceil((new Date(emp.iqama_expiry).getTime() - now.getTime()) / 86400000)
                      : null
                    const gosi       = calcGOSI(emp.nationality || '', Number(emp.basic_salary || 0), Number(emp.housing_allow || 0), Number(emp.transport_allow || 0))
                    const netSalary  = totalSal - gosi.employeeDeduction
                    const isExpiring = iqamaDays !== null && iqamaDays <= 90

                    return (
                      <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}>

                        <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: '0.75rem' }}>
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.82rem', color: '#1a56db', fontWeight: 600 }}>
                          {emp.employee_number || '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a56db', fontWeight: 700, fontSize: '0.9rem' }}>
                              {(emp.first_name || '?')[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{getEmpName(emp)}</div>
                              {isExpiring && (
                                <div style={{ fontSize: '0.65rem', color: iqamaDays! <= 30 ? '#c81e1e' : '#e6820a', fontWeight: 600 }}>
                                  ⚠️ إقامة تنتهي خلال {iqamaDays} يوم
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{emp.job_title || '—'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{emp.department || ''}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, background: emp.nationality === 'سعودي' ? '#eff6ff' : '#fffbeb', color: emp.nationality === 'سعودي' ? '#1a56db' : '#e6820a' }}>
                            {emp.nationality === 'سعودي' ? '🇸🇦 سعودي' : `🌍 ${emp.nationality || 'وافد'}`}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                          {emp.hire_date ? formatDate(emp.hire_date) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.82rem', textAlign: 'left', direction: 'ltr' }}>
                          {Number(emp.basic_salary || 0).toLocaleString()} ر.س
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.82rem', color: '#0ea77b', fontWeight: 600, textAlign: 'left', direction: 'ltr' }}>
                          {netSalary.toLocaleString()} ر.س
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {emp.gosi_enrolled ? (
                            <span style={{ color: '#0ea77b', fontWeight: 600 }}>✓ مسجل</span>
                          ) : (
                            <span style={{ color: '#c81e1e', fontWeight: 600 }}>✗ غير مسجل</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, background: emp.is_active ? '#ecfdf5' : '#fef2f2', color: emp.is_active ? '#0ea77b' : '#c81e1e' }}>
                            {emp.is_active ? '✅ نشط' : '🔴 منتهي'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button onClick={() => router.push(`/hr/employees/${emp.id}`)}
                              style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', color: '#1a56db' }}>
                              <Eye style={{ width: '13px', height: '13px' }} />
                            </button>
                            {isAdmin && (
                              <>
                                <button onClick={() => onEdit(emp)}
                                  style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--text3)' }}>
                                  <Pencil style={{ width: '13px', height: '13px' }} />
                                </button>
                                <button onClick={() => handleDelete(emp)}
                                  style={{ padding: '5px 7px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#c81e1e' }}>
                                  <Trash2 style={{ width: '13px', height: '13px' }} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                  {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, totalCount)} من {totalCount} موظف
                </span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button onClick={() => loadAll(page - 1)} disabled={page === 1}
                    style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>
                    <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = i + 1
                    return (
                      <button key={p} onClick={() => loadAll(p)}
                        style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: page === p ? '#1a56db' : 'white', color: page === p ? 'white' : 'var(--text3)', cursor: 'pointer', fontWeight: page === p ? 700 : 400 }}>
                        {p}
                      </button>
                    )
                  })}
                  {totalPages > 5 && <span style={{ color: 'var(--text3)' }}>...</span>}
                  <button onClick={() => loadAll(page + 1)} disabled={page === totalPages}
                    style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}>
                    <ChevronLeft style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
