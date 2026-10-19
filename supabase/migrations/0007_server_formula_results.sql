-- Authoritative result saving and formula recalculation in PostgreSQL.
-- Formulas are restricted to numeric arithmetic, parentheses, and ID references.

create or replace function save_order_results(
  p_order_test_group_id uuid,
  p_order_id uuid,
  p_values jsonb,
  p_entered_by uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  computed_values jsonb := coalesce(p_values, '{}'::jsonb);
  parameter_row record;
  reference_id uuid;
  reference_value text;
  expression text;
  calculated numeric;
  decimals int;
  result_row record;
  remaining_count int;
begin
  if actor is null or p_entered_by is null or actor <> p_entered_by then
    raise exception 'An active staff session is required';
  end if;
  if auth_role() not in ('admin', 'lab_technician', 'pathologist') then
    raise exception 'Not authorized to save laboratory results';
  end if;
  if not exists (
    select 1
    from order_test_groups otg
    join orders o on o.id = otg.order_id
    where otg.id = p_order_test_group_id
      and otg.order_id = p_order_id
      and (auth_role() = 'admin' or o.branch_id = auth_branch_id())
  ) then
    raise exception 'Order test group is not accessible';
  end if;

  for parameter_row in
    select tp.id, tp.formula, tp.decimal_format, tp.sort_order
    from order_test_groups otg
    join test_groups tg on tg.id = otg.test_group_id
    join test_parameters tp on tp.test_group_id = tg.id
    where otg.id = p_order_test_group_id
    order by tp.sort_order, tp.id
  loop
    if parameter_row.formula is null or btrim(parameter_row.formula) = '' then
      continue;
    end if;

    expression := parameter_row.formula;
    -- Replace larger positions first so ID1 cannot partially match ID10.
    for position_index in reverse 100..1 loop
      if strpos(expression, 'ID' || position_index) > 0 then
        select tp.id into reference_id
        from order_test_groups otg
        join test_groups tg on tg.id = otg.test_group_id
        join test_parameters tp on tp.test_group_id = tg.id
        where otg.id = p_order_test_group_id
        order by tp.sort_order, tp.id
        offset position_index - 1 limit 1;
        if reference_id is null then
          raise exception 'Formula references missing parameter ID%', position_index;
        end if;
        reference_value := computed_values ->> reference_id::text;
        if reference_value is null or btrim(reference_value) = '' or reference_value !~ '^-?[0-9]+(\.[0-9]+)?$' then
          raise exception 'Formula input ID% is missing or not numeric', position_index;
        end if;
        expression := replace(expression, 'ID' || position_index, reference_value);
      end if;
    end loop;

    if length(expression) > 500 or expression !~ '^[0-9+*/().[:space:]-]+$' then
      raise exception 'Formula contains unsupported syntax';
    end if;
    execute 'select (' || expression || ')::numeric' into calculated;
    decimals := least(greatest(coalesce(length(split_part(parameter_row.decimal_format, '.', 2)), 2), 0), 6);
    if decimals = 0 then
      computed_values := jsonb_set(computed_values, array[parameter_row.id::text], to_jsonb(round(calculated)), true);
    else
      computed_values := jsonb_set(computed_values, array[parameter_row.id::text], to_jsonb(to_char(round(calculated, decimals), 'FM999999999990.' || repeat('0', decimals))), true);
    end if;
  end loop;

  for result_row in select key, value from jsonb_each_text(computed_values)
  loop
    insert into order_results(order_test_group_id, parameter_id, value, entered_by, entered_at)
    values (p_order_test_group_id, result_row.key::uuid, result_row.value, actor, now())
    on conflict (order_test_group_id, parameter_id)
    do update set value = excluded.value, entered_by = excluded.entered_by, entered_at = excluded.entered_at;
  end loop;

  update order_test_groups set status = 'completed' where id = p_order_test_group_id;
  select count(*) into remaining_count from order_test_groups where order_id = p_order_id and status <> 'completed';
  if remaining_count = 0 then
    update orders set status = 'completed' where id = p_order_id;
  end if;

  insert into audit_events(actor_id, action, entity_type, entity_id, branch_id, metadata)
  select actor, 'results_saved', 'order_test_group', p_order_test_group_id, o.branch_id,
         jsonb_build_object('order_id', p_order_id)
  from orders o where o.id = p_order_id;
end;
$$;

revoke all on function save_order_results(uuid, uuid, jsonb, uuid) from public;
grant execute on function save_order_results(uuid, uuid, jsonb, uuid) to authenticated;
