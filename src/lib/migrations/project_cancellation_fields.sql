-- إلغاء المشروع (حذف منطقي مع سبب)

alter table projects add column if not exists cancellation_reason text;
alter table projects add column if not exists cancelled_at timestamptz;
