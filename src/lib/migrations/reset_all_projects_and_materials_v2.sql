-- تنظيف شامل: جميع المشاريع + أرصدة المواد + المقايسات (كل المستأجرين)
-- يشمل جداول PMC التي فُوِّتت في reset_all_projects_and_materials السابق

BEGIN;

-- أذونات ومخزون
DELETE FROM inventory_voucher_lines;
DELETE FROM inventory_vouchers;
DELETE FROM stock_ledger;
DELETE FROM stock_returns;

-- مطابقة وتسويات
DELETE FROM material_reconciliation_lines;
DELETE FROM material_reconciliations;

-- عهد وقروض وارصدة مشروع
DELETE FROM project_material_loans;
DELETE FROM project_material_adjustments;
DELETE FROM project_material_balances;
DELETE FROM project_materials;

-- حجوزات
DELETE FROM material_reservations;

-- مقايسات PMC (الجداول الجديدة — كانت مفقودة من التنظيف السابق)
DELETE FROM boq_variation_orders;
DELETE FROM project_boq_lines;
DELETE FROM project_boq_versions;

-- مقايسة قديمة إن وُجدت
DELETE FROM project_boq;

-- تخطيط المشاريع
DELETE FROM project_planning_cost_items;
DELETE FROM project_planning;

-- فك ربط المشاريع من باقي الأنظمة
UPDATE finance_assets SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE finance_cost_centers SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE finance_employee_custody SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE finance_expenses SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE finance_invoices SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE finance_purchase_orders SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE finance_quotations SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE finance_treasury SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE finance_vendor_invoices SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE fleet_assignments SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE fleet_fuel_logs SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE fleet_work_orders SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE hr_attendance SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE hr_project_cost SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE qhse_risks SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE quality_customer_feedback SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE quality_kpis SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE quality_supplier_evaluations SET project_id = NULL WHERE project_id IS NOT NULL;
UPDATE visits SET project_id = NULL WHERE project_id IS NOT NULL;

-- المشاريع
DELETE FROM projects;

-- أرصدة المواد في المستودعات (catalog + qty)
DELETE FROM materials;

COMMIT;
