-- ══════════════════════════════════════════════════════
-- حذف مرتجعات مشتريات وهمية — شركة بينوفا
-- القيود المرتبطة عُكست مسبقاً في fix_binova_test_journals_v2
-- آمن للتشغيل المتكرر
-- ══════════════════════════════════════════════════════

delete from finance_purchase_return_items
where return_id in (
  select id from finance_purchase_returns
  where tenant_id = 'b357e22b-dd39-482d-96e8-47c8f99691aa'
    and return_number in ('PR-2026-0001', 'PR-2026-0002', 'PR-2026-0003')
);

delete from finance_purchase_returns
where tenant_id = 'b357e22b-dd39-482d-96e8-47c8f99691aa'
  and return_number in ('PR-2026-0001', 'PR-2026-0002', 'PR-2026-0003');
