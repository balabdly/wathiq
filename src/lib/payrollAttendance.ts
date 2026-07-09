/**
 * payrollAttendance.ts — ربط الحضور بالرواتب
 */

export const DEFAULT_WORKING_DAYS = 26

export type AttendancePayrollStats = {
  present_days: number
  absent_days: number
  leave_days: number
  overtime_hours: number
  absence_deduct: number
  overtime_pay: number
  working_days: number
  has_records: boolean
}

const PRESENT_STATUSES = new Set(['حضور', 'مأمورية', 'إجازة'])
const ABSENT_STATUSES  = new Set(['غياب'])

/** أيام العمل القياسية في الشهر (26 يوم — ممارسة سعودية شائعة) */
export function getWorkingDaysInMonth(month: number, year: number): number {
  // يمكن تخصيصه لاحقاً حسب تقويم الشركة — حالياً 26 يوم عمل
  void month; void year
  return DEFAULT_WORKING_DAYS
}

/** الراتب اليومي للخصومات */
export function dailyRate(basic: number, housing: number, transport: number, other: number, workingDays = DEFAULT_WORKING_DAYS): number {
  return (basic + housing + transport + other) / workingDays
}

/** أجر الساعة الإضافية — 150% من الأجر الأساسي/ساعة */
export function overtimeHourlyRate(basic: number): number {
  return (basic / 30 / 8) * 1.5
}

type AttendanceRow = {
  employee_id: number
  status: string
  overtime_hours?: number | null
}

/** حساب إحصائيات الحضور لموظف واحد */
export function calcAttendanceStats(
  records: AttendanceRow[],
  salary: { basic: number; housing: number; transport: number; other: number },
  workingDays = DEFAULT_WORKING_DAYS
): AttendancePayrollStats {
  if (!records.length) {
    return {
      present_days: workingDays,
      absent_days: 0,
      leave_days: 0,
      overtime_hours: 0,
      absence_deduct: 0,
      overtime_pay: 0,
      working_days: workingDays,
      has_records: false,
    }
  }

  let present = 0
  let absent = 0
  let leave = 0
  let overtimeHours = 0

  for (const r of records) {
    if (PRESENT_STATUSES.has(r.status)) {
      if (r.status === 'إجازة') leave++
      else present++
    } else if (ABSENT_STATUSES.has(r.status)) {
      absent++
    }
    overtimeHours += Number(r.overtime_hours || 0)
  }

  const daily = dailyRate(salary.basic, salary.housing, salary.transport, salary.other, workingDays)
  const absenceDeduct = Math.round(daily * absent)
  const overtimePay = Math.round(overtimeHourlyRate(salary.basic) * overtimeHours)

  return {
    present_days: present + leave,
    absent_days: absent,
    leave_days: leave,
    overtime_hours: overtimeHours,
    absence_deduct: absenceDeduct,
    overtime_pay: overtimePay,
    working_days: workingDays,
    has_records: true,
  }
}

/** جلب سجلات الحضور لشهر معين وتجميعها حسب الموظف */
export async function fetchAttendanceByEmployee(
  supabase: { from: (t: string) => any },
  tenantId: string,
  month: number,
  year: number
): Promise<Record<number, AttendanceRow[]>> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data } = await supabase
    .from('hr_attendance')
    .select('employee_id, status, overtime_hours')
    .eq('tenant_id', tenantId)
    .gte('date', start)
    .lte('date', end)

  const map: Record<number, AttendanceRow[]> = {}
  for (const row of (data || []) as AttendanceRow[]) {
    if (!map[row.employee_id]) map[row.employee_id] = []
    map[row.employee_id].push(row)
  }
  return map
}

/** خصم الإنذارات التأديبية (أيام × الراتب اليومي) */
export function calcDisciplinaryDeduct(
  deducts: { salary_deduct_days: number }[],
  daily: number
): number {
  return Math.round(
    deducts.reduce((s, d) => s + Number(d.salary_deduct_days || 0), 0) * daily
  )
}
