-- ============================================================================
-- Patho One LIS — Supabase (Postgres) schema, v1
-- ============================================================================
-- Run this in the Supabase SQL Editor on a brand-new project, or via
-- `supabase db push` if you're using the Supabase CLI locally.
--
-- This mirrors the data model already used by the app (patients, doctors,
-- test groups/parameters, packages, branches, orders, QC runs, etc.) — it is
-- not a generic guess, it's built from the actual TypeScript types in the
-- codebase so the frontend rewrite in phase 2 has a 1:1 target to map to.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. Roles & user profiles
-- ----------------------------------------------------------------------------
-- Supabase Auth owns auth.users (email/password, magic link, etc). We keep a
-- profiles table 1:1 with auth.users for app-specific fields (role, branch).
create type app_role as enum ('admin', 'front_desk', 'lab_technician', 'pathologist', 'accountant');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role app_role not null default 'front_desk',
  branch_id uuid,  -- fk added after branches table exists
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Helper used in RLS policies below: current user's role, without recursive
-- RLS lookups (security definer bypasses RLS on profiles itself).
create or replace function auth_role() returns app_role
language sql security definer stable as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function auth_branch_id() returns uuid
language sql security definer stable as $$
  select branch_id from profiles where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 2. Branches
-- ----------------------------------------------------------------------------
create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  phone text not null default '',
  is_main boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles add constraint profiles_branch_fk
  foreign key (branch_id) references branches(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 3. Collection centres, doctors
-- ----------------------------------------------------------------------------
create table collection_centres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  commission_percent numeric(6,2) not null default 0,
  contact_no text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table doctors (
  id uuid primary key default gen_random_uuid(),
  salutation text not null default 'Dr.',
  name text not null,
  degree text not null default '',
  commission_basis text not null default 'percent',   -- 'percent' | 'flat'
  commission_percent numeric(6,2) not null default 0,
  contact_no text,
  email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. Patients (soft-delete, not hard-delete, matching current app behaviour)
-- ----------------------------------------------------------------------------
create table patients (
  id uuid primary key default gen_random_uuid(),
  mrn text not null unique,
  title text not null default 'Mr.',
  full_name text not null,
  gender text not null,                 -- 'Male' | 'Female' | 'Other'
  age_years int,
  age_months int not null default 0,
  age_days int not null default 0,
  phone text,
  email text,
  address text,
  city text,
  history text,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_patients_name on patients using gin (to_tsvector('simple', full_name));
create index idx_patients_phone on patients (phone);

-- ----------------------------------------------------------------------------
-- 5. Test Master: groups + parameters (mirrors Patho One's "Test Modification")
-- ----------------------------------------------------------------------------
create table test_groups (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  report_title text not null default '',
  short_name text not null default '',
  rate numeric(10,2) not null default 0,
  method_interpretation text not null default '',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table test_parameters (
  id uuid primary key default gen_random_uuid(),
  test_group_id uuid not null references test_groups(id) on delete cascade,
  name text not null,
  unit text,
  default_value text,
  formula text,                          -- e.g. "(ID1/ID2)*10", position-based like Patho One
  decimal_format text,
  is_bold boolean not null default false,
  normal_range_male text,
  normal_range_female text,
  normal_range_child_male text,
  normal_range_child_female text,
  sort_order int not null default 0
);
create index idx_test_parameters_group on test_parameters (test_group_id);

-- ----------------------------------------------------------------------------
-- 6. Packages (dual-list picker over test_groups)
-- ----------------------------------------------------------------------------
create table packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fee numeric(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table package_test_groups (
  package_id uuid not null references packages(id) on delete cascade,
  test_group_id uuid not null references test_groups(id) on delete cascade,
  primary key (package_id, test_group_id)
);

-- ----------------------------------------------------------------------------
-- 7. Analyzers, methods, ASTM/HL7 mappings
-- ----------------------------------------------------------------------------
create table analyzers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  serial_port text,
  baud_rate int not null default 9600,
  connection_type text not null default 'serial',  -- 'serial' | 'tcp'
  tcp_host text,
  tcp_port int,
  protocol text not null default 'ASTM',
  is_active boolean not null default true
);

create table methods (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table analyzer_mappings (
  id uuid primary key default gen_random_uuid(),
  analyzer_id uuid not null references analyzers(id) on delete cascade,
  external_test_code text not null,
  parameter_id uuid not null references test_parameters(id) on delete cascade
);

create table analyzer_logs (
  id uuid primary key default gen_random_uuid(),
  analyzer_id uuid references analyzers(id) on delete set null,
  direction text not null,               -- 'RX' | 'TX'
  raw_packet text not null,
  parsed_specimen text,
  tests_found text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. Inventory
-- ----------------------------------------------------------------------------
create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default '',
  reorder_level numeric(10,2) not null default 0,
  current_quantity numeric(10,2) not null default 0,
  unit_cost numeric(10,2) not null default 0
);


-- ----------------------------------------------------------------------------
-- 9. Orders (visit/billing) + line items + results
-- ----------------------------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  lab_id text not null unique,             -- human-facing "LAB-2026-0001" style code
  specimen_id text,
  patient_id uuid not null references patients(id),
  doctor_id uuid references doctors(id),
  centre_id uuid references collection_centres(id),
  branch_id uuid references branches(id),
  fasting_status text not null default 'Unspecified',
  status text not null default 'created',  -- created | sample_collected | completed | cancelled
  priority text not null default 'routine',-- routine | stat
  discount_percent numeric(6,2) not null default 0,
  payable numeric(10,2) not null default 0,
  paid numeric(10,2) not null default 0,
  due numeric(10,2) not null default 0,
  payment_mode text not null default 'cash',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_orders_patient on orders (patient_id);
create index idx_orders_status on orders (status);
create index idx_orders_created on orders (created_at);

create table order_test_groups (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  test_group_id uuid not null references test_groups(id),
  status text not null default 'pending'   -- pending | in_progress | completed
);

create table order_results (
  id uuid primary key default gen_random_uuid(),
  order_test_group_id uuid not null references order_test_groups(id) on delete cascade,
  parameter_id uuid not null references test_parameters(id),
  value text,
  entered_by uuid references profiles(id),
  entered_at timestamptz
);
create unique index idx_order_results_unique on order_results (order_test_group_id, parameter_id);

-- ----------------------------------------------------------------------------
-- 10. Quality Control
-- ----------------------------------------------------------------------------
create table qc_runs (
  id uuid primary key default gen_random_uuid(),
  analyzer_id uuid references analyzers(id),
  analyte text not null,
  level text not null,
  target_mean numeric(10,3) not null,
  target_sd numeric(10,3) not null,
  measured_value numeric(10,3) not null,
  z_score numeric(6,2),
  westgard_rule text,
  status text not null,                    -- In Control | Warning (1-2s) | Violation (1-3s) | Violation (2-2s)
  technician text not null,
  created_at timestamptz not null default now()
);
create index idx_qc_runs_analyte on qc_runs (analyte, created_at desc);

-- ----------------------------------------------------------------------------
-- 11. Microbiology
-- ----------------------------------------------------------------------------
create table microbiology_cases (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  patient_id uuid references patients(id),
  specimen_type text,
  organism_isolated text,
  status text not null default 'pending',
  reported_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table antibiotic_sensitivities (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references microbiology_cases(id) on delete cascade,
  antibiotic_name text not null,
  result text not null   -- 'S' | 'I' | 'R'
);


-- ----------------------------------------------------------------------------
-- 12. Finance: doctor incentive vouchers
-- ----------------------------------------------------------------------------
create table doctor_vouchers (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(id),
  amount numeric(10,2) not null,
  mode text not null,
  reference_no text,
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 13. Report settings / page setup (singleton rows — one per lab/branch)
-- ----------------------------------------------------------------------------
create table report_settings (
  id int primary key default 1 check (id = 1),  -- singleton
  lab_name text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  working_hours text not null default '',
  registration_no text not null default '',
  signatory_name text not null default '',
  signatory_degree text not null default '',
  signatory_title text not null default '',
  signatory2_name text not null default '',
  signatory2_degree text not null default '',
  signatory2_title text not null default '',
  signatory3_name text not null default '',
  signatory3_degree text not null default '',
  signatory3_title text not null default '',
  footer_note text not null default '',
  accent_color_hex text not null default '#2563eb',
  logo_path text,
  qr_code_path text,
  footer_image_path text,
  lab_name_alignment text not null default 'Left',
  address_alignment text not null default 'Left',
  test_title_alignment text not null default 'Center',
  font_color text not null default 'Green',
  abnormal_red_enabled boolean not null default true
);
insert into report_settings (id) values (1);

create table page_setup (
  id int primary key default 1 check (id = 1),
  report_margin jsonb not null default '{"top":2.1,"bottom":0.05,"left":0.5,"right":0.2}',
  receipt_margin jsonb not null default '{"top":2.0,"bottom":0.05,"left":0.5,"right":0.2}',
  line_space numeric(4,2) not null default 0.05,
  print_flags jsonb not null default '{}',
  footer_note_enabled boolean not null default false,
  footer_note_text text not null default ''
);
insert into page_setup (id) values (1);

-- ----------------------------------------------------------------------------
-- 14. updated_at triggers (keep patients/orders fresh without app-side code)
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger trg_patients_updated before update on patients
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Baseline policy for this v1: any authenticated staff member (any of the 5
-- roles) can read everything — this is a single-lab app, not multi-tenant
-- SaaS, so cross-branch data hiding isn't a security requirement here, just
-- a UI filter. Writes are restricted by role to match NAV_ITEMS in the
-- current frontend (config/navigation.ts) so the DB enforces the same rules
-- the UI already implies, instead of only trusting the client.

alter table profiles enable row level security;
alter table branches enable row level security;
alter table collection_centres enable row level security;
alter table doctors enable row level security;
alter table patients enable row level security;
alter table test_groups enable row level security;
alter table test_parameters enable row level security;
alter table packages enable row level security;
alter table package_test_groups enable row level security;
alter table analyzers enable row level security;
alter table methods enable row level security;
alter table analyzer_mappings enable row level security;
alter table analyzer_logs enable row level security;
alter table inventory_items enable row level security;
alter table orders enable row level security;
alter table order_test_groups enable row level security;
alter table order_results enable row level security;
alter table qc_runs enable row level security;
alter table microbiology_cases enable row level security;
alter table antibiotic_sensitivities enable row level security;
alter table doctor_vouchers enable row level security;
alter table report_settings enable row level security;
alter table page_setup enable row level security;

-- Everyone signed in can read almost everything (front desk needs to see test
-- rates, technicians need to see doctors for referral display, etc.)
create policy read_all_authenticated on branches for select using (auth.uid() is not null);
create policy read_all_authenticated on collection_centres for select using (auth.uid() is not null);
create policy read_all_authenticated on doctors for select using (auth.uid() is not null);
create policy read_all_authenticated on patients for select using (auth.uid() is not null);
create policy read_all_authenticated on test_groups for select using (auth.uid() is not null);
create policy read_all_authenticated on test_parameters for select using (auth.uid() is not null);
create policy read_all_authenticated on packages for select using (auth.uid() is not null);
create policy read_all_authenticated on package_test_groups for select using (auth.uid() is not null);
create policy read_all_authenticated on analyzers for select using (auth.uid() is not null);
create policy read_all_authenticated on methods for select using (auth.uid() is not null);
create policy read_all_authenticated on analyzer_mappings for select using (auth.uid() is not null);
create policy read_all_authenticated on analyzer_logs for select using (auth.uid() is not null);
create policy read_all_authenticated on inventory_items for select using (auth.uid() is not null);
create policy read_all_authenticated on orders for select using (auth.uid() is not null);
create policy read_all_authenticated on order_test_groups for select using (auth.uid() is not null);
create policy read_all_authenticated on order_results for select using (auth.uid() is not null);
create policy read_all_authenticated on qc_runs for select using (auth.uid() is not null);
create policy read_all_authenticated on microbiology_cases for select using (auth.uid() is not null);
create policy read_all_authenticated on antibiotic_sensitivities for select using (auth.uid() is not null);
create policy read_all_authenticated on doctor_vouchers for select using (auth.uid() is not null);
create policy read_all_authenticated on report_settings for select using (auth.uid() is not null);
create policy read_all_authenticated on page_setup for select using (auth.uid() is not null);

-- profiles: a user can read their own profile; admins can read all
create policy read_own_profile on profiles for select using (id = auth.uid() or auth_role() = 'admin');
create policy admin_manage_profiles on profiles for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- Admin-only writes: branches, report/page settings, analyzers/methods, doctors master edits
create policy admin_write_branches on branches for insert with check (auth_role() = 'admin');
create policy admin_update_branches on branches for update using (auth_role() = 'admin');
create policy admin_write_settings on report_settings for update using (auth_role() = 'admin');
create policy admin_write_pagesetup on page_setup for update using (auth_role() = 'admin');

-- front_desk + admin: patients, orders, doctors, collection centres, packages
create policy fd_write_patients on patients for insert with check (auth_role() in ('admin','front_desk'));
create policy fd_update_patients on patients for update using (auth_role() in ('admin','front_desk'));
create policy fd_write_orders on orders for insert with check (auth_role() in ('admin','front_desk'));
create policy fd_update_orders on orders for update using (auth_role() in ('admin','front_desk','accountant'));
create policy fd_write_doctors on doctors for insert with check (auth_role() in ('admin','front_desk'));
create policy fd_update_doctors on doctors for update using (auth_role() in ('admin','front_desk'));
create policy fd_write_centres on collection_centres for insert with check (auth_role() in ('admin','front_desk'));
create policy fd_write_packages on packages for insert with check (auth_role() in ('admin','front_desk'));

-- lab_technician + admin: test master, analyzers, inventory, results entry
create policy lt_write_testgroups on test_groups for insert with check (auth_role() in ('admin','lab_technician'));
create policy lt_update_testgroups on test_groups for update using (auth_role() in ('admin','lab_technician'));
create policy lt_write_params on test_parameters for insert with check (auth_role() in ('admin','lab_technician'));
create policy lt_update_params on test_parameters for update using (auth_role() in ('admin','lab_technician'));
create policy lt_write_analyzers on analyzers for insert with check (auth_role() in ('admin','lab_technician'));
create policy lt_write_inventory on inventory_items for insert with check (auth_role() in ('admin','lab_technician'));
create policy lt_update_inventory on inventory_items for update using (auth_role() in ('admin','lab_technician'));

-- results entry: lab_technician + pathologist + admin
create policy results_write on order_results for insert
  with check (auth_role() in ('admin','lab_technician','pathologist'));
create policy results_update on order_results for update
  using (auth_role() in ('admin','lab_technician','pathologist'));
create policy order_test_groups_write on order_test_groups for update
  using (auth_role() in ('admin','lab_technician','pathologist'));

-- QC: lab_technician + pathologist + admin
create policy qc_write on qc_runs for insert with check (auth_role() in ('admin','lab_technician','pathologist'));

-- Microbiology: lab_technician + pathologist + admin
create policy micro_write on microbiology_cases for insert with check (auth_role() in ('admin','lab_technician','pathologist'));
create policy micro_update on microbiology_cases for update using (auth_role() in ('admin','lab_technician','pathologist'));
create policy micro_sens_write on antibiotic_sensitivities for insert with check (auth_role() in ('admin','lab_technician','pathologist'));

-- Finance: accountant + admin (+ front_desk can collect payment on orders, handled above)
create policy finance_voucher_write on doctor_vouchers for insert with check (auth_role() in ('admin','accountant'));

-- NOTE: this is a starting-point policy set, not a final audit. Before real
-- patient data goes in, have someone who isn't the author read through these
-- policies — RLS mistakes fail open in subtle ways (a missing `with check`
-- on an UPDATE policy, for instance, lets any authenticated user rewrite
-- rows to values they shouldn't be able to set).
