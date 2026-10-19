-- ============================================================================
-- Auto-create a `profiles` row whenever a new staff account is created in
-- Supabase Auth (Dashboard -> Authentication -> Users -> Add user, or via
-- the admin-invite flow). Without this, a new login would exist in
-- auth.users but have no role/branch, and would fail to sign in (see
-- AuthContext.tsx — a missing profile is treated as "no access").
--
-- New accounts default to the LEAST privileged role (front_desk). Promote
-- the very first admin manually after creating their account — see
-- SETUP.md step 5.
-- ============================================================================

create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'front_desk'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
