-- ══════════════════════════════════════════════════
-- Migration: إضافة حقول وقت الحضور والانصراف لجدول hr_attendance
-- نفّذ هذا في Supabase SQL Editor
-- ══════════════════════════════════════════════════

-- إضافة عمود وقت الحضور (اختياري)
alter table hr_attendance
  add column if not exists check_in time;

-- إضافة عمود وقت الانصراف (اختياري)
alter table hr_attendance
  add column if not exists check_out time;

-- إضافة فهرس لتسريع الاستعلامات على التاريخ والموظف
create index if not exists idx_hr_attendance_employee_date
  on hr_attendance(employee_id, date);
