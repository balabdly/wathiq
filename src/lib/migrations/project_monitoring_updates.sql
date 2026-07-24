-- استشاري المشروع + مبلغ المقايسة المعتمد/المعدّل

alter table projects add column if not exists responsible_consultant text;

alter table project_planning add column if not exists estimate_total_override numeric;
alter table project_planning add column if not exists estimate_total_note text;
