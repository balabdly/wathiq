import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const sql = readFileSync(new URL('../src/lib/migrations/zatca_phase2_egs_schema.sql', import.meta.url), 'utf8')
const lifecycleTs = readFileSync(new URL('../src/lib/zatca/egs-state.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(lifecycleTs, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const exports = {}
runInNewContext(output, { exports, module: { exports } })
const { canTransitionZatcaDocument, assertZatcaTransition, ZATCA_ISSUANCE_ENABLED } = exports

test('schema defines four tenant-scoped EGS, ledger, document and audit tables', () => {
  for (const name of ['zatca_egs_units','zatca_egs_state','zatca_documents','zatca_document_events']) {
    assert.match(sql, new RegExp('CREATE TABLE IF NOT EXISTS public\\.' + name))
    assert.match(sql, new RegExp('ALTER TABLE public\\.' + name + ' ENABLE ROW LEVEL SECURITY'))
  }
})
test('data API browser roles have no permissions', () => {
  assert.match(sql, /FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /TO service_role/)
  assert.doesNotMatch(sql, /TO authenticated\s*;/i)
  assert.doesNotMatch(sql, /CREATE POLICY/i)
})
test('no security definer and no credentials stored', () => {
  assert.doesNotMatch(sql, /SECURITY DEFINER/i)
  assert.doesNotMatch(sql, /private_key\s+(text|bytea)|otp\s+text|csid_secret\s+text|password\s+text/i)
  assert.equal((sql.match(/\$\$/g) || []).length % 2, 0)
})
test('tenant and sequence uniqueness prevent cross-company collisions', () => {
  assert.match(sql, /UNIQUE \(tenant_id, unit_code\)/)
  assert.match(sql, /UNIQUE \(egs_unit_id, icv\)/)
  assert.match(sql, /UNIQUE \(tenant_id, source_kind, source_id\)/)
  assert.match(sql, /FOREIGN KEY \(tenant_id, egs_unit_id\)/)
})
test('reserve serializes counter and requires signed predecessor', () => {
  assert.match(sql, /FOR UPDATE;/)
  assert.match(sql, /v_pending IS NOT NULL/)
  assert.match(sql, /v_previous_hash IS NULL/)
  assert.match(sql, /last_icv = v_counter \+ 1/)
  assert.match(sql, /tenant_id = v_tenant_id::text/)
})
test('production issuance is disabled by default', () => {
  assert.match(sql, /status text NOT NULL DEFAULT 'disabled'/)
  assert.match(sql, /v_environment = 'production'/)
  assert.equal(ZATCA_ISSUANCE_ENABLED, false)
})
test('audit events are append-only', () => {
  assert.match(sql, /ZATCA audit events are append-only/)
  assert.match(sql, /BEFORE UPDATE OR DELETE ON public\.zatca_document_events/)
})
test('signed document identifiers and counters cannot be rewritten', () => {
  assert.match(sql, /ZATCA document identity and signed records are immutable/)
  assert.match(sql, /NEW\.last_icv < OLD\.last_icv/)
  assert.match(sql, /NEW\.invoice_hash IS DISTINCT FROM OLD\.invoice_hash/)
})
test('standard invoice clears, simplified invoice reports', () => {
  assert.equal(canTransitionZatcaDocument('reserved','signed','standard_invoice'),true)
  assert.equal(canTransitionZatcaDocument('signed','clearance_pending','standard_invoice'),true)
  assert.equal(canTransitionZatcaDocument('signed','reporting_pending','standard_invoice'),false)
  assert.equal(canTransitionZatcaDocument('signed','reporting_pending','simplified_invoice'),true)
  assert.equal(canTransitionZatcaDocument('signed','clearance_pending','simplified_invoice'),false)
})
test('cannot jump to approved or rewind terminal issuance states', () => {
  assert.equal(canTransitionZatcaDocument('reserved','cleared','standard_invoice'),false)
  assert.equal(canTransitionZatcaDocument('cleared','reserved','standard_invoice'),false)
  assert.equal(canTransitionZatcaDocument('reported','signed','simplified_invoice'),false)
  assert.equal(canTransitionZatcaDocument('rejected','signed','standard_invoice'),false)
  assert.throws(()=>assertZatcaTransition('reserved','reported','standard_invoice'),/Invalid ZATCA/)
})
test('a retry preserves the signed stage, without reverting to draft', () => {
  assert.equal(canTransitionZatcaDocument('clearance_pending','retryable_error','standard_invoice'),true)
  assert.equal(canTransitionZatcaDocument('retryable_error','clearance_pending','standard_invoice'),true)
  assert.equal(canTransitionZatcaDocument('retryable_error','reserved','standard_invoice'),false)
})

test('ZATCA genesis PIH is explicit and bound to first ICV',()=>{
  const genesis='NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ=='
  assert.match(sql,/v_counter = 0 AND v_previous_hash/)
  assert.match(sql,/icv = 1 AND previous_invoice_hash/)
  assert.ok(sql.includes(genesis))
})

test('signed document finalization must be server-only and atomic',()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.zatca_finalize_signed_invoice/)
  assert.match(sql,/SELECT pending_document_id INTO v_pending/)
  assert.match(sql,/last_signed_invoice_hash = p_invoice_hash/)
  assert.match(sql,/pending_document_id = NULL/)
  assert.match(sql,/FROM PUBLIC, anon, authenticated/)
})
