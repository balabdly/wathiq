'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ───────────────────────────────────────────────────────────────────

interface Department {
  id: string;
  name: string;
  manager_id: string | null;
  manager_name?: string;
}

interface JobTitle {
  id: string;
  name: string;
  department_id: string;
  department_name?: string;
}

interface HREmployee {
  id: string;
  employee_id: string;
  name: string;
  job_title_id: string | null;
  job_title_name?: string;
  department_id: string | null;
  department_name?: string;
  nationality: string | null;
  hire_date: string | null;
  salary: number | null;
  is_active: boolean;
}

interface EmployeeBase {
  id: string;
  name: string;
  role: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HRPage() {
  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'jobtitles'>('employees');
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Employees state
  const [hrEmployees, setHrEmployees] = useState<HREmployee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [baseEmployees, setBaseEmployees] = useState<EmployeeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New employee form
  const [newEmp, setNewEmp] = useState({
    name: '',
    nationality: 'سعودي',
    hire_date: '',
    salary: '',
    department_id: '',
    job_title_id: '',
  });

  // New department form
  const [newDept, setNewDept] = useState({ name: '', manager_id: '' });

  // New job title form
  const [newTitle, setNewTitle] = useState({ name: '', department_id: '' });

  // ─── Load tenant ──────────────────────────────────────────────────────────

  useEffect(() => {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      const user = JSON.parse(stored);
      setTenantId(user.tenant_id);
    }
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    fetchAll();
  }, [tenantId]);

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchDepartments(), fetchJobTitles(), fetchHREmployees(), fetchBaseEmployees()]);
    setLoading(false);
  }

  // ─── Fetch functions ──────────────────────────────────────────────────────

  async function fetchDepartments() {
    const { data, error } = await supabase
      .from('hr_departments')
      .select(`
        id, name,
        manager_id,
        employees:manager_id ( name )
      `)
      .eq('tenant_id', tenantId);

    if (error) { console.error('departments:', error); return; }

    setDepartments(
      (data || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        manager_id: d.manager_id,
        manager_name: d.employees?.name ?? '—',
      }))
    );
  }

  async function fetchJobTitles() {
    const { data, error } = await supabase
      .from('hr_job_titles')
      .select(`
        id, name, department_id,
        hr_departments:department_id ( name )
      `)
      .eq('tenant_id', tenantId);

    if (error) { console.error('jobtitles:', error); return; }

    setJobTitles(
      (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        department_id: t.department_id,
        department_name: t.hr_departments?.name ?? '—',
      }))
    );
  }

  async function fetchHREmployees() {
    const { data, error } = await supabase
      .from('hr_employees')
      .select(`
        id,
        employee_id,
        nationality,
        hire_date,
        salary,
        is_active,
        department_id,
        job_title_id,
        employees:employee_id ( name ),
        hr_departments:department_id ( name ),
        hr_job_titles:job_title_id ( name )
      `)
      .eq('tenant_id', tenantId);

    if (error) { console.error('hr_employees:', error); return; }

    setHrEmployees(
      (data || []).map((e: any) => ({
        id: e.id,
        employee_id: e.employee_id,
        name: e.employees?.name ?? '—',
        nationality: e.nationality,
        hire_date: e.hire_date,
        salary: e.salary,
        is_active: e.is_active,
        department_id: e.department_id,
        department_name: e.hr_departments?.name ?? '—',
        job_title_id: e.job_title_id,
        job_title_name: e.hr_job_titles?.name ?? '—',
      }))
    );
  }

  async function fetchBaseEmployees() {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, role')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) { console.error('base employees:', error); return; }
    setBaseEmployees(data || []);
  }

  // ─── Add Employee ─────────────────────────────────────────────────────────

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmp.name.trim()) return showMsg('error', 'اسم الموظف مطلوب');
    if (!tenantId) return showMsg('error', 'لم يتم التعرف على المستأجر');

    try {
      // 1. Create base employee in `employees` table
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .insert({
          name: newEmp.name.trim(),
          password: '1234',
          is_active: true,
          tenant_id: tenantId,
          role: 'employee',
          permissions: {},
        })
        .select('id')
        .single();

      if (empError) throw empError;

      // 2. Create HR record — branch_id is intentionally omitted (nullable)
      const hrRecord: Record<string, any> = {
        employee_id: empData.id,
        tenant_id: tenantId,
        nationality: newEmp.nationality || null,
        hire_date: newEmp.hire_date || null,
        salary: newEmp.salary ? parseFloat(newEmp.salary) : null,
        is_active: true,
      };

      // Only include FKs when they have actual values
      if (newEmp.department_id) hrRecord.department_id = newEmp.department_id;
      if (newEmp.job_title_id) hrRecord.job_title_id = newEmp.job_title_id;

      const { error: hrError } = await supabase.from('hr_employees').insert(hrRecord);
      if (hrError) throw hrError;

      showMsg('success', `تم إضافة الموظف "${newEmp.name}" بنجاح`);
      setNewEmp({ name: '', nationality: 'سعودي', hire_date: '', salary: '', department_id: '', job_title_id: '' });
      await fetchAll();
    } catch (err: any) {
      showMsg('error', err.message || 'حدث خطأ أثناء الإضافة');
    }
  }

  // ─── Add Department ───────────────────────────────────────────────────────

  async function handleAddDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!newDept.name.trim()) return showMsg('error', 'اسم القسم مطلوب');

    const record: Record<string, any> = {
      name: newDept.name.trim(),
      tenant_id: tenantId,
    };
    if (newDept.manager_id) record.manager_id = newDept.manager_id;

    const { error } = await supabase.from('hr_departments').insert(record);
    if (error) return showMsg('error', error.message);

    showMsg('success', `تم إضافة القسم "${newDept.name}"`);
    setNewDept({ name: '', manager_id: '' });
    await fetchDepartments();
  }

  // ─── Add Job Title ────────────────────────────────────────────────────────

  async function handleAddJobTitle(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.name.trim()) return showMsg('error', 'اسم المسمى مطلوب');
    if (!newTitle.department_id) return showMsg('error', 'القسم مطلوب');

    const { error } = await supabase.from('hr_job_titles').insert({
      name: newTitle.name.trim(),
      department_id: newTitle.department_id,
      tenant_id: tenantId,
    });

    if (error) return showMsg('error', error.message);

    showMsg('success', `تم إضافة المسمى "${newTitle.name}"`);
    setNewTitle({ name: '', department_id: '' });
    await fetchJobTitles();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function showMsg(type: 'success' | 'error', text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  function filteredJobTitles(deptId: string) {
    return jobTitles.filter((t) => t.department_id === deptId);
  }

  // ─── Auto-fill manager when dept selected ────────────────────────────────

  function getDeptManager(deptId: string): string {
    const dept = departments.find((d) => d.id === deptId);
    return dept?.manager_name ?? '—';
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="hr-page">
      <style>{`
        .hr-page { padding: 24px; direction: rtl; font-family: 'Segoe UI', Tahoma, sans-serif; }

        /* Header */
        .hr-header { margin-bottom: 24px; }
        .hr-header h1 { font-size: 22px; font-weight: 700; color: #1a1a2e; margin: 0 0 4px; }
        .hr-header p { font-size: 14px; color: #6b7280; margin: 0; }

        /* Alert */
        .hr-alert {
          padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;
          font-size: 14px; display: flex; align-items: center; gap: 8px;
        }
        .hr-alert.success { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
        .hr-alert.error   { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

        /* Tabs */
        .hr-tabs { display: flex; gap: 4px; border-bottom: 2px solid #e5e7eb; margin-bottom: 28px; }
        .hr-tab {
          padding: 10px 20px; border: none; background: none; cursor: pointer;
          font-size: 14px; color: #6b7280; font-weight: 500; border-radius: 6px 6px 0 0;
          transition: all 0.15s;
        }
        .hr-tab:hover { color: #374151; background: #f9fafb; }
        .hr-tab.active {
          color: #2563eb; border-bottom: 2px solid #2563eb;
          margin-bottom: -2px; background: #eff6ff;
        }

        /* Card */
        .hr-card {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
          padding: 24px; margin-bottom: 24px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .hr-card h2 { font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 20px; }

        /* Form grid */
        .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
        .form-field { display: flex; flex-direction: column; gap: 6px; }
        .form-field label { font-size: 13px; font-weight: 500; color: #374151; }
        .form-field input,
        .form-field select {
          padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px;
          font-size: 14px; color: #111827; background: #fafafa;
          transition: border-color 0.15s;
          direction: rtl;
        }
        .form-field input:focus,
        .form-field select:focus {
          outline: none; border-color: #2563eb; background: #fff;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.08);
        }

        /* Manager info box */
        .manager-info {
          padding: 9px 12px; background: #f3f4f6; border: 1px solid #e5e7eb;
          border-radius: 8px; font-size: 14px; color: #6b7280;
        }

        /* Buttons */
        .btn-primary {
          padding: 10px 24px; background: #2563eb; color: #fff;
          border: none; border-radius: 8px; cursor: pointer; font-size: 14px;
          font-weight: 600; transition: background 0.15s; margin-top: 8px;
        }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-primary:active { background: #1e40af; }

        /* Table */
        .hr-table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        thead tr { background: #f9fafb; }
        th {
          padding: 11px 14px; text-align: right; font-size: 12px;
          font-weight: 600; color: #6b7280; text-transform: uppercase;
          letter-spacing: 0.03em; border-bottom: 1px solid #e5e7eb;
        }
        td {
          padding: 12px 14px; border-bottom: 1px solid #f3f4f6;
          color: #374151; vertical-align: middle;
        }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #f9fafb; }

        /* Badges */
        .badge {
          display: inline-block; padding: 3px 10px; border-radius: 20px;
          font-size: 12px; font-weight: 600;
        }
        .badge-active   { background: #d1fae5; color: #065f46; }
        .badge-inactive { background: #fee2e2; color: #991b1b; }
        .badge-saudi  { background: #dbeafe; color: #1e40af; }
        .badge-expat  { background: #fef3c7; color: #92400e; }

        /* Loading */
        .hr-loading { text-align: center; padding: 48px; color: #6b7280; font-size: 15px; }
        .hr-empty   { text-align: center; padding: 48px; color: #9ca3af; font-size: 14px; }

        @media (max-width: 640px) {
          .form-grid { grid-template-columns: 1fr; }
          .hr-tabs { overflow-x: auto; }
        }
      `}</style>

      {/* Header */}
      <div className="hr-header">
        <h1>🏢 الموارد البشرية</h1>
        <p>إدارة ملفات الموظفين والأقسام والمسميات الوظيفية</p>
      </div>

      {/* Alert */}
      {msg && (
        <div className={`hr-alert ${msg.type}`}>
          {msg.type === 'success' ? '✅' : '❌'} {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="hr-tabs">
        <button
          className={`hr-tab ${activeTab === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          👥 ملفات الموظفين
        </button>
        <button
          className={`hr-tab ${activeTab === 'departments' ? 'active' : ''}`}
          onClick={() => setActiveTab('departments')}
        >
          🏗️ الأقسام
        </button>
        <button
          className={`hr-tab ${activeTab === 'jobtitles' ? 'active' : ''}`}
          onClick={() => setActiveTab('jobtitles')}
        >
          🏷️ المسميات الوظيفية
        </button>
      </div>

      {/* ═══════════ TAB: EMPLOYEES ═══════════ */}
      {activeTab === 'employees' && (
        <>
          {/* Add Employee Form */}
          <div className="hr-card">
            <h2>➕ إضافة موظف جديد</h2>
            <form onSubmit={handleAddEmployee}>
              <div className="form-grid">
                {/* Name */}
                <div className="form-field" style={{ gridColumn: 'span 2' }}>
                  <label>الاسم الكامل *</label>
                  <input
                    type="text"
                    placeholder="مثال: محمد عبدالله الغامدي"
                    value={newEmp.name}
                    onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                    required
                  />
                </div>

                {/* Nationality */}
                <div className="form-field">
                  <label>الجنسية</label>
                  <select
                    value={newEmp.nationality}
                    onChange={(e) => setNewEmp({ ...newEmp, nationality: e.target.value })}
                  >
                    <option value="سعودي">🇸🇦 سعودي</option>
                    <option value="مصري">🇪🇬 مصري</option>
                    <option value="يمني">🇾🇪 يمني</option>
                    <option value="سوداني">🇸🇩 سوداني</option>
                    <option value="باكستاني">🇵🇰 باكستاني</option>
                    <option value="هندي">🇮🇳 هندي</option>
                    <option value="بنغلاديشي">🇧🇩 بنغلاديشي</option>
                    <option value="فلبيني">🇵🇭 فلبيني</option>
                    <option value="أردني">🇯🇴 أردني</option>
                    <option value="سوري">🇸🇾 سوري</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                {/* Hire date */}
                <div className="form-field">
                  <label>تاريخ التوظيف</label>
                  <input
                    type="date"
                    value={newEmp.hire_date}
                    onChange={(e) => setNewEmp({ ...newEmp, hire_date: e.target.value })}
                  />
                </div>

                {/* Salary */}
                <div className="form-field">
                  <label>الراتب الأساسي (ريال)</label>
                  <input
                    type="number"
                    placeholder="5000"
                    min="0"
                    step="0.01"
                    value={newEmp.salary}
                    onChange={(e) => setNewEmp({ ...newEmp, salary: e.target.value })}
                  />
                </div>

                {/* Department */}
                <div className="form-field">
                  <label>القسم</label>
                  <select
                    value={newEmp.department_id}
                    onChange={(e) => setNewEmp({ ...newEmp, department_id: e.target.value, job_title_id: '' })}
                  >
                    <option value="">— اختر القسم —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Job title — filtered by dept */}
                <div className="form-field">
                  <label>المسمى الوظيفي</label>
                  <select
                    value={newEmp.job_title_id}
                    onChange={(e) => setNewEmp({ ...newEmp, job_title_id: e.target.value })}
                    disabled={!newEmp.department_id}
                  >
                    <option value="">— اختر المسمى —</option>
                    {filteredJobTitles(newEmp.department_id).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Auto manager */}
                {newEmp.department_id && (
                  <div className="form-field">
                    <label>المدير المباشر (تلقائي)</label>
                    <div className="manager-info">
                      👤 {getDeptManager(newEmp.department_id)}
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary">
                💾 حفظ الموظف
              </button>
            </form>
          </div>

          {/* Employees Table */}
          <div className="hr-card">
            <h2>قائمة الموظفين ({hrEmployees.length})</h2>
            {loading ? (
              <div className="hr-loading">⏳ جاري التحميل...</div>
            ) : hrEmployees.length === 0 ? (
              <div className="hr-empty">لا يوجد موظفون بعد. أضف أول موظف من النموذج أعلاه.</div>
            ) : (
              <div className="hr-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الاسم</th>
                      <th>الجنسية</th>
                      <th>القسم</th>
                      <th>المسمى</th>
                      <th>تاريخ التوظيف</th>
                      <th>الراتب</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hrEmployees.map((emp, i) => (
                      <tr key={emp.id}>
                        <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{emp.name}</td>
                        <td>
                          <span className={`badge ${emp.nationality === 'سعودي' ? 'badge-saudi' : 'badge-expat'}`}>
                            {emp.nationality ?? '—'}
                          </span>
                        </td>
                        <td>{emp.department_name}</td>
                        <td>{emp.job_title_name}</td>
                        <td>{emp.hire_date ?? '—'}</td>
                        <td>
                          {emp.salary
                            ? `${Number(emp.salary).toLocaleString('ar-SA')} ريال`
                            : '—'}
                        </td>
                        <td>
                          <span className={`badge ${emp.is_active ? 'badge-active' : 'badge-inactive'}`}>
                            {emp.is_active ? 'نشط' : 'غير نشط'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════ TAB: DEPARTMENTS ═══════════ */}
      {activeTab === 'departments' && (
        <>
          <div className="hr-card">
            <h2>➕ إضافة قسم جديد</h2>
            <form onSubmit={handleAddDepartment}>
              <div className="form-grid">
                <div className="form-field" style={{ gridColumn: 'span 2' }}>
                  <label>اسم القسم *</label>
                  <input
                    type="text"
                    placeholder="مثال: قسم الكهرباء"
                    value={newDept.name}
                    onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>مدير القسم</label>
                  <select
                    value={newDept.manager_id}
                    onChange={(e) => setNewDept({ ...newDept, manager_id: e.target.value })}
                  >
                    <option value="">— اختر المدير —</option>
                    {baseEmployees.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary">💾 حفظ القسم</button>
            </form>
          </div>

          <div className="hr-card">
            <h2>الأقسام ({departments.length})</h2>
            {departments.length === 0 ? (
              <div className="hr-empty">لا توجد أقسام بعد.</div>
            ) : (
              <div className="hr-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>اسم القسم</th>
                      <th>المدير</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((d, i) => (
                      <tr key={d.id}>
                        <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{d.name}</td>
                        <td>{d.manager_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════ TAB: JOB TITLES ═══════════ */}
      {activeTab === 'jobtitles' && (
        <>
          <div className="hr-card">
            <h2>➕ إضافة مسمى وظيفي</h2>
            <form onSubmit={handleAddJobTitle}>
              <div className="form-grid">
                <div className="form-field">
                  <label>القسم *</label>
                  <select
                    value={newTitle.department_id}
                    onChange={(e) => setNewTitle({ ...newTitle, department_id: e.target.value })}
                    required
                  >
                    <option value="">— اختر القسم —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>المسمى الوظيفي *</label>
                  <input
                    type="text"
                    placeholder="مثال: كهربائي أول"
                    value={newTitle.name}
                    onChange={(e) => setNewTitle({ ...newTitle, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary">💾 حفظ المسمى</button>
            </form>
          </div>

          <div className="hr-card">
            <h2>المسميات الوظيفية ({jobTitles.length})</h2>
            {jobTitles.length === 0 ? (
              <div className="hr-empty">لا توجد مسميات بعد.</div>
            ) : (
              <div className="hr-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>المسمى</th>
                      <th>القسم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobTitles.map((t, i) => (
                      <tr key={t.id}>
                        <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{t.name}</td>
                        <td>{t.department_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
