-- إتمام الأعمال + إخلاء الطرف في مرحلة الإغلاق

alter table project_closure add column if not exists work_completion_number text;
alter table project_closure add column if not exists work_completion_date date;
alter table project_closure add column if not exists work_completion_file_path text;
alter table project_closure add column if not exists work_completion_file_name text;
alter table project_closure add column if not exists clearance_number text;
alter table project_closure add column if not exists clearance_date date;
alter table project_closure add column if not exists clearance_file_path text;
alter table project_closure add column if not exists clearance_file_name text;
