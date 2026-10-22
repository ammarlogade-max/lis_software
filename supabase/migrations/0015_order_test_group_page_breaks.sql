alter table test_groups
  drop column if exists start_new_page;

alter table order_test_groups
  add column if not exists start_new_page boolean not null default false;
