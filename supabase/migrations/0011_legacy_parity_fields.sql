alter table patients
  add column if not exists patient_type text not null default 'Regular';

alter table test_parameters
  add column if not exists options text,
  add column if not exists test_description text,
  add column if not exists low_value text,
  add column if not exists high_value text,
  add column if not exists is_subtitle boolean not null default false;

update page_setup
set print_flags = jsonb_strip_nulls(
  jsonb_build_object(
    'header', coalesce(print_flags->'header', 'true'::jsonb),
    'patient_id', coalesce(print_flags->'patient_id', 'true'::jsonb),
    'sample_date', coalesce(print_flags->'sample_date', 'true'::jsonb),
    'sample_time', coalesce(print_flags->'sample_time', 'true'::jsonb),
    'received_date', coalesce(print_flags->'received_date', 'true'::jsonb),
    'received_time', coalesce(print_flags->'received_time', 'true'::jsonb),
    'reporting_date', coalesce(print_flags->'reporting_date', 'true'::jsonb),
    'registration_number', coalesce(print_flags->'registration_number', 'true'::jsonb),
    'collection_centre', coalesce(print_flags->'collection_centre', 'true'::jsonb),
    'page_number', coalesce(print_flags->'page_number', 'true'::jsonb),
    'barcode', coalesce(print_flags->'barcode', 'true'::jsonb),
    'qr_code', coalesce(print_flags->'qr_code', 'true'::jsonb),
    'uhid', coalesce(print_flags->'uhid', 'true'::jsonb),
    'header_line', coalesce(print_flags->'header_line', 'true'::jsonb),
    'footer_line', coalesce(print_flags->'footer_line', 'true'::jsonb),
    'report_end_line', coalesce(print_flags->'report_end_line', 'true'::jsonb),
    'investigations_note', coalesce(print_flags->'investigations_note', 'true'::jsonb)
  )
);
