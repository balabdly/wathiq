-- ══════════════════════════════════════════════════════
-- PMC Phase 2 — Variation Orders + Reconciliation + TRANSFER fix
-- ══════════════════════════════════════════════════════

-- ── 1. أوامر التغيير (Variation Orders) ──
create table if not exists boq_variation_orders (
  id                    bigint primary key generated always as identity,
  tenant_id             uuid references tenants(id) on delete cascade not null,
  project_id            bigint references projects(id) on delete cascade not null,
  variation_no          text not null,
  adjustment_request_id uuid references boq_adjustment_requests(id),
  parent_boq_version_id bigint references project_boq_versions(id),
  new_boq_version_id    bigint references project_boq_versions(id),
  status                text not null default 'DRAFT'
    check (status in ('DRAFT', 'APPROVED', 'APPLIED', 'REJECTED')),
  reason                text,
  sec_reference         text,
  approved_at           timestamptz,
  notes                 text,
  created_by            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (tenant_id, variation_no)
);

create index if not exists idx_bvo_project on boq_variation_orders(tenant_id, project_id);

-- ── 2. مطابقة نهائية وإغلاق الحجز ──
create table if not exists material_reconciliations (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  project_id      bigint references projects(id) on delete cascade not null,
  reservation_id  bigint references material_reservations(id) not null,
  boq_version_id  bigint references project_boq_versions(id),
  status          text not null default 'DRAFT'
    check (status in ('DRAFT', 'FINAL', 'CLOSED')),
  reconciled_at   timestamptz,
  reconciled_by   text,
  notes           text,
  created_at      timestamptz not null default now(),
  unique (reservation_id)
);

create table if not exists material_reconciliation_lines (
  id                  bigint primary key generated always as identity,
  tenant_id           uuid references tenants(id) on delete cascade not null,
  reconciliation_id   bigint references material_reconciliations(id) on delete cascade not null,
  material_id         bigint references materials(id),
  material_name       text not null,
  unit                text,
  qty_boq             numeric not null default 0,
  qty_received        numeric not null default 0,
  qty_issued          numeric not null default 0,
  qty_returned_client numeric not null default 0,
  qty_on_hand         numeric not null default 0,
  qty_surplus         numeric not null default 0,
  variance            numeric not null default 0
);

