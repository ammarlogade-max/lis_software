-- Production controls: immutable audit trail, payment ledger, inventory movement
-- accounting, QC targets, and microbiology organism lookup.

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  branch_id uuid references branches(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_events_entity on audit_events(entity_type, entity_id, created_at desc);
create index if not exists idx_audit_events_created on audit_events(created_at desc);

create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  amount numeric(10,2) not null check (amount > 0),
  payment_type text not null check (payment_type in ('collection', 'refund', 'adjustment')),
  payment_mode text not null,
  reference_no text,
  remarks text not null default '',
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_payment_transactions_order on payment_transactions(order_id, created_at desc);

alter table inventory_items add column if not exists sku text;
alter table inventory_items add column if not exists supplier_name text not null default '';
alter table inventory_items add column if not exists lot_number text not null default '';
alter table inventory_items add column if not exists expiry_date date;

create table if not exists qc_targets (
  id uuid primary key default gen_random_uuid(),
  analyzer_id uuid references analyzers(id) on delete set null,
  analyte text not null,
  level text not null,
  lot_number text not null default '',
  target_mean numeric(10,3) not null,
  target_sd numeric(10,3) not null check (target_sd > 0),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_qc_targets_lookup on qc_targets(analyzer_id, analyte, level, is_active);

create table if not exists microbiology_organisms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  gram_type text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table audit_events enable row level security;
alter table payment_transactions enable row level security;
alter table qc_targets enable row level security;
alter table microbiology_organisms enable row level security;

create policy audit_events_read on audit_events for select
  using (auth_role() in ('admin', 'pathologist', 'accountant'));
create policy audit_events_insert on audit_events for insert
  with check (auth.uid() = actor_id);
create policy payment_transactions_read on payment_transactions for select
  using (auth_role() in ('admin', 'front_desk', 'accountant'));
create policy payment_transactions_insert on payment_transactions for insert
  with check (auth_role() in ('admin', 'front_desk', 'accountant') and auth.uid() = created_by);
create policy qc_targets_read on qc_targets for select using (auth.uid() is not null);
create policy qc_targets_manage on qc_targets for all
  using (auth_role() in ('admin', 'lab_technician', 'pathologist'))
  with check (auth_role() in ('admin', 'lab_technician', 'pathologist'));
create policy microbiology_organisms_read on microbiology_organisms for select using (auth.uid() is not null);
create policy microbiology_organisms_manage on microbiology_organisms for all
  using (auth_role() in ('admin', 'lab_technician', 'pathologist'))
  with check (auth_role() in ('admin', 'lab_technician', 'pathologist'));

-- Prevent deletion or modification of financial and audit history from the
-- client. Corrections are represented by a refund or adjustment row.
revoke update, delete on audit_events from authenticated;
revoke update, delete on payment_transactions from authenticated;

create or replace function collect_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_mode text,
  p_reference_no text default null,
  p_remarks text default ''
) returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order orders;
  updated_order orders;
begin
  if auth_role() not in ('admin', 'front_desk', 'accountant') then
    raise exception 'Not authorized to collect payment';
  end if;
  if p_amount <= 0 then
    raise exception 'Payment amount must be positive';
  end if;

  select * into current_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if p_amount > current_order.due then
    raise exception 'Payment exceeds outstanding due';
  end if;

  update orders
    set paid = paid + p_amount,
        due = due - p_amount,
        payment_mode = p_payment_mode
    where id = p_order_id
    returning * into updated_order;

  insert into payment_transactions(order_id, amount, payment_type, payment_mode, reference_no, remarks, created_by)
  values (p_order_id, p_amount, 'collection', p_payment_mode, p_reference_no, p_remarks, auth.uid());
  insert into audit_events(actor_id, action, entity_type, entity_id, branch_id, metadata)
  values (auth.uid(), 'payment_collected', 'order', p_order_id, updated_order.branch_id,
          jsonb_build_object('amount', p_amount, 'payment_mode', p_payment_mode));
  return updated_order;
end;
$$;

revoke all on function collect_order_payment(uuid, numeric, text, text, text) from public;
grant execute on function collect_order_payment(uuid, numeric, text, text, text) to authenticated;

create or replace function adjust_inventory(
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_reason text default ''
) returns inventory_items
language plpgsql
security definer
set search_path = public
as $$
declare
  current_item inventory_items;
  updated_item inventory_items;
  delta numeric;
begin
  if auth_role() not in ('admin', 'lab_technician') then
    raise exception 'Not authorized to adjust inventory';
  end if;
  if p_quantity <= 0 or p_movement_type not in ('stock_in', 'stock_out', 'adjustment') then
    raise exception 'Invalid inventory movement';
  end if;
  select * into current_item from inventory_items where id = p_item_id for update;
  if not found then raise exception 'Inventory item not found'; end if;
  delta := case when p_movement_type = 'stock_out' then -p_quantity else p_quantity end;
  if current_item.current_quantity + delta < 0 then raise exception 'Insufficient stock'; end if;
  update inventory_items set current_quantity = current_quantity + delta where id = p_item_id returning * into updated_item;
  insert into inventory_movements(item_id, movement_type, quantity, reason, created_by)
  values (p_item_id, p_movement_type, p_quantity, p_reason, auth.uid());
  insert into audit_events(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'inventory_adjusted', 'inventory_item', p_item_id, jsonb_build_object('type', p_movement_type, 'quantity', p_quantity));
  return updated_item;
end;
$$;

revoke all on function adjust_inventory(uuid, text, numeric, text) from public;
grant execute on function adjust_inventory(uuid, text, numeric, text) to authenticated;

create or replace function refund_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_mode text,
  p_reference_no text default null,
  p_remarks text default ''
) returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order orders;
  updated_order orders;
begin
  if auth_role() not in ('admin', 'accountant') then raise exception 'Not authorized to refund payment'; end if;
  if p_amount <= 0 then raise exception 'Refund amount must be positive'; end if;
  select * into current_order from orders where id = p_order_id for update;
  if not found or current_order.paid < p_amount then raise exception 'Refund exceeds collected amount'; end if;
  update orders set paid = paid - p_amount, due = due + p_amount where id = p_order_id returning * into updated_order;
  insert into payment_transactions(order_id, amount, payment_type, payment_mode, reference_no, remarks, created_by)
  values (p_order_id, p_amount, 'refund', p_payment_mode, p_reference_no, p_remarks, auth.uid());
  insert into audit_events(actor_id, action, entity_type, entity_id, branch_id, metadata)
  values (auth.uid(), 'payment_refunded', 'order', p_order_id, updated_order.branch_id, jsonb_build_object('amount', p_amount));
  return updated_order;
end;
$$;

revoke all on function refund_order_payment(uuid, numeric, text, text, text) from public;
grant execute on function refund_order_payment(uuid, numeric, text, text, text) to authenticated;

insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do update set public = false;

create policy reports_private_insert on storage.objects for insert
  with check (bucket_id = 'reports' and auth.uid() is not null);
create policy reports_private_select on storage.objects for select
  using (bucket_id = 'reports' and auth.uid() is not null);
