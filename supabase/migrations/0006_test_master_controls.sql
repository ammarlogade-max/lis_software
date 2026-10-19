-- Test Master operational controls used by collection, analyzers, QC, and reports.

alter table test_groups add column if not exists department text not null default '';
alter table test_groups add column if not exists specimen_type text not null default '';
alter table test_groups add column if not exists sample_volume text not null default '';
alter table test_groups add column if not exists container_type text not null default '';
alter table test_groups add column if not exists report_sequence int not null default 0;

alter table test_parameters add column if not exists analyzer_code text not null default '';
alter table test_parameters add column if not exists critical_low text not null default '';
alter table test_parameters add column if not exists critical_high text not null default '';
alter table test_parameters add column if not exists report_comment text not null default '';
alter table test_parameters add column if not exists is_required boolean not null default true;
alter table orders add column if not exists tubes_required jsonb not null default '[]';

create index if not exists idx_test_groups_sequence on test_groups(report_sequence, display_name);
create index if not exists idx_test_parameters_analyzer_code on test_parameters(analyzer_code);
