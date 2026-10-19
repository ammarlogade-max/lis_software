-- Branch isolation for operational order data. Administrators retain
-- cross-branch visibility; staff are restricted to their assigned branch.

drop policy if exists read_all_authenticated on orders;
drop policy if exists fd_write_orders on orders;
drop policy if exists fd_update_orders on orders;
drop policy if exists operational_order_update on orders;

create policy orders_branch_read on orders for select
  using (auth_role() = 'admin' or branch_id = auth_branch_id());

create policy orders_branch_insert on orders for insert
  with check (
    auth_role() = 'admin'
    or (auth_role() in ('front_desk', 'accountant') and branch_id = auth_branch_id())
  );

create policy orders_branch_update on orders for update
  using (auth_role() = 'admin' or branch_id = auth_branch_id())
  with check (auth_role() = 'admin' or branch_id = auth_branch_id());

-- Child rows inherit access through their parent order. These policies also
-- prevent a staff member from attaching results to another branch's order.
drop policy if exists read_all_authenticated on order_test_groups;
drop policy if exists order_test_groups_insert on order_test_groups;
drop policy if exists order_test_groups_write on order_test_groups;
drop policy if exists order_results_select on order_results;
drop policy if exists results_write on order_results;
drop policy if exists results_update on order_results;

create policy order_test_groups_branch_read on order_test_groups for select
  using (exists (select 1 from orders where orders.id = order_test_groups.order_id and (auth_role() = 'admin' or orders.branch_id = auth_branch_id())));
create policy order_test_groups_branch_insert on order_test_groups for insert
  with check (exists (select 1 from orders where orders.id = order_test_groups.order_id and (auth_role() = 'admin' or orders.branch_id = auth_branch_id())));
create policy order_test_groups_branch_update on order_test_groups for update
  using (exists (select 1 from orders where orders.id = order_test_groups.order_id and (auth_role() = 'admin' or orders.branch_id = auth_branch_id())))
  with check (exists (select 1 from orders where orders.id = order_test_groups.order_id and (auth_role() = 'admin' or orders.branch_id = auth_branch_id())));

create policy order_results_branch_read on order_results for select
  using (exists (
    select 1 from order_test_groups otg
    join orders o on o.id = otg.order_id
    where otg.id = order_results.order_test_group_id
      and (auth_role() = 'admin' or o.branch_id = auth_branch_id())
  ));
create policy order_results_branch_insert on order_results for insert
  with check (exists (
    select 1 from order_test_groups otg
    join orders o on o.id = otg.order_id
    where otg.id = order_results.order_test_group_id
      and (auth_role() = 'admin' or o.branch_id = auth_branch_id())
      and auth_role() in ('admin', 'lab_technician', 'pathologist')
  ));
create policy order_results_branch_update on order_results for update
  using (exists (
    select 1 from order_test_groups otg
    join orders o on o.id = otg.order_id
    where otg.id = order_results.order_test_group_id
      and (auth_role() = 'admin' or o.branch_id = auth_branch_id())
  ))
  with check (exists (
    select 1 from order_test_groups otg
    join orders o on o.id = otg.order_id
    where otg.id = order_results.order_test_group_id
      and (auth_role() = 'admin' or o.branch_id = auth_branch_id())
      and auth_role() in ('admin', 'lab_technician', 'pathologist')
  ));
