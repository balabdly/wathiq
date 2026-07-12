-- حذف جميع القيود المحاسبية القديمة (رؤوس فارغة + قيود ما قبل الشجرة الخماسية)
-- يُعيد مسير الرواتب المرتبط لحالة «معتمد» لإتاحة إعادة الترحيل

begin;

update hr_payroll_runs
set journal_entry_id = null,
    status = case when status = 'مرحّل للمالية' then 'معتمد' else status end,
    posted_by = null,
    posted_at = null
where journal_entry_id is not null;

update hr_settlements
set journal_entry_id = null
where journal_entry_id is not null;

update hr_leave_compensations
set journal_entry_id = null
where journal_entry_id is not null;

delete from finance_journal_lines;
delete from finance_journal_entries;

commit;
