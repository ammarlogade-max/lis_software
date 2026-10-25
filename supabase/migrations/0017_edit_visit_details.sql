create or replace function update_visit_details(
  p_order_id uuid,
  p_patient jsonb,
  p_visit jsonb,
  p_test_group_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  current_order orders%rowtype;
  selected_test_count integer;
  test_subtotal numeric(10,2);
  updated_payable numeric(10,2);
begin
  if actor is null or auth_role() is null or auth_role() not in ('admin', 'front_desk') then
    raise exception 'Only administrators or front desk staff can edit visit details';
  end if;

  select * into current_order
  from orders
  where id = p_order_id
    and (auth_role() = 'admin' or branch_id = auth_branch_id())
  for update;

  if not found then
    raise exception 'Visit not found or not accessible';
  end if;

  if p_patient is null or p_visit is null or coalesce(array_length(p_test_group_ids, 1), 0) = 0 then
    raise exception 'Patient, visit, and at least one test are required';
  end if;
  if nullif(btrim(p_patient ->> 'full_name'), '') is null then
    raise exception 'Patient name is required';
  end if;
  if coalesce(p_patient ->> 'gender', '') not in ('Male', 'Female', 'Other') then
    raise exception 'Select a valid patient gender';
  end if;
  if coalesce(nullif(p_patient ->> 'age_years', '')::integer, 0) < 0
     or coalesce(nullif(p_patient ->> 'age_months', '')::integer, 0) not between 0 and 11
     or coalesce(nullif(p_patient ->> 'age_days', '')::integer, 0) not between 0 and 31 then
    raise exception 'Patient age must use non-negative years, 0-11 months, and 0-31 days';
  end if;
  if coalesce((p_visit ->> 'discount_percent')::numeric, 0) < 0
     or coalesce((p_visit ->> 'discount_percent')::numeric, 0) > 100 then
    raise exception 'Discount must be between 0 and 100 percent';
  end if;

  select count(distinct requested.test_group_id) into selected_test_count
  from unnest(p_test_group_ids) as requested(test_group_id);
  if selected_test_count <> cardinality(p_test_group_ids) then
    raise exception 'A test cannot be selected more than once';
  end if;
  if selected_test_count <> (
    select count(*) from test_groups where id = any(p_test_group_ids)
  ) then
    raise exception 'One or more selected tests do not exist';
  end if;

  update patients
  set title = coalesce(nullif(p_patient ->> 'title', ''), 'Mr.'),
      patient_type = coalesce(nullif(p_patient ->> 'patient_type', ''), 'Regular'),
      full_name = btrim(p_patient ->> 'full_name'),
      gender = p_patient ->> 'gender',
      age_years = nullif(p_patient ->> 'age_years', '')::integer,
      age_months = coalesce(nullif(p_patient ->> 'age_months', '')::integer, 0),
      age_days = coalesce(nullif(p_patient ->> 'age_days', '')::integer, 0),
      phone = nullif(btrim(p_patient ->> 'phone'), ''),
      email = nullif(btrim(p_patient ->> 'email'), ''),
      address = nullif(btrim(p_patient ->> 'address'), ''),
      city = nullif(btrim(p_patient ->> 'city'), ''),
      history = nullif(btrim(p_patient ->> 'history'), ''),
      updated_at = now()
  where id = current_order.patient_id;

  update orders
  set specimen_id = nullif(btrim(p_visit ->> 'specimen_id'), ''),
      doctor_id = nullif(p_visit ->> 'doctor_id', '')::uuid,
      centre_id = nullif(p_visit ->> 'centre_id', '')::uuid,
      collection_at = nullif(p_visit ->> 'collection_at', '')::timestamptz,
      received_at = nullif(p_visit ->> 'received_at', '')::timestamptz,
      reporting_at = nullif(p_visit ->> 'reporting_at', '')::timestamptz,
      remarks = coalesce(p_visit ->> 'remarks', ''),
      fasting_status = coalesce(nullif(p_visit ->> 'fasting_status', ''), 'Unspecified'),
      priority = coalesce(nullif(p_visit ->> 'priority', ''), 'routine'),
      discount_percent = coalesce((p_visit ->> 'discount_percent')::numeric, 0)
  where id = p_order_id;

  delete from order_test_groups
  where order_id = p_order_id
    and not (test_group_id = any(p_test_group_ids));

  insert into order_test_groups (order_id, test_group_id)
  select p_order_id, requested.test_group_id
  from unnest(p_test_group_ids) as requested(test_group_id)
  where not exists (
    select 1 from order_test_groups existing
    where existing.order_id = p_order_id
      and existing.test_group_id = requested.test_group_id
  );

  select coalesce(sum(rate), 0)::numeric(10,2) into test_subtotal
  from test_groups
  where id = any(p_test_group_ids);
  updated_payable := round(test_subtotal * (100 - coalesce((p_visit ->> 'discount_percent')::numeric, 0)) / 100, 2);

  update orders
  set payable = updated_payable,
      due = greatest(0, updated_payable - paid),
      status = case
        when current_order.status = 'cancelled' then 'cancelled'
        when exists (
          select 1 from order_test_groups
          where order_id = p_order_id and status <> 'completed'
        ) then case
          when current_order.status in ('sample_collected', 'completed') then 'sample_collected'
          else current_order.status
        end
        else 'completed'
      end
  where id = p_order_id;

  insert into audit_events(actor_id, action, entity_type, entity_id, branch_id, metadata)
  values (
    actor,
    'visit_details_updated',
    'order',
    p_order_id,
    current_order.branch_id,
    jsonb_build_object(
      'patient_id', current_order.patient_id,
      'selected_test_group_ids', p_test_group_ids,
      'payable_before', current_order.payable,
      'payable_after', updated_payable
    )
  );
end;
$$;

revoke all on function update_visit_details(uuid, jsonb, jsonb, uuid[]) from public;
grant execute on function update_visit_details(uuid, jsonb, jsonb, uuid[]) to authenticated;
