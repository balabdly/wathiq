-- fix_historical_journal_account_codes.sql
-- تصحيح account_id في سطور القيود القديمة التي استخدمت أكواداً خاطئة
-- شغّل مرة واحدة لكل tenant بعد التأكد من وجود الحسابات الصحيحة في الشجرة

-- خريطة: old_code => new_code (حسب تدقيق P0)
-- 1120 (كان يُستخدم كذمم عملاء) => 1210
-- 2130 (كان يُستخدم كضريبة مخرجات) => 2320
-- 2140 (كان يُستخدم كضريبة مدخلات) => 1250
-- 1130 (كان يُستخدم كمخزون في المشتريات) => 1310

create or replace function remap_journal_line_accounts(p_tenant_id uuid)
returns table(lines_updated bigint) language plpgsql as $$
declare
  v_count bigint := 0;
  v_tmp bigint;
  mapping record;
begin
  for mapping in
    select * from (values
      ('1120', '1210'),
      ('2130', '2320'),
      ('2140', '1250'),
      ('1130', '1310')
    ) as t(old_code, new_code)
  loop
    update finance_journal_lines jl
    set account_id = new_acc.id
    from finance_journal_entries je
    join finance_accounts old_acc on old_acc.id = jl.account_id
      and old_acc.tenant_id = p_tenant_id and old_acc.code = mapping.old_code
    join finance_accounts new_acc on new_acc.tenant_id = p_tenant_id
      and new_acc.code = mapping.new_code
    where jl.entry_id = je.id
      and je.tenant_id = p_tenant_id;

    get diagnostics v_tmp = row_count;
    v_count := v_count + coalesce(v_tmp, 0);
  end loop;

  lines_updated := v_count;
  return next;
end;
$$;

-- مثال التشغيل:
-- select * from remap_journal_line_accounts('YOUR-TENANT-UUID');
