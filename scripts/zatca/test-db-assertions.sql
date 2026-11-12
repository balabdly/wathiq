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
    IF SQLERRM NOT LIKE '%append-only%' THEN RAISE; END IF;
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
\echo [ZATCA DB] All integration assertions passed
