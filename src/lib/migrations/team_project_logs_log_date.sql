-- تاريخ الإنجاز اليومي لسجل الفريق × المشروع
alter table team_project_logs add column if not exists log_date date not null default (current_date);
create index if not exists idx_team_project_logs_project_date on team_project_logs(project_id, log_date asc, created_at asc);
