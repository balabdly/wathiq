-- إصلاح post_inventory_voucher: qty_balance عمود محسوب (GENERATED ALWAYS)
-- لا يُسمح بإدخاله أو تحديثه يدوياً

create or replace function post_inventory_voucher(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
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
  if jsonb_array_length(coalesce(p_payload -> 'lines', '[]'::jsonb)) = 0 then raise exception 'يجب إدخال سطر مادة واحد على الأقل'; end if;
  if v_voucher_type = 'TRANSFER' and v_to_wh_id is null then raise exception 'مستودع الوجهة مطلوب للتحويل'; end if;
  if v_ownership = 'CUSTODY' and v_voucher_type in ('RECEIVE','ISSUE','RETURN_WH','RETURN_CLIENT') then
    if v_project_id is null then raise exception 'المشروع إلزامي لمواد العهدة'; end if;
    if v_reservation_id is null then raise exception 'رقم الحجز إلزامي لمواد العهدة'; end if;
    select * into v_res from material_reservations where id = v_reservation_id and tenant_id = v_tenant_id;
    if not found then raise exception 'الحجز غير موجود'; end if;
    if v_res.project_id <> v_project_id then raise exception 'الحجز لا يتبع هذا المشروع'; end if;
    if v_res.status in ('CLOSED','RECONCILED') and v_voucher_type <> 'RETURN_CLIENT' then raise exception 'الحجز مغلق'; end if;
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
    else raise exception 'نوع إذن غير معروف'; end case;
  v_voucher_no := generate_txn_number(v_txn_prefix);
  insert into inventory_vouchers (tenant_id, branch_id, voucher_no, voucher_type, status, warehouse_id, to_warehouse_id, project_id, reservation_id, ownership_type, movement_category, booking_no, doc_code, client_name, exit_permit_no, vendor_name, return_type, project_name, wh_name, notes, attachment_url, posted_at)
  values (v_tenant_id, v_branch_id, v_voucher_no, v_voucher_type, 'POSTED', v_warehouse_id, v_to_wh_id, v_project_id, v_reservation_id, v_ownership, p_payload ->> 'movement_category', p_payload ->> 'booking_no', p_payload ->> 'doc_code', p_payload ->> 'client_name', p_payload ->> 'exit_permit_no', p_payload ->> 'vendor_name', p_payload ->> 'return_type', coalesce(p_payload ->> 'project_name', v_project_name), coalesce(p_payload ->> 'wh_name', v_wh_name), p_payload ->> 'notes', p_payload ->> 'attachment_url', now())
  returning id into v_voucher_id;
  for v_line in select * from jsonb_array_elements(p_payload -> 'lines') loop
    v_line_no := v_line_no + 1; v_mat_id := (v_line ->> 'material_id')::bigint; v_qty := (v_line ->> 'qty')::numeric;
    if v_mat_id is null or v_qty is null or v_qty <= 0 then raise exception 'سطر غير صالح'; end if;
    select * into v_mat from materials where id = v_mat_id and tenant_id = v_tenant_id for update;
    if not found then raise exception 'المادة غير موجودة'; end if;
    v_qty_before := coalesce(v_mat.qty, 0);
    if v_voucher_type in ('ISSUE','RETURN_CLIENT','TRANSFER') then
      if v_qty_before < v_qty then raise exception 'رصيد غير كافٍ'; end if; v_qty_after := v_qty_before - v_qty;
    else v_qty_after := v_qty_before + v_qty; end if;
    update materials set qty = v_qty_after, updated_at = now() where id = v_mat_id;
    insert into inventory_voucher_lines (tenant_id, voucher_id, line_no, material_id, mat_name, mat_code, unit, qty, qty_before, qty_after, note)
    values (v_tenant_id, v_voucher_id, v_line_no, v_mat_id, v_mat.name, v_mat.mat_code, v_mat.unit, v_qty, v_qty_before, v_qty_after, v_line ->> 'note');
    insert into stock_ledger (tenant_id, branch_id, doc_code, type, mat_name, mat_code, unit, qty, wh_name, project_name, project_id, booking_no, client_name, exit_permit_no, vendor_name, dispatch_note, qty_before, qty_after, txn_number, movement_category, return_type, attachment_url, voucher_id, reservation_id, ownership_type)
    values (v_tenant_id, v_branch_id, p_payload ->> 'doc_code', v_ledger_type, v_mat.name, v_mat.mat_code, v_mat.unit, v_qty, coalesce(p_payload ->> 'wh_name', v_wh_name), coalesce(p_payload ->> 'project_name', v_project_name), v_project_id, p_payload ->> 'booking_no', p_payload ->> 'client_name', p_payload ->> 'exit_permit_no', p_payload ->> 'vendor_name', v_line ->> 'note', v_qty_before, v_qty_after, v_voucher_no, p_payload ->> 'movement_category', p_payload ->> 'return_type', p_payload ->> 'attachment_url', v_voucher_id, v_reservation_id, v_ownership);
    if v_voucher_type = 'TRANSFER' and v_to_wh_id is not null then
      select * into v_to_mat from materials where tenant_id = v_tenant_id and warehouse_id = v_to_wh_id and (mat_code = v_mat.mat_code or name = v_mat.name) limit 1 for update;
      if found then v_to_qty_before := coalesce(v_to_mat.qty,0); v_to_qty_after := v_to_qty_before + v_qty; update materials set qty = v_to_qty_after, updated_at = now() where id = v_to_mat.id;
      else v_to_qty_before := 0; v_to_qty_after := v_qty; insert into materials (tenant_id, branch_id, warehouse_id, catalog_no, name, unit, qty, source, mat_code, sec_number) values (v_tenant_id, v_mat.branch_id, v_to_wh_id, v_mat.catalog_no, v_mat.name, v_mat.unit, v_qty, v_mat.source, v_mat.mat_code, v_mat.sec_number); end if;
      insert into stock_ledger (tenant_id, branch_id, type, mat_name, mat_code, unit, qty, wh_name, qty_before, qty_after, txn_number, movement_category, dispatch_note, voucher_id, ownership_type) values (v_tenant_id, v_branch_id, 'استلام', v_mat.name, v_mat.mat_code, v_mat.unit, v_qty, v_to_wh_name, v_to_qty_before, v_to_qty_after, v_voucher_no, 'تحويل', 'تحويل من ' || coalesce(v_wh_name,''), v_voucher_id, v_ownership);
    end if;
    if v_project_id is not null and v_voucher_type <> 'TRANSFER' then
      insert into project_material_balances (tenant_id, project_id, reservation_id, material_id, ownership_type, qty_received, qty_issued, qty_returned_wh, qty_returned_client, qty_on_hand)
      values (v_tenant_id, v_project_id, v_reservation_id, v_mat_id, v_ownership, case when v_voucher_type='RECEIVE' then v_qty else 0 end, case when v_voucher_type='ISSUE' then v_qty else 0 end, case when v_voucher_type='RETURN_WH' then v_qty else 0 end, case when v_voucher_type='RETURN_CLIENT' then v_qty else 0 end, case when v_voucher_type in ('RECEIVE','RETURN_WH') then v_qty when v_voucher_type in ('ISSUE','RETURN_CLIENT') then -v_qty else 0 end)
      on conflict (tenant_id, project_id, reservation_id, material_id) do update set qty_received=project_material_balances.qty_received+case when v_voucher_type='RECEIVE' then v_qty else 0 end, qty_issued=project_material_balances.qty_issued+case when v_voucher_type='ISSUE' then v_qty else 0 end, qty_returned_wh=project_material_balances.qty_returned_wh+case when v_voucher_type='RETURN_WH' then v_qty else 0 end, qty_returned_client=project_material_balances.qty_returned_client+case when v_voucher_type='RETURN_CLIENT' then v_qty else 0 end, qty_on_hand=project_material_balances.qty_on_hand+case when v_voucher_type in ('RECEIVE','RETURN_WH') then v_qty when v_voucher_type in ('ISSUE','RETURN_CLIENT') then -v_qty else 0 end, updated_at=now();
      -- qty_balance محسوب تلقائياً: (qty_received - qty_issued) - qty_returned
      insert into project_materials (tenant_id, project_id, material_id, warehouse_id, qty_received, qty_issued, qty_returned, last_recv_txn)
      values (v_tenant_id, v_project_id, v_mat_id, coalesce(v_warehouse_id, v_mat.warehouse_id), case when v_voucher_type='RECEIVE' then v_qty else 0 end, case when v_voucher_type='ISSUE' then v_qty else 0 end, case when v_voucher_type in ('RETURN_WH','RETURN_CLIENT') then v_qty else 0 end, case when v_voucher_type='RECEIVE' then v_voucher_no else null end)
      on conflict (tenant_id, project_id, material_id, warehouse_id) do update set qty_received=project_materials.qty_received+case when v_voucher_type='RECEIVE' then v_qty else 0 end, qty_issued=project_materials.qty_issued+case when v_voucher_type='ISSUE' then v_qty else 0 end, qty_returned=project_materials.qty_returned+case when v_voucher_type in ('RETURN_WH','RETURN_CLIENT') then v_qty else 0 end, last_recv_txn=case when v_voucher_type='RECEIVE' then v_voucher_no else project_materials.last_recv_txn end, updated_at=now();
    end if;
  end loop;
  if v_reservation_id is not null then update material_reservations set status=case when v_voucher_type='RETURN_CLIENT' then 'RECONCILED' else 'PARTIAL' end, updated_at=now() where id=v_reservation_id and status in ('OPEN','PARTIAL'); end if;
  return jsonb_build_object('voucher_id', v_voucher_id, 'voucher_no', v_voucher_no, 'status', 'POSTED');
end;
$function$;
