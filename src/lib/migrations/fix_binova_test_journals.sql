-- ══════════════════════════════════════════════════════
-- عكس قيود اختبارية خاطئة — شركة بينوفا
-- JE-2026-0006/0008/0013: مرتجعات مشتريات بمبالغ وهمية ضخمة
-- JE-2026-0015: صرف مصروف على حساب ذمم الموردين (2110) بالخطأ
-- آمن للتشغيل المتكرر — يتخطى القيود المُعكوسة مسبقاً
-- ══════════════════════════════════════════════════════

create or replace function reverse_finance_journal_entry(
  p_entry_id bigint,
  p_reversal_ref_type text default 'عكس قيد'
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orig   finance_journal_entries%rowtype;
  v_new_id bigint;
  v_entry_no text;
begin
  select * into v_orig from finance_journal_entries where id = p_entry_id;
  if not found then
    return null;
  end if;

  if exists (
    select 1 from finance_journal_entries
    where tenant_id = v_orig.tenant_id
      and reference_type = p_reversal_ref_type
      and reference_id = p_entry_id
  ) then
    return null;
  end if;

  v_entry_no := next_doc_number(v_orig.tenant_id, 'JE', 'JE');

  insert into finance_journal_entries (
    tenant_id, entry_number, entry_date, description,
    reference_type, reference_id, total_debit, total_credit, status, entry_source
  ) values (
    v_orig.tenant_id,
    v_entry_no,
    current_date,
    'عكس: ' || v_orig.description,
    p_reversal_ref_type,
    p_entry_id,
    v_orig.total_credit,
    v_orig.total_debit,
    'معتمد',
    'آلي'
  )
  returning id into v_new_id;

  insert into finance_journal_lines (entry_id, account_id, debit, credit, description, cost_center_id)
  select
    v_new_id,
    jl.account_id,
    jl.credit,
    jl.debit,
    'عكس: ' || coalesce(jl.description, ''),
    jl.cost_center_id
  from finance_journal_lines jl
  where jl.entry_id = p_entry_id;

  return v_new_id;
end;
$$;

-- بينوفا: عكس القيود الخاطئة فقط (لا يمس JE-2026-0012 دفع المورد الصحيح)
select reverse_finance_journal_entry(21, 'عكس مرتجع');
select reverse_finance_journal_entry(23, 'عكس مرتجع');
select reverse_finance_journal_entry(87, 'عكس مرتجع');
select reverse_finance_journal_entry(89, 'عكس صرف');
