import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function loadTypeScript(file) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const exports = {}
  runInNewContext(js, { exports, module: { exports } })
  return exports
}
const { calcGratuity, calcGOSI } = loadTypeScript('../src/app/(dashboard)/hr/hr_utils.ts')
const { calcAnnualLeaveBalance } = loadTypeScript('../src/lib/hrLeaveCalculations.ts')
const { overtimeHourlyRate, dailyRate, calcAttendanceStats } =
  loadTypeScript('../src/lib/payrollAttendance.ts')

test('5 exact years: resignation gets ONE THIRD of the full gratuity', () => {
  const result = calcGratuity('2021-11-12', '2026-11-12', 6000, 'استقالة')
  assert.equal(result.years, 5)
  assert.equal(result.fullAmount, 15000)
  assert.equal(result.finalAmount, 5000)
})

test('more than 5 but below 10 years: resignation gets two thirds', () => {
  const result = calcGratuity('2021-05-12', '2026-11-12', 6000, 'استقالة')
  assert.equal(result.years, 5)
  assert.equal(result.months, 6)
  assert.ok(Math.abs(result.fullAmount - 18000) < 100)
  assert.ok(Math.abs(result.finalAmount - 12000) < 100)
})

test('10 full years: resignation earns full gratuity on last actual wage', () => {
  const result = calcGratuity('2016-11-12', '2026-11-12', 6000, 'استقالة')
  assert.equal(result.fullAmount, 45000)
  assert.equal(result.finalAmount, 45000)
})

test('generic dismissal cannot automatically forfeit gratuity', () => {
  const result = calcGratuity('2021-11-12', '2026-11-12', 6000, 'فصل')
  assert.equal(result.finalAmount, 15000)
})

test('article 80 case is explicitly conditional on documented legal grounds', () => {
  const result = calcGratuity('2021-11-12', '2026-11-12', 6000, 'فصل تأديبي')
  assert.equal(result.finalAmount, 0)
  assert.match(result.entitlement, /المادة 80/)
})

test('proportionate service below one year accrues a nonzero gratuity', () => {
  const result = calcGratuity('2026-01-01', '2026-07-01', 6000, 'انتهاء عقد')
  assert.ok(result.finalAmount > 1400 && result.finalAmount < 1600)
})

test('first five years earn 105 days, NOT 150', () => {
  const r = calcAnnualLeaveBalance('2021-11-12', 0, '2026-11-12')
  assert.equal(r.totalEarned, 105)
  assert.equal(r.annualEntitlement, 30)
})

test('ten years earn 255 leave days before previously taken days', () => {
  const r = calcAnnualLeaveBalance('2016-11-12', 20, '2026-11-12')
  assert.equal(r.totalEarned, 255)
  assert.equal(r.balance, 235)
})

test('leave earned before five-year anniversary remains at 21 per year', () => {
  const r = calcAnnualLeaveBalance('2022-11-12', 0, '2026-11-12')
  assert.equal(r.totalEarned, 84)
  assert.equal(r.annualEntitlement, 21)
})

test('overtime rate uses actual hourly wage plus half basic hourly wage', () => {
  assert.ok(Math.abs(overtimeHourlyRate(4000, 1500, 500, 0) - (6000/240 + 4000/240/2)) < 0.001)
})

test('absence daily rate is based on thirty calendar days, not 26 workdays', () => {
  assert.equal(dailyRate(4000, 1000, 500, 500, 26), 200)
})

test('attendance overtime calculation incorporates fixed allowances', () => {
  const r = calcAttendanceStats([{employee_id:1,status:'حضور',overtime_hours:3}],
    {basic:4000,housing:1500,transport:500,other:0},26)
  assert.equal(r.overtime_hours, 3)
  assert.equal(r.overtime_pay, 100)
})

test('existing Saudi GOSI scheme has correct SAND and occupational breakdown', () => {
  const g = calcGOSI('سعودي', 4000, 1000, 500, 'existing', '2026-11-12')
  assert.equal(g.employeeDeduction, 487.5)
  assert.equal(g.employerContribution, 587.5)
  assert.equal(g.breakdown.employer[1].pct, '0.75%')
  assert.equal(g.breakdown.employer[2].pct, '2%')
})

test('new Saudi GOSI scheme has 10 percent pensions in July 2026', () => {
  const g = calcGOSI('سعودي', 4000, 1000, 500, 'new', '2026-11-12')
  assert.equal(g.employeeDeduction, 537.5)
  assert.equal(g.employerContribution, 637.5)
})

test('non-Saudi occupational contributions are employer-only', () => {
  const g = calcGOSI('مصري', 4000, 1000, 0, 'new', '2026-11-12')
  assert.equal(g.employeeDeduction, 0)
  assert.equal(g.employerContribution, 100)
})

test('GOSI contributory wage is capped', () => {
  const g = calcGOSI('سعودي', 50000, 20000, 0, 'existing', '2026-11-12')
  assert.equal(g.employeeDeduction, 4387.5)
})

test('missing attendance records remain unknown, not fictitiously present', () => {
  const r = calcAttendanceStats([], { basic: 4000, housing: 1500, transport: 500, other: 0 }, 26)
  assert.equal(r.present_days, 0)
  assert.equal(r.absent_days, 0)
  assert.equal(r.has_records, false)
  assert.equal(r.absence_deduct, 0)
})

test('one recorded workday cannot create 25 fictitious absences', () => {
  const r = calcAttendanceStats([
    { employee_id: 1, status: 'حضور', overtime_hours: 2 },
  ], { basic: 4000, housing: 1500, transport: 500, other: 0 }, 26)
  assert.equal(r.present_days, 1)
  assert.equal(r.absent_days, 0)
  assert.equal(r.overtime_hours, 2)
  assert.equal(r.absence_deduct, 0)
})
