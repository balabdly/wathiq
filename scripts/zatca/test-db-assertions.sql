\set ON_ERROR_STOP on
\echo [ZATCA DB] Running executed PostgreSQL assertions

DO $$
DECLARE
  v_name text;
  v_has_rls boolean;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['zatca_egs_units','zatca_egs_state','zatca_documents','zatca_document_events'] LOOP
    SELECT c.relrowsecurity INTO v_has_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=v_name;
    IF v_has_rls IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Missing RLS for %', v_name;
    END IF;
    IF has_table_privilege('anon','public.'||v_name,'SELECT') OR
       has_table_privilege('authenticated','public.'||v_name,'SELECT') OR
       has_table_privilege('authenticated','public.'||v_name,'INSERT') THEN
       RAISE EXCEPTION 'Browser roles have forbidden permissions on %', v_name;
    END IF;
  END LOOP;
  IF has_function_privilege('authenticated',
      'public.zatca_reserve_sales_invoice(uuid,bigint,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Unauthorised browser execution of reserve function';
  END IF;
  RAISE NOTICE 'PASS: four tables RLS, browser ACL and function restrictions';
END $$;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.zatca_egs_state) <> 4 THEN
    RAISE EXCEPTION 'EGS state trigger did not create each counter';
  END IF;
  IF EXISTS(SELECT 1 FROM public.zatca_egs_state WHERE last_icv <> 0) THEN
    RAISE EXCEPTION 'New EGS counters must start at zero';
  END IF;
  RAISE NOTICE 'PASS: isolated initial state for all four EGS units';
END $$;

SET ROLE service_role;
SELECT reserved_document_id, reserved_icv, reserved_previous_hash
FROM public.zatca_reserve_sales_invoice(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',101,
  '11111111-aaaa-4111-8111-aaaaaaaaaaaa'
);
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.zatca_documents
    WHERE egs_unit_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND source_id=101 AND icv=1 AND status='reserved'
  ) THEN RAISE EXCEPTION 'Missing reserved document'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.zatca_egs_state
    WHERE egs_unit_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND last_icv=1 AND pending_document_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'Counter not atomically updated'; END IF;
  IF (SELECT count(*) FROM public.zatca_document_events WHERE event_type='reserved') <> 1 THEN
    RAISE EXCEPTION 'Missing append-only reservation audit event'; END IF;
  RAISE NOTICE 'PASS: atomic reservation, counter update, audit event';
END $$;

SET ROLE service_role;
DO $$
DECLARE v_failed boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.zatca_reserve_sales_invoice(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',102,
      '22222222-aaaa-4222-8222-aaaaaaaaaaaa');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%previous document must be signed%' THEN
      RAISE EXCEPTION 'Unexpected pending error: %', SQLERRM;
    END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Pending document allowed second reservation'; END IF;
  RAISE NOTICE 'PASS: next invoice blocked until predecessor finalization';
END $$;

DO $$
DECLARE v_failed boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.zatca_reserve_sales_invoice(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',101,
      '33333333-bbbb-4333-8333-bbbbbbbbbbbb');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%source invoice not found%' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Cross-tenant source invoice accepted'; END IF;
  RAISE NOTICE 'PASS: cannot issue company A invoice from company B EGS';
END $$;

DO $$
DECLARE v_failed boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.zatca_reserve_sales_invoice(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',103,
      '44444444-aaaa-4444-8444-aaaaaaaaaaaa');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%source invoice not found%' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Draft invoice allowed ZATCA reservation'; END IF;
  RAISE NOTICE 'PASS: draft invoice not reservable';
END $$;

DO $$
DECLARE v_failed boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.zatca_reserve_sales_invoice(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',102,
      '55555555-dddd-4555-8555-dddddddddddd');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Production issue is disabled%' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Production route unexpectedly enabled'; END IF;
  RAISE NOTICE 'PASS: production issuance remains disabled';
END $$;

DO $$
DECLARE v_failed boolean := false;
BEGIN
  BEGIN
    UPDATE public.zatca_documents SET icv=8
     WHERE egs_unit_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%immutable%' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'ICV rewrite allowed'; END IF;
  RAISE NOTICE 'PASS: issued identity and counter immutable';
END $$;

DO $$
DECLARE v_failed boolean := false;
BEGIN
  BEGIN
    UPDATE public.zatca_document_events SET event_type='fake';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%append-only%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Audit trail was mutable'; END IF;
  RAISE NOTICE 'PASS: event audit trail append-only';
END $$;

