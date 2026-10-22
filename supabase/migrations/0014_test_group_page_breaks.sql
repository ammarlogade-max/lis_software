alter table test_groups
  add column if not exists start_new_page boolean not null default false;
