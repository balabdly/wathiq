-- تجديد وثائق امتثال الأسطول + ربط المشتريات

alter table fleet_compliance_docs
  add column if not exists is_active boolean default true,
  add column if not exists replaces_id bigint references fleet_compliance_docs(id),
  add column if not exists replaced_by_id bigint references fleet_compliance_docs(id),
  add column if not exists po_id bigint references finance_purchase_orders(id),
  add column if not exists vendor_id bigint references finance_vendors(id);

alter table finance_purchase_orders
  add column if not exists fleet_compliance_doc_id bigint references fleet_compliance_docs(id);

update fleet_compliance_docs set is_active = true where is_active is null;

create index if not exists idx_fleet_compliance_active on fleet_compliance_docs(tenant_id, unit_id, is_active) where is_active = true;
