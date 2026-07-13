-- مسار تجديد الامتثال: مشتريات | مصروفات

alter table fleet_compliance_docs
  add column if not exists renewal_path text,
  add column if not exists expense_id bigint references finance_expenses(id);

alter table finance_expenses
  add column if not exists fleet_compliance_doc_id bigint references fleet_compliance_docs(id),
  add column if not exists source_module text;

create index if not exists idx_fleet_compliance_expense on fleet_compliance_docs(expense_id) where expense_id is not null;
create index if not exists idx_expense_fleet_compliance on finance_expenses(fleet_compliance_doc_id) where fleet_compliance_doc_id is not null;
