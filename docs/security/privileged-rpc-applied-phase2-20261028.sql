-- Applied to connected Supabase database on 2026-10-28.
-- These changes reduce SECURITY DEFINER exposure; regression tests are still required.
ALTER FUNCTION public.reverse_finance_journal_entry(bigint,text) SECURITY INVOKER;
ALTER FUNCTION public.apply_boq_variation_order(bigint) SECURITY INVOKER;

-- Check current security flags:
SELECT p.proname, p.prosecdef
FROM pg_proc p
WHERE p.oid IN (
  'public.reverse_finance_journal_entry(bigint,text)'::regprocedure,
  'public.apply_boq_variation_order(bigint)'::regprocedure
);

-- Required before production: test reversal and variation application as an authenticated
-- user for tenant A; verify tenant B records are inaccessible; verify required
-- grants and downstream function calls (including next_doc_number).
-- Do not treat a green advisor scan alone as proof of functional compatibility.
