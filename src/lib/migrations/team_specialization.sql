-- ══ تخصص الفريق — بجانب نوع الفريق (ميداني / كهربائي / سلامة / جودة) ══

alter table teams add column if not exists specialization text;

comment on column teams.specialization is 'تخصص فرعي حسب نوع الفريق — مثل: عدادات، خطوط هوائية، شبكات...';
