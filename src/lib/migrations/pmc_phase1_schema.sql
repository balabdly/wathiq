-- ══════════════════════════════════════════════════════
-- PMC Phase 1 — SEC Project Material Control
-- حجوزات + BOQ بإصدارات + أذون مخزنية ذرّية + أرصدة مشروع
-- ══════════════════════════════════════════════════════

-- ── 1. أعمدة إضافية على stock_ledger للربط ──
alter table stock_ledger add column if not exists voucher_id bigint;
alter table stock_ledger add column if not exists reservation_id bigint;
alter table stock_ledger add column if not exists ownership_type text
  check (ownership_type is null or ownership_type in ('CUSTODY', 'COMPANY'));

-- ── 2. حجوزات المواد (رقم الحجز + المشروع) ──
create table if not exists material_reservations (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  project_id      bigint references projects(id) on delete cascade not null,
  reservation_no  text not null,
  ownership_type  text not null default 'CUSTODY'
    check (ownership_type in ('CUSTODY', 'COMPANY')),
  boq_version_id  bigint,  -- FK يُضاف بعد إنشاء جدول الإصدارات
  client_name     text,
  status          text not null default 'OPEN'
    check (status in ('OPEN', 'PARTIAL', 'RECONCILED', 'CLOSED')),
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  notes           text,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, reservation_no)
);

create index if not exists idx_mat_reservations_project
  on material_reservations(tenant_id, project_id);
create index if not exists idx_mat_reservations_status
  on material_reservations(tenant_id, status);

-- ── 3. إصدارات BOQ ──
create table if not exists project_boq_versions (
  id                 bigint primary key generated always as identity,
  tenant_id          uuid references tenants(id) on delete cascade not null,
  project_id         bigint references projects(id) on delete cascade not null,
  version_type       text not null
    check (version_type in ('INITIAL', 'VARIATION', 'AS_BUILT')),
  version_no         int not null default 1,
  parent_version_id  bigint references project_boq_versions(id),
  status             text not null default 'DRAFT'
    check (status in ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'CLOSED')),
  variation_ref      text,
  effective_date     date,
  notes              text,
  created_by         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, project_id, version_no)
);

alter table material_reservations
  drop constraint if exists fk_mat_res_boq_version;
alter table material_reservations
  add constraint fk_mat_res_boq_version
  foreign key (boq_version_id) references project_boq_versions(id);

-- ── 4. بنود BOQ ──
create table if not exists project_boq_lines (
  id              bigint primary key generated always as identity,
  tenant_id       uuid references tenants(id) on delete cascade not null,
  boq_version_id  bigint references project_boq_versions(id) on delete cascade not null,
  line_no         int not null default 1,
  material_id     bigint references materials(id),
  catalog_no      text,
  description     text not null,
  unit            text not null default 'قطعة',
  qty_planned     numeric not null default 0 check (qty_planned >= 0),
  notes           text,
  created_at      timestamptz not null default now(),
  unique (boq_version_id, line_no)
);

create index if not exists idx_boq_lines_version on project_boq_lines(boq_version_id);

