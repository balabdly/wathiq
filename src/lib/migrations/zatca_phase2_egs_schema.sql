-- Wathiq / ZATCA phase 2 — STAGED migration.
-- Do not run against production until reviewed on a database clone.
-- This migration intentionally creates NO API for official issuance.
-- All objects in exposed public schema have RLS enabled and NO browser policies.
-- Only server-side service_role may access the data.
-- Credentials, private keys, CSID secrets, tokens, passwords and OTPs
-- MUST NEVER be stored in these tables.

CREATE TABLE IF NOT EXISTS public.zatca_egs_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  unit_code text NOT NULL CHECK (length(trim(unit_code)) BETWEEN 1 AND 80),
  environment text NOT NULL DEFAULT 'simulation'
    CHECK (environment IN ('sandbox', 'simulation', 'production')),
  status text NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('disabled', 'testing', 'active', 'suspended')),
  certificate_fingerprint text,
  certificate_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, unit_code),
  UNIQUE (tenant_id, id),
  CHECK (status <> 'active' OR environment <> 'sandbox')
);

CREATE TABLE IF NOT EXISTS public.zatca_egs_state (
  egs_unit_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  last_icv bigint NOT NULL DEFAULT 0 CHECK (last_icv >= 0),
  last_signed_invoice_hash text,
  pending_document_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, egs_unit_id),
  FOREIGN KEY (tenant_id, egs_unit_id)
    REFERENCES public.zatca_egs_units (tenant_id, id) ON DELETE RESTRICT,
  CHECK (last_signed_invoice_hash IS NULL OR
    (last_signed_invoice_hash ~ '^[A-Za-z0-9+/]{43}=$'
      OR last_signed_invoice_hash = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ=='))
);

CREATE TABLE IF NOT EXISTS public.zatca_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  egs_unit_id uuid NOT NULL,
  source_kind text NOT NULL
    CHECK (source_kind IN ('sales_invoice', 'sales_credit_note', 'sales_debit_note')),
  source_id bigint NOT NULL CHECK (source_id > 0),
  document_type text NOT NULL CHECK (document_type IN
    ('standard_invoice', 'simplified_invoice', 'standard_credit_note',
     'simplified_credit_note', 'standard_debit_note', 'simplified_debit_note')),
  invoice_number text NOT NULL CHECK (length(trim(invoice_number)) > 0),
  document_uuid uuid NOT NULL UNIQUE,
  icv bigint NOT NULL CHECK (icv > 0),
  previous_invoice_hash text NOT NULL
    CHECK ((icv = 1 AND previous_invoice_hash = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==')
      OR (icv > 1 AND previous_invoice_hash ~ '^[A-Za-z0-9+/]{43}=$')),
  invoice_hash text
    CHECK (invoice_hash IS NULL OR invoice_hash ~ '^[A-Za-z0-9+/]{43}=$'),
  unsigned_xml_storage_path text,
  signed_xml_storage_path text,
  authority_response_storage_path text,
  authority_status text,
  authority_request_id text,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN (
      'reserved', 'signed', 'clearance_pending', 'cleared',
      'reporting_pending', 'reported', 'rejected', 'retryable_error'
    )),
  issued_at timestamptz,
  signed_at timestamptz,
  submitted_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (egs_unit_id, icv),
  UNIQUE (tenant_id, source_kind, source_id),
  FOREIGN KEY (tenant_id, egs_unit_id)
    REFERENCES public.zatca_egs_units (tenant_id, id) ON DELETE RESTRICT,
  CHECK (invoice_hash IS NOT NULL OR status = 'reserved'),
  CHECK (signed_xml_storage_path IS NOT NULL OR status = 'reserved'),
  CHECK (position('..' in coalesce(signed_xml_storage_path, '')) = 0)
);

