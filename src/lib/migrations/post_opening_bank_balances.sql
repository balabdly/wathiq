-- قيود الأرصدة الافتتاحية للبنوك بعد تنظيف القيود القديمة
-- بنك الاهلي: 100,000 | بنك الراجحي: 10,000

DO $$
DECLARE
  v_tenant text := '11111111-1111-1111-1111-111111111111';
  v_capital bigint := 531;
  v_entry_id bigint;
  v_entry_no text;
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      (764::bigint, '1114', 'بنك الاهلي', 100000::numeric),
      (765::bigint, '1115', 'بنك الراجحي', 10000::numeric)
    ) AS t(account_id, code, name, amount)
  LOOP
    v_entry_no := next_doc_number(v_tenant, 'JE', 'JE');

    INSERT INTO finance_journal_entries (
      tenant_id, entry_number, entry_date, description,
      reference_type, reference_id, total_debit, total_credit, status, entry_source
    ) VALUES (
      v_tenant::uuid, v_entry_no, '2026-07-10',
      'رصيد افتتاحي — ' || rec.name,
      'رصيد افتتاحي', rec.account_id,
      rec.amount, rec.amount, 'معتمد', 'آلي'
    ) RETURNING id INTO v_entry_id;

    INSERT INTO finance_journal_lines (entry_id, account_id, debit, credit, description)
    VALUES
      (v_entry_id, rec.account_id, rec.amount, 0, 'رصيد افتتاحي ' || rec.name),
      (v_entry_id, v_capital, 0, rec.amount, 'أرصدة افتتاحية');
  END LOOP;
END $$;