-- ── 5. أذون المخزون (رأس + سطور) ──
create table if not exists inventory_vouchers (
  id                 bigint primary key generated always as identity,
  tenant_id          uuid references tenants(id) on delete cascade not null,
  branch_id          bigint references branches(id),
  voucher_no         text not null,
  voucher_type       text not null
    check (voucher_type in ('RECEIVE', 'ISSUE', 'RETURN_WH', 'RETURN_CLIENT', 'TRANSFER')),
  status             text not null default 'DRAFT'
    check (status in ('DRAFT', 'POSTED', 'CANCELLED')),
  warehouse_id       bigint references warehouses(id),
  to_warehouse_id    bigint references warehouses(id),
  project_id         bigint references projects(id),
  reservation_id     bigint references material_reservations(id),
  ownership_type     text not null default 'CUSTODY'
    check (ownership_type in ('CUSTODY', 'COMPANY')),
  movement_category  text,
  booking_no         text,
  doc_code           text,
  client_name        text,
  exit_permit_no     text,
  vendor_name        text,
  return_type        text,
  project_name       text,
  wh_name            text,
  notes              text,
  attachment_url     text,
  posted_at          timestamptz,
  posted_by          text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_inv_vouchers_tenant on inventory_vouchers(tenant_id, status);
create index if not exists idx_inv_vouchers_project on inventory_vouchers(tenant_id, project_id);
create index if not exists idx_inv_vouchers_reservation on inventory_vouchers(reservation_id);

create table if not exists inventory_voucher_lines (
  id           bigint primary key generated always as identity,
  tenant_id    uuid references tenants(id) on delete cascade not null,
  voucher_id   bigint references inventory_vouchers(id) on delete cascade not null,
  line_no      int not null default 1,
  material_id  bigint references materials(id) not null,
  mat_name     text not null,
  mat_code     text,
  unit         text not null,
  qty          numeric not null check (qty > 0),
  qty_before   numeric,
  qty_after    numeric,
  note         text,
  created_at   timestamptz not null default now(),
  unique (voucher_id, line_no)
);

alter table stock_ledger
  drop constraint if exists fk_stock_ledger_voucher;
alter table stock_ledger
  add constraint fk_stock_ledger_voucher
  foreign key (voucher_id) references inventory_vouchers(id);

-- ── 6. أرصدة المواد لكل مشروع/حجز ──
create table if not exists project_material_balances (
  id                  bigint primary key generated always as identity,
  tenant_id           uuid references tenants(id) on delete cascade not null,
  project_id          bigint references projects(id) on delete cascade not null,
  reservation_id      bigint references material_reservations(id),
  material_id         bigint references materials(id) not null,
  ownership_type      text not null default 'CUSTODY'
    check (ownership_type in ('CUSTODY', 'COMPANY')),
  qty_received        numeric not null default 0,
  qty_issued          numeric not null default 0,
  qty_returned_wh     numeric not null default 0,
  qty_returned_client numeric not null default 0,
  qty_on_hand         numeric not null default 0,
  updated_at          timestamptz not null default now(),
  unique (tenant_id, project_id, reservation_id, material_id)
);

create index if not exists idx_pmb_project on project_material_balances(tenant_id, project_id);
create index if not exists idx_pmb_reservation on project_material_balances(reservation_id);

-- ── 7. محفّزات updated_at ──
create or replace function pmc_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_mat_reservations_updated on material_reservations;
create trigger trg_mat_reservations_updated
  before update on material_reservations
  for each row execute function pmc_set_updated_at();

drop trigger if exists trg_boq_versions_updated on project_boq_versions;
create trigger trg_boq_versions_updated
  before update on project_boq_versions
  for each row execute function pmc_set_updated_at();

drop trigger if exists trg_inv_vouchers_updated on inventory_vouchers;
create trigger trg_inv_vouchers_updated
  before update on inventory_vouchers
  for each row execute function pmc_set_updated_at();

-- ── 8. عرض المطابقة: مستلم − مصروف − مرتجع عميل ──
create or replace view v_pmc_reservation_reconciliation as
select
  b.tenant_id,
  b.project_id,
  b.reservation_id,
  r.reservation_no,
  r.status as reservation_status,
  b.material_id,
  m.name as material_name,
  m.unit,
  b.ownership_type,
  b.qty_received,
  b.qty_issued,
  b.qty_returned_wh,
  b.qty_returned_client,
  b.qty_on_hand,
  (b.qty_received - b.qty_issued - b.qty_returned_client) as qty_net_consumed,
  b.updated_at
from project_material_balances b
join material_reservations r on r.id = b.reservation_id
join materials m on m.id = b.material_id;

-- ── 9. RPC ذرّي: ترحيل إذن مخزني ──
create or replace function post_inventory_voucher(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id       uuid;
  v_branch_id       bigint;
  v_voucher_type    text;
  v_ownership       text;
  v_warehouse_id    bigint;
  v_to_wh_id        bigint;
  v_project_id      bigint;
  v_reservation_id  bigint;
  v_wh_name         text;
  v_project_name    text;
  v_voucher_no      text;
  v_voucher_id      bigint;
  v_ledger_type     text;
  v_txn_prefix      text;
  v_line            jsonb;
  v_mat_id          bigint;
  v_qty             numeric;
  v_mat             record;
  v_qty_before      numeric;
  v_qty_after       numeric;
  v_line_no         int := 0;
  v_res             record;
begin
  v_tenant_id    := (p_payload ->> 'tenant_id')::uuid;
  v_branch_id    := (p_payload ->> 'branch_id')::bigint;
  v_voucher_type := p_payload ->> 'voucher_type';
  v_ownership    := coalesce(p_payload ->> 'ownership_type', 'CUSTODY');
  v_warehouse_id := nullif(p_payload ->> 'warehouse_id', '')::bigint;
  v_to_wh_id     := nullif(p_payload ->> 'to_warehouse_id', '')::bigint;
  v_project_id   := nullif(p_payload ->> 'project_id', '')::bigint;
  v_reservation_id := nullif(p_payload ->> 'reservation_id', '')::bigint;

  if v_tenant_id is null then
    raise exception 'tenant_id مطلوب';
  end if;
  if v_voucher_type is null then
    raise exception 'voucher_type مطلوب';
  end if;
  if jsonb_array_length(coalesce(p_payload -> 'lines', '[]'::jsonb)) = 0 then
    raise exception 'يجب إدخال سطر مادة واحد على الأقل';
  end if;

  -- قيود الأمانة (عهدة SEC)
  if v_ownership = 'CUSTODY' and v_voucher_type in ('RECEIVE', 'ISSUE', 'RETURN_WH', 'RETURN_CLIENT') then
    if v_project_id is null then
      raise exception 'المشروع إلزامي لمواد العهدة';
    end if;
    if v_reservation_id is null then
      raise exception 'رقم الحجز إلزامي لمواد العهدة';
    end if;
    select * into v_res from material_reservations
      where id = v_reservation_id and tenant_id = v_tenant_id;
    if not found then
      raise exception 'الحجز غير موجود';
    end if;
    if v_res.project_id <> v_project_id then
      raise exception 'الحجز لا يتبع هذا المشروع';
    end if;
    if v_res.status in ('CLOSED', 'RECONCILED') and v_voucher_type <> 'RETURN_CLIENT' then
      raise exception 'الحجز مغلق — لا حركات جديدة';
    end if;
  end if;

  if v_warehouse_id is not null then
    select name into v_wh_name from warehouses where id = v_warehouse_id;
  end if;
  if v_project_id is not null then
    select name into v_project_name from projects where id = v_project_id;
  end if;

  case v_voucher_type
    when 'RECEIVE'        then v_ledger_type := 'استلام';       v_txn_prefix := 'استلام';
    when 'ISSUE'          then v_ledger_type := 'صرف';          v_txn_prefix := 'صرف';
    when 'RETURN_WH'      then v_ledger_type := 'إرجاع';        v_txn_prefix := 'استلام';
    when 'RETURN_CLIENT'  then v_ledger_type := 'إرجاع للعميل'; v_txn_prefix := 'إرجاع للعميل';
    when 'TRANSFER'       then v_ledger_type := 'تحويل';        v_txn_prefix := 'نقل مخزني';
    else raise exception 'نوع إذن غير معروف: %', v_voucher_type;
  end case;

  v_voucher_no := generate_txn_number(v_txn_prefix);

  insert into inventory_vouchers (
    tenant_id, branch_id, voucher_no, voucher_type, status,
    warehouse_id, to_warehouse_id, project_id, reservation_id,
    ownership_type, movement_category, booking_no, doc_code,
    client_name, exit_permit_no, vendor_name, return_type,
    project_name, wh_name, notes, attachment_url, posted_at
  ) values (
    v_tenant_id, v_branch_id, v_voucher_no, v_voucher_type, 'POSTED',
    v_warehouse_id, v_to_wh_id, v_project_id, v_reservation_id,
    v_ownership,
    p_payload ->> 'movement_category',
    p_payload ->> 'booking_no',
    p_payload ->> 'doc_code',
    p_payload ->> 'client_name',
    p_payload ->> 'exit_permit_no',
    p_payload ->> 'vendor_name',
    p_payload ->> 'return_type',
    coalesce(p_payload ->> 'project_name', v_project_name),
    coalesce(p_payload ->> 'wh_name', v_wh_name),
    p_payload ->> 'notes',
    p_payload ->> 'attachment_url',
    now()
  ) returning id into v_voucher_id;

  for v_line in select * from jsonb_array_elements(p_payload -> 'lines')
  loop
    v_line_no  := v_line_no + 1;
    v_mat_id   := (v_line ->> 'material_id')::bigint;
    v_qty      := (v_line ->> 'qty')::numeric;

    if v_mat_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'سطر %: مادة أو كمية غير صالحة', v_line_no;
    end if;

    select * into v_mat from materials
      where id = v_mat_id and tenant_id = v_tenant_id
      for update;
    if not found then
      raise exception 'المادة % غير موجودة', v_mat_id;
    end if;

    v_qty_before := coalesce(v_mat.qty, 0);

    if v_voucher_type in ('ISSUE', 'RETURN_CLIENT') then
      if v_qty_before < v_qty then
        raise exception 'رصيد "%" غير كافٍ: متاح %، مطلوب %', v_mat.name, v_qty_before, v_qty;
      end if;
      v_qty_after := v_qty_before - v_qty;
    elsif v_voucher_type = 'TRANSFER' then
      if v_qty_before < v_qty then
        raise exception 'رصيد "%" غير كافٍ للتحويل', v_mat.name;
      end if;
      v_qty_after := v_qty_before - v_qty;
    else
      v_qty_after := v_qty_before + v_qty;
    end if;

    update materials set qty = v_qty_after, updated_at = now()
      where id = v_mat_id;

    insert into inventory_voucher_lines (
      tenant_id, voucher_id, line_no, material_id,
      mat_name, mat_code, unit, qty, qty_before, qty_after, note
    ) values (
      v_tenant_id, v_voucher_id, v_line_no, v_mat_id,
      v_mat.name, v_mat.mat_code, v_mat.unit, v_qty, v_qty_before, v_qty_after,
      v_line ->> 'note'
    );

    insert into stock_ledger (
      tenant_id, branch_id, doc_code, type, mat_name, mat_code, unit, qty,
      wh_name, project_name, project_id, booking_no, client_name, exit_permit_no,
      vendor_name, dispatch_note, qty_before, qty_after, txn_number,
      movement_category, return_type, attachment_url,
      voucher_id, reservation_id, ownership_type
    ) values (
      v_tenant_id, v_branch_id,
      p_payload ->> 'doc_code',
      v_ledger_type,
      v_mat.name, v_mat.mat_code, v_mat.unit, v_qty,
      coalesce(p_payload ->> 'wh_name', v_wh_name),
      coalesce(p_payload ->> 'project_name', v_project_name),
      v_project_id,
      p_payload ->> 'booking_no',
      p_payload ->> 'client_name',
      p_payload ->> 'exit_permit_no',
      p_payload ->> 'vendor_name',
      v_line ->> 'note',
      v_qty_before, v_qty_after, v_voucher_no,
      p_payload ->> 'movement_category',
      p_payload ->> 'return_type',
      p_payload ->> 'attachment_url',
      v_voucher_id, v_reservation_id, v_ownership
    );

    -- أرصدة المشروع/الحجز
    if v_project_id is not null then
      insert into project_material_balances (
        tenant_id, project_id, reservation_id, material_id, ownership_type,
        qty_received, qty_issued, qty_returned_wh, qty_returned_client, qty_on_hand
      ) values (
        v_tenant_id, v_project_id, v_reservation_id, v_mat_id, v_ownership,
        case when v_voucher_type = 'RECEIVE' then v_qty else 0 end,
        case when v_voucher_type = 'ISSUE' then v_qty else 0 end,
        case when v_voucher_type = 'RETURN_WH' then v_qty else 0 end,
        case when v_voucher_type = 'RETURN_CLIENT' then v_qty else 0 end,
        case
          when v_voucher_type in ('RECEIVE', 'RETURN_WH') then v_qty
          when v_voucher_type in ('ISSUE', 'RETURN_CLIENT') then -v_qty
          else 0
        end
      )
      on conflict (tenant_id, project_id, reservation_id, material_id)
      do update set
        qty_received        = project_material_balances.qty_received
          + case when v_voucher_type = 'RECEIVE' then v_qty else 0 end,
        qty_issued          = project_material_balances.qty_issued
          + case when v_voucher_type = 'ISSUE' then v_qty else 0 end,
        qty_returned_wh     = project_material_balances.qty_returned_wh
          + case when v_voucher_type = 'RETURN_WH' then v_qty else 0 end,
        qty_returned_client = project_material_balances.qty_returned_client
          + case when v_voucher_type = 'RETURN_CLIENT' then v_qty else 0 end,
        qty_on_hand         = project_material_balances.qty_on_hand
          + case
              when v_voucher_type in ('RECEIVE', 'RETURN_WH') then v_qty
              when v_voucher_type in ('ISSUE', 'RETURN_CLIENT') then -v_qty
              else 0
            end,
        updated_at = now();

      insert into project_materials (
        tenant_id, project_id, material_id, warehouse_id,
        qty_received, qty_issued, qty_returned, last_recv_txn
      ) values (
        v_tenant_id, v_project_id, v_mat_id, coalesce(v_warehouse_id, v_mat.warehouse_id),
        case when v_voucher_type = 'RECEIVE' then v_qty else 0 end,
        case when v_voucher_type = 'ISSUE' then v_qty else 0 end,
        case when v_voucher_type in ('RETURN_WH', 'RETURN_CLIENT') then v_qty else 0 end,
        case when v_voucher_type = 'RECEIVE' then v_voucher_no else null end
      )
      on conflict (tenant_id, project_id, material_id, warehouse_id)
      do update set
        qty_received = project_materials.qty_received
          + case when v_voucher_type = 'RECEIVE' then v_qty else 0 end,
        qty_issued   = project_materials.qty_issued
          + case when v_voucher_type = 'ISSUE' then v_qty else 0 end,
        qty_returned = project_materials.qty_returned
          + case when v_voucher_type in ('RETURN_WH', 'RETURN_CLIENT') then v_qty else 0 end,
        last_recv_txn = case when v_voucher_type = 'RECEIVE' then v_voucher_no else project_materials.last_recv_txn end,
        updated_at = now();
    end if;
  end loop;

  -- تحديث حالة الحجز
  if v_reservation_id is not null then
    update material_reservations set
      status = case
        when v_voucher_type = 'RETURN_CLIENT' then 'RECONCILED'
        else 'PARTIAL'
      end,
      updated_at = now()
    where id = v_reservation_id and status in ('OPEN', 'PARTIAL');
  end if;

  return jsonb_build_object(
    'voucher_id', v_voucher_id,
    'voucher_no', v_voucher_no,
    'status', 'POSTED'
  );
end;
$$;

grant execute on function post_inventory_voucher(jsonb) to authenticated, service_role;

-- ── 10. RLS ──
alter table material_reservations enable row level security;
alter table project_boq_versions enable row level security;
alter table project_boq_lines enable row level security;
alter table inventory_vouchers enable row level security;
alter table inventory_voucher_lines enable row level security;
alter table project_material_balances enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'material_reservations','project_boq_versions','project_boq_lines',
    'inventory_vouchers','inventory_voucher_lines','project_material_balances'
  ] loop
    execute format('drop policy if exists pmc_tenant_select on %I', t);
    execute format('drop policy if exists pmc_tenant_insert on %I', t);
    execute format('drop policy if exists pmc_tenant_update on %I', t);
    execute format('drop policy if exists pmc_tenant_delete on %I', t);

    execute format(
      'create policy pmc_tenant_select on %I for select using (wathiq_tenant_match(tenant_id::text))', t);
    execute format(
      'create policy pmc_tenant_insert on %I for insert with check (wathiq_tenant_match(tenant_id::text))', t);
    execute format(
      'create policy pmc_tenant_update on %I for update using (wathiq_tenant_match(tenant_id::text))', t);
    execute format(
      'create policy pmc_tenant_delete on %I for delete using (wathiq_tenant_match(tenant_id::text))', t);
  end loop;
end;
$$;
