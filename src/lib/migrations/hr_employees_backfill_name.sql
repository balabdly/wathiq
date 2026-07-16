-- ══ إكمال حقل name الناقص من أجزاء الاسم في hr_employees ══

update hr_employees
set name = trim(concat_ws(' ', first_name, father_name, grandfather_name, family_name))
where (name is null or trim(name) = '')
  and coalesce(trim(concat_ws(' ', first_name, father_name, grandfather_name, family_name)), '') <> '';
