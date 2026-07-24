-- تصنيف بنود المقايسة: مواد | أعمال

alter table project_boq_lines
  add column if not exists line_category text not null default 'WORK'
  check (line_category in ('MATERIAL', 'WORK'));

create index if not exists idx_boq_lines_category on project_boq_lines(boq_version_id, line_category);
