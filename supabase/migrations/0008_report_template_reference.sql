-- Persist an uploaded report-format reference for the Report Designer.
alter table report_settings add column if not exists report_template_path text;
