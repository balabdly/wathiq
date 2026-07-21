-- نسبة الإنجاز التراكمية عند تسجيل الإنجاز اليومي
alter table team_project_logs add column if not exists progress_percent numeric(5,2);
