# Privileged RPC remediation — review required before deployment

Audit date: 2026-10-28. Source: Supabase pg_proc definitions and privilege inspection. This document does not apply changes to production functions.

## Confirmed exposure

All ten overloads/functions below are SECURITY DEFINER and callable by authenticated:

| Function | Risk | Recommended remediation |
| --- | --- | --- |
| apply_boq_variation_order(bigint) | Resolves variation by ID only; no JWT tenant check | Validate row tenant against trusted app_metadata tenant; ensure parent BOQ belongs to same tenant; enforce role permission |
| finalize_reservation_reconciliation(uuid,bigint,bigint,text) | Caller-controlled tenant; joined IDs need tenant checks | Check trusted JWT tenant, reservation/project/version/material tenant ownership |
| get_account_ids_by_codes(text,text[]) | Read function bypasses RLS | Prefer SECURITY INVOKER, verify tenant RLS and caller's JWT tenant |
| increment_pm_received(uuid,int,int,int,numeric) | Caller-controlled tenant and quantity | Validate JWT tenant, project/material/warehouse ownership and positive finite quantity |
| increment_pm_received(uuid,int,int,int,numeric,text) | Same; duplicate transaction handling can race | Same checks, atomic idempotency and uniqueness |
| post_inventory_voucher(jsonb) | Payload tenant chosen by caller; updates inventory | Validate trusted tenant, branch/warehouse/project/reservation/material ownership before any write |
| repair_tenant_coa_hierarchy(uuid) | Bulk modifies COA for arbitrary tenant | Restrict to admin-only server operation; do not expose to normal authenticated users |
| reverse_finance_journal_entry(bigint,text) | Entry resolved by ID without tenant check | Validate original entry tenant against trusted JWT; authorize reversal and fiscal period |
| wathiq_jwt_employee_id() | SECURITY DEFINER not required for JWT claim | Convert to SECURITY INVOKER after dependency test |
| wathiq_log_audit(text,text,text,text,jsonb,jsonb,text) | Caller controls tenant, changed_by and audit contents | Enforce trusted tenant and actor, or restrict to server; never trust caller identity |

## Required test matrix (two test tenants A and B)

1. User A calls every privileged RPC with B's tenant ID or B's record ID: must fail with no mutations.
2. User A calls with A's IDs but B's related project, warehouse, material or BOQ version: must fail.
3. Unauthenticated caller must not be able to execute privileged RPCs.
4. User A without relevant module permission must fail for write operations.
5. Authorized A calls should succeed and leave consistent inventory/accounting balances.
6. Concurrent duplicate inventory receipts and reversals must not post twice.
7. Check RLS with actual user JWT, not only SQL superuser; verify both SELECT and UPDATE/INSERT.
8. Check that revoking/altering EXECUTE does not break application paths.

## Deployment gates

- Create versioned SQL migration, review function dependencies and roles.
- Use trusted auth.jwt()->'app_metadata'->>'tenant_id', never user_metadata or request-provided tenant alone.
- Test on staging/test tenants; retain backups and rollback scripts.
- Re-run Supabase security advisors and full application regression tests.
- Do not merge the security branch or deploy until verification.
