-- إصلاح سريع: خطأ text = uuid في get_cash_account_balances
-- شغّل هذا فقط إذا فشلت الدالة في الترحيل السابق

drop function if exists get_cash_account_balances(uuid);

create or replace function get_cash_account_balances(p_tenant_id uuid)
returns table(cash_account_id bigint, ledger_balance numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    ca.id as cash_account_id,
    coalesce(sum(jl.debit), 0) - coalesce(sum(jl.credit), 0) as ledger_balance
  from finance_cash_accounts ca
  left join finance_journal_lines jl on jl.account_id = ca.account_id
  left join finance_journal_entries je on je.id = jl.entry_id
    and je.tenant_id::text = p_tenant_id::text
    and je.status = 'معتمد'
  where ca.tenant_id::text = p_tenant_id::text
    and ca.is_active = true
  group by ca.id;
$$;

grant execute on function get_cash_account_balances(uuid) to anon, authenticated, service_role;
