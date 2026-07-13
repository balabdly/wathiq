-- ربط صيانة الأسطول بالمشتريات والمحاسبة

alter table fleet_work_orders
  add column if not exists vendor_id bigint references finance_vendors(id),
  add column if not exists po_id bigint references finance_purchase_orders(id),
  add column if not exists vendor_invoice_id bigint references finance_vendor_invoices(id),
  add column if not exists service_confirmed_at timestamptz,
  add column if not exists cash_account_id bigint references finance_cash_accounts(id),
  add column if not exists journal_posted_at timestamptz;

alter table finance_purchase_orders
  add column if not exists fleet_work_order_id bigint references fleet_work_orders(id),
  add column if not exists source_module text;

alter table finance_vendor_invoices
  add column if not exists fleet_work_order_id bigint references fleet_work_orders(id);

create index if not exists idx_fleet_wo_po on fleet_work_orders(tenant_id, po_id);
create index if not exists idx_po_fleet_wo on finance_purchase_orders(fleet_work_order_id) where fleet_work_order_id is not null;
