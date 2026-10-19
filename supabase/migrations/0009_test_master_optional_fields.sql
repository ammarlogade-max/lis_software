-- Restore the optionality expected by Test Master and the import workbook.
-- Earlier migrations may have created these columns as NOT NULL depending on
-- migration order; blank spreadsheet fields are intentionally stored as NULL.

alter table test_groups
  alter column specimen_type drop not null,
  alter column sample_volume drop not null,
  alter column container_type drop not null;

alter table test_parameters
  alter column analyzer_code drop not null,
  alter column critical_low drop not null,
  alter column critical_high drop not null,
  alter column report_comment drop not null;