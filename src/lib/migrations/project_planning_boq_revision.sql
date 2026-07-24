-- لقطة الكميات السابقة + مرفق موافقة SEC على تعديل المقايسة

alter table project_planning add column if not exists boq_revision_snapshot jsonb;
alter table project_planning add column if not exists boq_revision_approval_file_path text;
alter table project_planning add column if not exists boq_revision_approval_file_name text;
