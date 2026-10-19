alter table analyzers
  add column if not exists interface_type text not null default 'serial',
  add column if not exists barcode_symbology text not null default 'Code 128',
  add column if not exists check_digit_enabled boolean not null default false,
  add column if not exists ignore_flag_enabled boolean not null default false;

update analyzers
set interface_type = connection_type
where interface_type is null or interface_type = 'serial';
