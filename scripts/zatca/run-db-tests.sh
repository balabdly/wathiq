#!/usr/bin/env bash
set -euo pipefail






printf '[ZATCA DB] Loading schema in disposable PostgreSQL\n'
psql -X -v ON_ERROR_STOP=1 -f scripts/zatca/test-db-bootstrap.sql
printf '[ZATCA DB] Running authorization and ledger assertions\n'
psql -X -v ON_ERROR_STOP=1 -f scripts/zatca/test-db-assertions.sql

printf '[ZATCA DB] Testing two concurrent invoice reservations on one EGS\n'
first_log="$(mktemp)"
second_log="$(mktemp)"
trap 'rm -f "$first_log" "$second_log"' EXIT

# Reserve invoice 102 and hold the row lock until pg_sleep completes. The
# competing reservation for invoice 104 must wait, then fail on pending state.
psql -X -v ON_ERROR_STOP=1 -c "
  SET ROLE service_role;
  BEGIN;
  SELECT * FROM public.zatca_reserve_sales_invoice(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    104,
    '66666666-cccc-4666-8666-cccccccccccc');
  SELECT pg_sleep(4);
  COMMIT;
" > "$first_log" 2>&1 &
first_pid="$!"
sleep 1

set +e
psql -X -v ON_ERROR_STOP=1 -c "
  SET ROLE service_role;
  SELECT * FROM public.zatca_reserve_sales_invoice(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    105,
    '77777777-cccc-4777-8777-cccccccccccc');
" > "$second_log" 2>&1
second_result="$?"
set -e
wait "$first_pid"

if [ "$second_result" -eq 0 ]; then
  echo 'ERROR: concurrent reservation unexpectedly succeeded'
  cat "$second_log"
  exit 1
fi
if ! grep -qi "previous document must be signed" "$second_log"; then
  echo 'ERROR: competing reservation failed for an unexpected reason'
  cat "$second_log"
  exit 1
fi
printf '[ZATCA DB] PASS: competing reservation waited and was rejected by pending state\n'

psql -X -v ON_ERROR_STOP=1 -c "
DO \$\$
BEGIN
  IF (SELECT count(*) FROM public.zatca_documents
      WHERE egs_unit_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 1
     OR (SELECT last_icv FROM public.zatca_egs_state
      WHERE egs_unit_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 1 THEN
     RAISE EXCEPTION 'Concurrent reservation duplicated or skipped ICV';
  END IF;
  RAISE NOTICE 'PASS: concurrent ICV is one, without duplicate';
END
\$\$;"
printf '[ZATCA DB] All live integration and concurrency tests passed\n'
