alter table report_settings
  add column if not exists signatory_signature_path text,
  add column if not exists signatory2_signature_path text,
  add column if not exists signatory3_signature_path text;
