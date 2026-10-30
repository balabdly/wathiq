-- Applied to Supabase project bashar-erp on 2026-10-28.
-- Retained for environment parity; not a replacement for a versioned migration.
ALTER FUNCTION public.wathiq_jwt_employee_id() SECURITY INVOKER;
ALTER FUNCTION public.get_account_ids_by_codes(text, text[]) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.repair_tenant_coa_hierarchy(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.wathiq_log_audit(text,text,text,text,jsonb,jsonb,text) FROM authenticated;

-- Verify (expected: zero rows for these two privileged functions):
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('repair_tenant_coa_hierarchy','wathiq_log_audit')
  AND has_function_privilege('authenticated',p.oid,'EXECUTE');