DO $$
DECLARE v_failed boolean := false;
BEGIN
  BEGIN
    UPDATE public.zatca_documents SET status='cleared'
    WHERE egs_unit_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Invalid ZATCA status transition%' AND
       SQLERRM NOT LIKE '%check constraint%' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Direct approval without signing was allowed'; END IF;
  RAISE NOTICE 'PASS: no false clearance without signed XML';
END $$;
RESET ROLE;

-- Even a database owner must pass through the immutable event trigger.
DO $$
DECLARE v_failed boolean := false;
BEGIN
  BEGIN
    UPDATE public.zatca_document_events SET event_type = 'tampered';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%append-only%' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Audit modification allowed to table owner'; END IF;
  RAISE NOTICE 'PASS: database owner cannot bypass append-only trigger';
END $$;

DO $$
BEGIN
  IF has_table_privilege('service_role','public.zatca_document_events','UPDATE') THEN
    RAISE EXCEPTION 'Service role must not have UPDATE on audit events';
  END IF;
  RAISE NOTICE 'PASS: service_role has no audit UPDATE privilege';
END $$;

DO $$
BEGIN
  IF (SELECT last_icv FROM public.zatca_egs_state
     WHERE egs_unit_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 1 THEN
    RAISE EXCEPTION 'Failed attempts modified the counter'; END IF;
  IF (SELECT count(*) FROM public.zatca_documents
     WHERE egs_unit_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 1 THEN
    RAISE EXCEPTION 'Failed attempts inserted extra documents'; END IF;
  RAISE NOTICE 'PASS: failed attempts do not advance the ICV';
END $$;

-- The finalization RPC is exercised only after a mocked, trusted signature
-- verification workflow. The DB cannot independently verify Storage existence.
SET ROLE service_role;
DO $$
DECLARE
  v_document uuid;
  v_egs uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_hash text := repeat('B',43) || '=';
  v_failed boolean := false;
BEGIN
  SELECT id INTO v_document FROM public.zatca_documents
  WHERE egs_unit_id = v_egs AND source_id = 101;
  BEGIN
    PERFORM public.zatca_finalize_signed_invoice(
      v_egs, v_document, 'incorrect',
      'zatca/11111111-1111-4111-8111-111111111111/' || v_egs::text
      || '/' || v_document::text || '/invoice.xml');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%32-byte SHA-256%' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Malformed signed hash accepted'; END IF;
  v_failed := false;
  BEGIN
    PERFORM public.zatca_finalize_signed_invoice(
      v_egs, v_document, v_hash, 'zatca/another-tenant/forged.xml');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%private path%' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Cross-tenant XML storage path accepted'; END IF;
  PERFORM public.zatca_finalize_signed_invoice(
    v_egs, v_document, v_hash,
    'zatca/11111111-1111-4111-8111-111111111111/' || v_egs::text
    || '/' || v_document::text || '/signed.xml');
  IF NOT EXISTS (SELECT 1 FROM public.zatca_egs_state
       WHERE egs_unit_id=v_egs AND pending_document_id IS NULL
       AND last_icv=1 AND last_signed_invoice_hash=v_hash) THEN
    RAISE EXCEPTION 'Signing did not atomically close the pending reservation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.zatca_documents
       WHERE id=v_document AND status='signed' AND invoice_hash=v_hash) THEN
    RAISE EXCEPTION 'Signed document was not persisted'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.zatca_document_events
      WHERE document_id=v_document AND event_type='signed') THEN
    RAISE EXCEPTION 'Signing event was not recorded'; END IF;
  v_failed := false;
  BEGIN
    PERFORM public.zatca_finalize_signed_invoice(
      v_egs, v_document, v_hash,
      'zatca/11111111-1111-4111-8111-111111111111/' || v_egs::text
      || '/' || v_document::text || '/signed.xml');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%not the pending%' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Duplicate finalization was accepted'; END IF;
  RAISE NOTICE 'PASS: finalization closes pending state, logs, and cannot be replayed';
END $$;

SELECT * FROM public.zatca_reserve_sales_invoice(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 102,
  '88888888-aaaa-4888-8888-aaaaaaaaaaaa'
);
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM public.zatca_documents
    WHERE egs_unit_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND source_id=102 AND icv=2 AND previous_invoice_hash = repeat('B',43) || '='
  ) THEN RAISE EXCEPTION 'Second invoice did not inherit preceding signed hash'; END IF;
  IF (SELECT count(*) FROM public.zatca_documents
    WHERE egs_unit_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 2 THEN
    RAISE EXCEPTION 'Second document was not properly reserved'; END IF;
  RAISE NOTICE 'PASS: next invoice gets ICV=2 and predecessor signed PIH';
END $$;

\echo [ZATCA DB] All integration assertions passed
