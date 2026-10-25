alter table test_groups
  add column if not exists is_default boolean not null default false;

create or replace function protect_default_test_group()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_default then
      raise exception 'Default test groups cannot be deleted';
    end if;
    return old;
  end if;

  if new.is_default and not new.is_active then
    raise exception 'A default test group must remain active';
  end if;

  if tg_op = 'UPDATE' then
    if old.is_default and not new.is_default then
      raise exception 'The Default protection on a test group cannot be removed';
    end if;
    if old.is_default and not new.is_active then
      raise exception 'Default test groups cannot be deactivated';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_default_test_group on test_groups;
create trigger protect_default_test_group
before insert or update or delete on test_groups
for each row execute function protect_default_test_group();
