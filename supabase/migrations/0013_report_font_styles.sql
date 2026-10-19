alter table report_settings
  add column if not exists font_styles jsonb not null default '{
    "lab_name":{"size":18,"weight":"bold","color":"#111827"},
    "address":{"size":11,"weight":"normal","color":"#475569"},
    "test_title":{"size":14,"weight":"bold","color":"#111827"},
    "test_name":{"size":12,"weight":"normal","color":"#1e293b"},
    "result":{"size":12,"weight":"bold","color":"#1e293b"},
    "unit":{"size":11,"weight":"normal","color":"#475569"},
    "normal_values":{"size":11,"weight":"normal","color":"#475569"}
  }'::jsonb;
