-- تجاوز أقسام التخطيط الاختيارية (على مسؤولية المستخدم)

alter table project_planning add column if not exists permit_skipped boolean default false;
alter table project_planning add column if not exists timeline_skipped boolean default false;
alter table project_planning add column if not exists safe_work_skipped boolean default false;
alter table project_planning add column if not exists risks_skipped boolean default false;
alter table project_planning add column if not exists quality_skipped boolean default false;
alter table project_planning add column if not exists costs_skipped boolean default false;