-- ── 3. تحديث RPC: دعم التحويل المخزني الكامل ──
create or replace function post_inventory_voucher(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tenant_id uuid; v_branch_id bigint; v_voucher_type text; v_ownership text;
  v_warehouse_id bigint; v_to_wh_id bigint; v_project_id bigint; v_reservation_id bigint;
  v_wh_name text; v_to_wh_name text; v_project_name text; v_voucher_no text; v_voucher_id bigint;
  v_ledger_type text; v_txn_prefix text; v_line jsonb; v_mat_id bigint; v_qty numeric;
  v_mat record; v_to_mat record; v_qty_before numeric; v_qty_after numeric;
  v_to_qty_before numeric; v_to_qty_after numeric; v_line_no int := 0; v_res record;
begin
  v_tenant_id := (p_payload ->> 'tenant_id')::uuid;
  v_branch_id := (p_payload ->> 'branch_id')::bigint;
  v_voucher_type := p_payload ->> 'voucher_type';
  v_ownership := coalesce(p_payload ->> 'ownership_type', 'CUSTODY');
  v_warehouse_id := nullif(p_payload ->> 'warehouse_id', '')::bigint;
  v_to_wh_id := nullif(p_payload ->> 'to_warehouse_id', '')::bigint;
  v_project_id := nullif(p_payload ->> 'project_id', '')::bigint;
  v_reservation_id := nullif(p_payload ->> 'reservation_id', '')::bigint;

  if v_tenant_id is null then raise exception 'tenant_id مطلوب'; end if;
  if v_voucher_type is null then raise exception 'voucher_type مطلوب'; end if;
  if jsonb_array_length(coalesce(p_payload -> 'lines', '[]'::jsonb)) = 0 then
    raise exception 'يجب إدخال سطر مادة واحد على الأقل';
  end if;
  if v_voucher_type = 'TRANSFER' and v_to_wh_id is null then
    raise exception 'مستودع الوجهة مطلوب للتحويل';
  end if;

  if v_ownership = 'CUSTODY' and v_voucher_type in ('RECEIVE','ISSUE','RETURN_WH','RETURN_CLIENT') then
    if v_project_id is null then raise exception 'المشروع إلزامي لمواد العهدة'; end if;
    if v_reservation_id is null then raise exception 'رقم الحجز إلزامي لمواد العهدة'; end if;
    select * into v_res from material_reservations where id = v_reservation_id and tenant_id = v_tenant_id;
    if not found then raise exception 'الحجز غير موجود'; end if;
    if v_res.project_id <> v_project_id then raise exception 'الحجز لا يتبع هذا المشروع'; end if;
    if v_res.status in ('CLOSED','RECONCILED') and v_voucher_type <> 'RETURN_CLIENT' then
      raise exception 'الحجز مغلق — لا حركات جديدة';
    end if;
  end if;

  if v_warehouse_id is not null then select name into v_wh_name from warehouses where id = v_warehouse_id; end if;
  if v_to_wh_id is not null then select name into v_to_wh_name from warehouses where id = v_to_wh_id; end if;
  if v_project_id is not null then select name into v_project_name from projects where id = v_project_id; end if;

  case v_voucher_type
    when 'RECEIVE' then v_ledger_type := 'استلام'; v_txn_prefix := 'استلام';
    when 'ISSUE' then v_ledger_type := 'صرف'; v_txn_prefix := 'صرف';
    when 'RETURN_WH' then v_ledger_type := 'إرجاع'; v_txn_prefix := 'استلام';
    when 'RETURN_CLIENT' then v_ledger_type := 'إرجاع للعميل'; v_txn_prefix := 'إرجاع للعميل';
    when 'TRANSFER' then v_ledger_type := 'تحويل'; v_txn_prefix := 'نقل مخزني';
    else raise exception 'نوع إذن غير معروف: %', v_voucher_type;
  end case;

  v_voucher_no := generate_txn_number(v_txn_prefix);

  insert into inventory_vouchers (
    tenant_id, branch_id, voucher_no, voucher_type, status,
    warehouse_id, to_warehouse_id, project_id, reservation_id, ownership_type,
    movement_category, booking_no, doc_code, client_name, exit_permit_no,
    vendor_name, return_type, project_name, wh_name, notes, attachment_url, posted_at
  ) values (
    v_tenant_id, v_branch_id, v_voucher_no, v_voucher_type, 'POSTED',
    v_warehouse_id, v_to_wh_id, v_project_id, v_reservation_id, v_ownership,
    p_payload ->> 'movement_category', p_payload ->> 'booking_no', p_payload ->> 'doc_code',
    p_payload ->> 'client_name', p_payload ->> 'exit_permit_no', p_payload ->> 'vendor_name',
    p_payload ->> 'return_type', coalesce(p_payload ->> 'project_name', v_project_name),
    coalesce(p_payload ->> 'wh_name', v_wh_name), p_payload ->> 'notes',
    p_payload ->> 'attachment_url', now()
  ) returning id into v_voucher_id;

  for v_line in select * from jsonb_array_elements(p_payload -> 'lines') loop
    v_line_no := v_line_no + 1;
    v_mat_id := (v_line ->> 'material_id')::bigint;
    v_qty := (v_line ->> 'qty')::numeric;
    if v_mat_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'سطر %: مادة أو كمية غير صالحة', v_line_no;
    end if;

    select * into v_mat from materials where id = v_mat_id and tenant_id = v_tenant_id for update;
    if not found then raise exception 'المادة % غير موجودة', v_mat_id; end if;
    v_qty_before := coalesce(v_mat.qty, 0);

    if v_voucher_type in ('ISSUE','RETURN_CLIENT','TRANSFER') then
      if v_qty_before < v_qty then raise exception 'رصيد "%" غير كافٍ', v_mat.name; end if;
      v_qty_after := v_qty_before - v_qty;
    else
      v_qty_after := v_qty_before + v_qty;
    end if;

    update materials set qty = v_qty_after, updated_at = now() where id = v_mat_id;

    insert into inventory_voucher_lines (tenant_id, voucher_id, line_no, material_id, mat_name, mat_code, unit, qty, qty_before, qty_after, note)
    values (v_tenant_id, v_voucher_id, v_line_no, v_mat_id, v_mat.name, v_mat.mat_code, v_mat.unit, v_qty, v_qty_before, v_qty_after, v_line ->> 'note');

    insert into stock_ledger (
      tenant_id, branch_id, doc_code, type, mat_name, mat_code, unit, qty,
      wh_name, project_name, project_id, booking_no, client_name, exit_permit_no,
      vendor_name, dispatch_note, qty_before, qty_after, txn_number,
      movement_category, return_type, attachment_url, voucher_id, reservation_id, ownership_type
    ) values (
      v_tenant_id, v_branch_id, p_payload ->> 'doc_code', v_ledger_type,
      v_mat.name, v_mat.mat_code, v_mat.unit, v_qty,
      coalesce(p_payload ->> 'wh_name', v_wh_name), coalesce(p_payload ->> 'project_name', v_project_name),
      v_project_id, p_payload ->> 'booking_no', p_payload ->> 'client_name',
      p_payload ->> 'exit_permit_no', p_payload ->> 'vendor_name', v_line ->> 'note',
      v_qty_before, v_qty_after, v_voucher_no, p_payload ->> 'movement_category',
      p_payload ->> 'return_type', p_payload ->> 'attachment_url',
      v_voucher_id, v_reservation_id, v_ownership
    );

    -- تحويل: إضافة للمستودع المستلم
    if v_voucher_type = 'TRANSFER' and v_to_wh_id is not null then
      select * into v_to_mat from materials
        where tenant_id = v_tenant_id and warehouse_id = v_to_wh_id
          and (mat_code = v_mat.mat_code or name = v_mat.name)
        limit 1 for update;
      if found then
        v_to_qty_before := coalesce(v_to_mat.qty, 0);
        v_to_qty_after := v_to_qty_before + v_qty;
        update materials set qty = v_to_qty_after, updated_at = now() where id = v_to_mat.id;
      else
        v_to_qty_before := 0;
        v_to_qty_after := v_qty;
        insert into materials (tenant_id, branch_id, warehouse_id, catalog_no, name, unit, qty, source, mat_code, sec_number)
        values (v_tenant_id, v_mat.branch_id, v_to_wh_id, v_mat.catalog_no, v_mat.name, v_mat.unit, v_qty,
          v_mat.source, v_mat.mat_code, v_mat.sec_number);
      end if;
      insert into stock_ledger (
        tenant_id, branch_id, type, mat_name, mat_code, unit, qty, wh_name,
        qty_before, qty_after, txn_number, movement_category, dispatch_note, voucher_id, ownership_type
      ) values (
        v_tenant_id, v_branch_id, 'استلام', v_mat.name, v_mat.mat_code, v_mat.unit, v_qty,
        v_to_wh_name, v_to_qty_before, v_to_qty_after, v_voucher_no, 'تحويل',
        'تحويل من ' || coalesce(v_wh_name, ''), v_voucher_id, v_ownership
      );
    end if;

    if v_project_id is not null and v_voucher_type <> 'TRANSFER' then
      insert into project_material_balances (
        tenant_id, project_id, reservation_id, material_id, ownership_type,
        qty_received, qty_issued, qty_returned_wh, qty_returned_client, qty_on_hand
      ) values (
        v_tenant_id, v_project_id, v_reservation_id, v_mat_id, v_ownership,
        case when v_voucher_type = 'RECEIVE' then v_qty else 0 end,
        case when v_voucher_type = 'ISSUE' then v_qty else 0 end,
        case when v_voucher_type = 'RETURN_WH' then v_qty else 0 end,
        case when v_voucher_type = 'RETURN_CLIENT' then v_qty else 0 end,
        case when v_voucher_type in ('RECEIVE','RETURN_WH') then v_qty
             when v_voucher_type in ('ISSUE','RETURN_CLIENT') then -v_qty else 0 end
      )
      on conflict (tenant_id, project_id, reservation_id, material_id) do update set
        qty_received = project_material_balances.qty_received + case when v_voucher_type = 'RECEIVE' then v_qty else 0 end,
        qty_issued = project_material_balances.qty_issued + case when v_voucher_type = 'ISSUE' then v_qty else 0 end,
        qty_returned_wh = project_material_balances.qty_returned_wh + case when v_voucher_type = 'RETURN_WH' then v_qty else 0 end,
        qty_returned_client = project_material_balances.qty_returned_client + case when v_voucher_type = 'RETURN_CLIENT' then v_qty else 0 end,
        qty_on_hand = project_material_balances.qty_on_hand + case
          when v_voucher_type in ('RECEIVE','RETURN_WH') then v_qty
          when v_voucher_type in ('ISSUE','RETURN_CLIENT') then -v_qty else 0 end,
        updated_at = now();

      insert into project_materials (tenant_id, project_id, material_id, warehouse_id,
        qty_received, qty_issued, qty_returned, last_recv_txn)
      values (v_tenant_id, v_project_id, v_mat_id, coalesce(v_warehouse_id, v_mat.warehouse_id),
        case when v_voucher_type = 'RECEIVE' then v_qty else 0 end,
        case when v_voucher_type = 'ISSUE' then v_qty else 0 end,
        case when v_voucher_type in ('RETURN_WH','RETURN_CLIENT') then v_qty else 0 end,
        case when v_voucher_type = 'RECEIVE' then v_voucher_no else null end)
      on conflict (tenant_id, project_id, material_id, warehouse_id) do update set
        qty_received = project_materials.qty_received + case when v_voucher_type = 'RECEIVE' then v_qty else 0 end,
        qty_issued = project_materials.qty_issued + case when v_voucher_type = 'ISSUE' then v_qty else 0 end,
        qty_returned = project_materials.qty_returned + case when v_voucher_type in ('RETURN_WH','RETURN_CLIENT') then v_qty else 0 end,
        last_recv_txn = case when v_voucher_type = 'RECEIVE' then v_voucher_no else project_materials.last_recv_txn end,
        updated_at = now();
    end if;
  end loop;

  if v_reservation_id is not null then
    update material_reservations set
      status = case when v_voucher_type = 'RETURN_CLIENT' then 'RECONCILED' else 'PARTIAL' end,
      updated_at = now()
    where id = v_reservation_id and status in ('OPEN','PARTIAL');
  end if;

  return jsonb_build_object('voucher_id', v_voucher_id, 'voucher_no', v_voucher_no, 'status', 'POSTED');
end;
$fn$;

-- ── 4. تطبيق أمر تغيير → إصدار BOQ جديد ──
create or replace function apply_boq_variation_order(p_variation_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_var boq_variation_orders%rowtype;
  v_parent project_boq_versions%rowtype;
  v_new_id bigint;
  v_new_no int;
begin
  select * into v_var from boq_variation_orders where id = p_variation_id;
  if not found then raise exception 'أمر التغيير غير موجود'; end if;
  if v_var.status not in ('DRAFT','APPROVED') then raise exception 'أمر التغيير مُطبَّق أو مرفوض'; end if;
  if v_var.parent_boq_version_id is null then raise exception 'إصدار BOQ الأب مطلوب'; end if;

  select * into v_parent from project_boq_versions where id = v_var.parent_boq_version_id;
  select coalesce(max(version_no),0)+1 into v_new_no from project_boq_versions
    where tenant_id = v_var.tenant_id and project_id = v_var.project_id;

  insert into project_boq_versions (tenant_id, project_id, version_type, version_no, parent_version_id,
    status, variation_ref, notes, created_by)
  values (v_var.tenant_id, v_var.project_id, 'VARIATION', v_new_no, v_var.parent_boq_version_id,
    'DRAFT', v_var.variation_no, v_var.reason, v_var.created_by)
  returning id into v_new_id;

  insert into project_boq_lines (tenant_id, boq_version_id, line_no, material_id, catalog_no, description, unit, qty_planned, notes)
  select v_var.tenant_id, v_new_id, line_no, material_id, catalog_no, description, unit, qty_planned, notes
  from project_boq_lines where boq_version_id = v_var.parent_boq_version_id;

  update boq_variation_orders set status = 'APPLIED', new_boq_version_id = v_new_id, updated_at = now()
    where id = p_variation_id;

  return jsonb_build_object('variation_id', p_variation_id, 'new_boq_version_id', v_new_id);
end;
$$;

-- ── 5. مطابقة نهائية وإغلاق الحجز ──
create or replace function finalize_reservation_reconciliation(
  p_tenant_id uuid, p_reservation_id bigint, p_boq_version_id bigint default null, p_notes text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_res material_reservations%rowtype;
  v_rec_id bigint;
  v_open numeric;
begin
  select * into v_res from material_reservations
    where id = p_reservation_id and tenant_id = p_tenant_id;
  if not found then raise exception 'الحجز غير موجود'; end if;

  select coalesce(sum(qty_on_hand),0) into v_open from project_material_balances
    where reservation_id = p_reservation_id and tenant_id = p_tenant_id;
  if v_open > 0 then
    raise exception 'لا يمكن الإغلاق — رصيد متبقٍ: % (أرجع الفائض للعميل أولاً)', v_open;
  end if;

  insert into material_reconciliations (tenant_id, project_id, reservation_id, boq_version_id, status, reconciled_at, notes)
  values (p_tenant_id, v_res.project_id, p_reservation_id, p_boq_version_id, 'FINAL', now(), p_notes)
  on conflict (reservation_id) do update set
    boq_version_id = coalesce(p_boq_version_id, material_reconciliations.boq_version_id),
    status = 'FINAL', reconciled_at = now(), notes = coalesce(p_notes, material_reconciliations.notes)
  returning id into v_rec_id;

  insert into material_reconciliation_lines (
    tenant_id, reconciliation_id, material_id, material_name, unit,
    qty_boq, qty_received, qty_issued, qty_returned_client, qty_on_hand, qty_surplus, variance
  )
  select p_tenant_id, v_rec_id, b.material_id, m.name, m.unit,
    coalesce(bl.qty_planned, 0), b.qty_received, b.qty_issued, b.qty_returned_client,
    b.qty_on_hand, greatest(b.qty_on_hand, 0),
    b.qty_received - b.qty_issued - b.qty_returned_client - coalesce(bl.qty_planned, 0)
  from project_material_balances b
  join materials m on m.id = b.material_id
  left join project_boq_lines bl on bl.boq_version_id = p_boq_version_id and bl.material_id = b.material_id
  where b.reservation_id = p_reservation_id and b.tenant_id = p_tenant_id;

  update material_reservations set status = 'CLOSED', closed_at = now(), updated_at = now()
    where id = p_reservation_id;

  return jsonb_build_object('reconciliation_id', v_rec_id, 'reservation_id', p_reservation_id, 'status', 'CLOSED');
end;
$$;

grant execute on function apply_boq_variation_order(bigint) to authenticated, service_role;
grant execute on function finalize_reservation_reconciliation(uuid, bigint, bigint, text) to authenticated, service_role;

-- ── 6. RLS ──
alter table boq_variation_orders enable row level security;
alter table material_reconciliations enable row level security;
alter table material_reconciliation_lines enable row level security;

do $$
declare t text;
begin
  foreach t in array array['boq_variation_orders','material_reconciliations','material_reconciliation_lines'] loop
    execute format('drop policy if exists pmc2_tenant_select on %I', t);
    execute format('drop policy if exists pmc2_tenant_insert on %I', t);
    execute format('drop policy if exists pmc2_tenant_update on %I', t);
    execute format('drop policy if exists pmc2_tenant_delete on %I', t);
    execute format('create policy pmc2_tenant_select on %I for select using (wathiq_tenant_match(tenant_id::text))', t);
    execute format('create policy pmc2_tenant_insert on %I for insert with check (wathiq_tenant_match(tenant_id::text))', t);
    execute format('create policy pmc2_tenant_update on %I for update using (wathiq_tenant_match(tenant_id::text))', t);
    execute format('create policy pmc2_tenant_delete on %I for delete using (wathiq_tenant_match(tenant_id::text))', t);
  end loop;
end;
$$;
