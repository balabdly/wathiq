/**
 * أكواد الحسابات المعيارية — مطابقة لـ CHART_OF_ACCOUNTS_STANDARDS.md
 */
export const ACC = {
  // أصول — نقد وذمم
  CASH_BOX:           '1110',
  CASH_LOCAL:         '1111',
  BANK:               '1120',
  CUSTOMER_RECEIVABLE:'1210',
  INVENTORY:          '1130',
  FIXED_ASSET_EQUIP:   '1220',
  FIXED_ASSET_VEHICLE: '1540',
  FIXED_ASSET_FURN:    '1550',

  // خصوم
  SUPPLIER_PAYABLE:   '2110',
  EMPLOYEE_PAYABLE:   '2120',
  GOSI_PAYABLE:       '2160',
  VAT_OUTPUT:         '2320',   // ضريبة القيمة المضافة المحصّلة
  VAT_INPUT:          '1250',   // ضريبة القيمة المضافة المستردة (مدخلات)
  EOS_PROVISION:      '2420',

  // حقوق ملكية
  RETAINED_EARNINGS:  '3200',

  // إيرادات
  SALES_REVENUE:      '4110',

  // تكلفة ومصروفات
  COGS_TRANSPORT:     '5120',
  DIRECT_LABOR:       '5110',
  SUBCONTRACT:        '5130',
  SITE_EQUIPMENT:     '5140',
  SALARIES_EXPENSE:   '5210',
  GOSI_EXPENSE:       '5220',
  ALLOWANCES_EXPENSE: '5230',
  EOS_EXPENSE:        '5240',
  RENT_EXPENSE:       '5310',
  UTILITIES_EXPENSE:  '5320',
  MAINTENANCE_EXPENSE:'5330',
  VEHICLE_EXPENSE:    '5410',
  BANK_FEES:          '5510',
  PENALTIES:          '5520',
  HOSPITALITY:        '5340',
  OTHER_EXPENSE:      '5800',
} as const