CREATE TABLE IF NOT EXISTS public.zatca_document_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL,
  document_id uuid NOT NULL,
  event_type text NOT NULL CHECK (length(trim(event_type)) > 0),
  result_code text,
  message text,
  -- Metadata only; NEVER store complete payloads, credentials, OTP or PII.
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, document_id)
    REFERENCES public.zatca_documents (tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_zatca_documents_tenant_status
  ON public.zatca_documents (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zatca_events_document
  ON public.zatca_document_events (tenant_id, document_id, created_at);

-- Initialize the EGS counter independently of browser-side user state.
CREATE OR REPLACE FUNCTION public.zatca_init_egs_state()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.zatca_egs_state (tenant_id, egs_unit_id)
  VALUES (NEW.tenant_id, NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_zatca_init_egs_state ON public.zatca_egs_units;
CREATE TRIGGER trg_zatca_init_egs_state
AFTER INSERT ON public.zatca_egs_units
FOR EACH ROW EXECUTE FUNCTION public.zatca_init_egs_state();

-- Immutable audit history (including service-role writes).
CREATE OR REPLACE FUNCTION public.zatca_block_event_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'ZATCA audit events are append-only';
END;
$$;
DROP TRIGGER IF EXISTS trg_zatca_events_append_only ON public.zatca_document_events;
CREATE TRIGGER trg_zatca_events_append_only
BEFORE UPDATE OR DELETE ON public.zatca_document_events
FOR EACH ROW EXECUTE FUNCTION public.zatca_block_event_changes();

-- Protect identity, sequence and signed content against accidental rewrites.
CREATE OR REPLACE FUNCTION public.zatca_protect_document_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Issued ZATCA document records may not be deleted';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.egs_unit_id IS DISTINCT FROM OLD.egs_unit_id
     OR NEW.icv IS DISTINCT FROM OLD.icv
     OR NEW.document_uuid IS DISTINCT FROM OLD.document_uuid
     OR NEW.source_kind IS DISTINCT FROM OLD.source_kind
     OR NEW.source_id IS DISTINCT FROM OLD.source_id
     OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
     OR NEW.document_type IS DISTINCT FROM OLD.document_type
     OR NEW.previous_invoice_hash IS DISTINCT FROM OLD.previous_invoice_hash
     OR (OLD.invoice_hash IS NOT NULL AND NEW.invoice_hash IS DISTINCT FROM OLD.invoice_hash)
     OR (OLD.signed_xml_storage_path IS NOT NULL
         AND NEW.signed_xml_storage_path IS DISTINCT FROM OLD.signed_xml_storage_path)
  THEN
    RAISE EXCEPTION 'ZATCA document identity and signed records are immutable';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'reserved' AND NEW.status = 'signed')
    OR (OLD.status = 'signed' AND NEW.status IN ('clearance_pending','reporting_pending'))
    OR (OLD.status = 'clearance_pending' AND NEW.status IN ('cleared','rejected','retryable_error'))
    OR (OLD.status = 'reporting_pending' AND NEW.status IN ('reported','rejected','retryable_error'))
    OR (OLD.status = 'retryable_error' AND NEW.status IN ('clearance_pending','reporting_pending'))
  ) THEN
    RAISE EXCEPTION 'Invalid ZATCA status transition from % to %', OLD.status, NEW.status;
  END IF;
  IF NEW.status = 'clearance_pending' AND
       NEW.document_type NOT IN ('standard_invoice','standard_credit_note','standard_debit_note') THEN
    RAISE EXCEPTION 'Only standard invoices/notes can request clearance';
  END IF;
  IF NEW.status = 'reporting_pending' AND
       NEW.document_type NOT IN ('simplified_invoice','simplified_credit_note','simplified_debit_note') THEN
    RAISE EXCEPTION 'Only simplified invoices/notes can request reporting';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
-- Prevent rolling back an allocated counter and reassignment of the EGS state.
CREATE OR REPLACE FUNCTION public.zatca_protect_egs_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'EGS counters must not be deleted';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.egs_unit_id IS DISTINCT FROM OLD.egs_unit_id
     OR NEW.last_icv < OLD.last_icv THEN
    RAISE EXCEPTION 'EGS counter is immutable and must only increase';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_zatca_counter_protect ON public.zatca_egs_state;
CREATE TRIGGER trg_zatca_counter_protect
BEFORE UPDATE OR DELETE ON public.zatca_egs_state
FOR EACH ROW EXECUTE FUNCTION public.zatca_protect_egs_counter();

DROP TRIGGER IF EXISTS trg_zatca_documents_immutable ON public.zatca_documents;
CREATE TRIGGER trg_zatca_documents_immutable
BEFORE UPDATE OR DELETE ON public.zatca_documents
FOR EACH ROW EXECUTE FUNCTION public.zatca_protect_document_identity();

-- SERVER ONLY: allocate an ICV and its previous signed hash atomically.
-- Fail closed until a genuine onboarded EGS has a trusted initial PIH.
-- Only one document can be pending signature on an EGS at any time.
-- Stage 2 must implement trusted signing/finalization before next reservation.
CREATE OR REPLACE FUNCTION public.zatca_reserve_sales_invoice(
  p_egs_unit_id uuid, p_invoice_id bigint, p_document_uuid uuid
)
RETURNS TABLE (
  reserved_document_id uuid,
  reserved_icv bigint,
  reserved_previous_hash text
)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE
  v_tenant_id uuid;
  v_status text;
  v_environment text;
  v_invoice_number text;
  v_counter bigint;
  v_previous_hash text;
  v_pending uuid;
  v_doc_id uuid;
BEGIN
  SELECT tenant_id, status, environment
    INTO v_tenant_id, v_status, v_environment
  FROM public.zatca_egs_units
  WHERE id = p_egs_unit_id;

  IF v_tenant_id IS NULL OR v_status NOT IN ('testing','active') THEN
    RAISE EXCEPTION 'EGS is missing or disabled';
  END IF;
  IF v_environment = 'production' THEN
    RAISE EXCEPTION 'Production issue is disabled until certified onboarding';
  END IF;

  SELECT invoice_number INTO v_invoice_number
  FROM public.finance_invoices
  WHERE id = p_invoice_id AND tenant_id = v_tenant_id::text AND status IN ('مرسلة','مدفوعة','متأخرة');
  IF v_invoice_number IS NULL THEN
    RAISE EXCEPTION 'Issued source invoice not found in EGS tenant';
  END IF;
  IF p_document_uuid IS NULL THEN
    RAISE EXCEPTION 'Document UUID is required';
  END IF;

  -- Serializes concurrent requests for this EGS.
  SELECT last_icv, last_signed_invoice_hash, pending_document_id
    INTO v_counter, v_previous_hash, v_pending
  FROM public.zatca_egs_state
  WHERE egs_unit_id = p_egs_unit_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND OR v_previous_hash IS NULL THEN
    RAISE EXCEPTION 'EGS genesis hash not verified; onboarding required';
  END IF;
  IF v_pending IS NOT NULL THEN
    RAISE EXCEPTION 'The previous document must be signed and finalized first';
  END IF;
  IF (v_counter = 0 AND v_previous_hash <> 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==')
     OR (v_counter > 0 AND v_previous_hash = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==') THEN
    RAISE EXCEPTION 'Invalid previous invoice hash for current ICV';
  END IF;

  -- Unique source constraint rejects duplicate emission attempts.
  INSERT INTO public.zatca_documents (
    tenant_id, egs_unit_id, source_kind, source_id, document_type,
    invoice_number, document_uuid, icv, previous_invoice_hash, status
  ) VALUES (
    v_tenant_id, p_egs_unit_id, 'sales_invoice', p_invoice_id, 'standard_invoice',
    v_invoice_number, p_document_uuid, v_counter + 1, v_previous_hash, 'reserved'
  ) RETURNING id INTO v_doc_id;

  UPDATE public.zatca_egs_state
     SET last_icv = v_counter + 1, pending_document_id = v_doc_id, updated_at = now()
   WHERE egs_unit_id = p_egs_unit_id AND tenant_id = v_tenant_id;

  INSERT INTO public.zatca_document_events (
    tenant_id, document_id, event_type, result_code
  ) VALUES (v_tenant_id, v_doc_id, 'reserved', 'local_only');

  RETURN QUERY SELECT v_doc_id, v_counter + 1, v_previous_hash;
END;
$$;

-- No direct browser access, even for signed-in users from the same tenant.
ALTER TABLE public.zatca_egs_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zatca_egs_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zatca_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zatca_document_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  public.zatca_egs_units,
  public.zatca_egs_state,
  public.zatca_documents,
  public.zatca_document_events
FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE
  public.zatca_egs_units,
  public.zatca_egs_state,
  public.zatca_documents
TO service_role;
GRANT SELECT, INSERT ON TABLE public.zatca_document_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.zatca_document_events_id_seq TO service_role;

REVOKE ALL ON FUNCTION public.zatca_init_egs_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zatca_block_event_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zatca_protect_document_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zatca_protect_egs_counter() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zatca_reserve_sales_invoice(uuid, bigint, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zatca_reserve_sales_invoice(uuid, bigint, uuid)
  TO service_role;

-- WARNING: No production EGS is enabled and no genesis hash is initialized.
-- Stage 2 requires certified signing and atomic finalization before activation.
