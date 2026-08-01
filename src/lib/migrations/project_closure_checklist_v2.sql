-- قائمة الإغلاق الجديدة: أصول، GIS، تسليم 155، شهادة 156، مستخلصات

alter table project_closure add column if not exists assets_handover_date date;
alter table project_closure add column if not exists gis_mapping_date date;
alter table project_closure add column if not exists completion_certificate_date date;
alter table project_closure add column if not exists completion_certificate_file_path text;
alter table project_closure add column if not exists completion_certificate_file_name text;
alter table project_closure add column if not exists partial_invoice_number text;
alter table project_closure add column if not exists partial_invoice_date date;
alter table project_closure add column if not exists partial_invoice_amount numeric;
alter table project_closure add column if not exists partial_invoice_file_path text;
alter table project_closure add column if not exists partial_invoice_file_name text;
alter table project_closure add column if not exists partial_invoice_skipped boolean default false;
