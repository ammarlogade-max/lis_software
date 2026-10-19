-- Durable records for the production workflows migrated from the former local API.
create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('stock_in', 'stock_out', 'adjustment')),
  quantity numeric(10,2) not null,
  reason text not null default '',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table microbiology_cases add column if not exists sample_type text;
alter table microbiology_cases add column if not exists collection_date timestamptz;
alter table microbiology_cases add column if not exists gram_stain text not null default '';
alter table microbiology_cases add column if not exists culture_observation text not null default '';
alter table microbiology_cases add column if not exists colony_count text not null default '';

create table if not exists phlebotomy_rejections (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  reason text not null,
  action_required text not null default '',
  phlebotomist text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists lab_tools_settings (
  id int primary key default 1 check (id = 1),
  email_address text not null default '',
  email_domain text not null default 'gmail.com',
  pdf_export_path text not null default ''
);
insert into lab_tools_settings (id) values (1) on conflict (id) do nothing;

alter table inventory_movements enable row level security;
alter table phlebotomy_rejections enable row level security;
alter table lab_tools_settings enable row level security;

create policy inventory_movements_read on inventory_movements for select using (auth.uid() is not null);
create policy inventory_movements_write on inventory_movements for insert
  with check (auth_role() in ('admin', 'lab_technician'));
create policy phlebotomy_rejections_read on phlebotomy_rejections for select using (auth.uid() is not null);
create policy phlebotomy_rejections_write on phlebotomy_rejections for insert
  with check (auth_role() in ('admin', 'front_desk', 'lab_technician'));
create policy lab_tools_settings_read on lab_tools_settings for select using (auth.uid() is not null);
create policy lab_tools_settings_write on lab_tools_settings for update using (auth_role() = 'admin');

-- Additional write policies used by the Supabase repositories in the desktop app.
create policy package_test_groups_manage on package_test_groups for all
  using (auth_role() in ('admin', 'front_desk'))
  with check (auth_role() in ('admin', 'front_desk'));
create policy packages_update on packages for update using (auth_role() in ('admin', 'front_desk'));
create policy packages_delete on packages for delete using (auth_role() in ('admin', 'front_desk'));
create policy methods_manage on methods for all
  using (auth_role() in ('admin', 'lab_technician'))
  with check (auth_role() in ('admin', 'lab_technician'));
create policy analyzer_update on analyzers for update using (auth_role() in ('admin', 'lab_technician'));
create policy analyzer_delete on analyzers for delete using (auth_role() in ('admin', 'lab_technician'));
create policy analyzer_mapping_write on analyzer_mappings for insert
  with check (auth_role() in ('admin', 'lab_technician'));
create policy analyzer_log_write on analyzer_logs for insert
  with check (auth_role() in ('admin', 'lab_technician'));
create policy inventory_update on inventory_items for update using (auth_role() in ('admin', 'lab_technician'));
create policy inventory_delete on inventory_items for delete using (auth_role() in ('admin', 'lab_technician'));
create policy test_parameters_delete on test_parameters for delete using (auth_role() in ('admin', 'lab_technician'));
create policy operational_order_update on orders for update using (auth_role() in ('admin', 'front_desk', 'lab_technician', 'pathologist', 'accountant'));
create policy order_test_groups_insert on order_test_groups for insert
  with check (auth_role() in ('admin', 'front_desk'));
create policy order_results_select on order_results for select using (auth.uid() is not null);
create policy doctor_voucher_update on doctor_vouchers for update using (auth_role() in ('admin', 'accountant'));

-- The uploads bucket is public for report previews, while writes remain authenticated.
create policy uploads_public_read on storage.objects for select
  using (bucket_id = 'uploads');
create policy uploads_authenticated_write on storage.objects for insert
  with check (bucket_id = 'uploads' and auth.uid() is not null);
create policy uploads_authenticated_update on storage.objects for update
  using (bucket_id = 'uploads' and auth.uid() is not null);
create policy uploads_authenticated_delete on storage.objects for delete
  using (bucket_id = 'uploads' and auth.uid() is not null);