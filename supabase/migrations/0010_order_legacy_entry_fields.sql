-- Legacy PathoOne-style registration fields on visit orders.
alter table orders
  add column if not exists collection_at timestamptz,
  add column if not exists received_at timestamptz,
  add column if not exists reporting_at timestamptz,
  add column if not exists remarks text not null default '';
