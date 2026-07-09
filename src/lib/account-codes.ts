/**
 * أكواد الحسابات المعيارية — مطابقة لـ CHART_OF_ACCOUNTS_STANDARDS.md
 */
export const ACC = {
  // أصول — نقد
  CASH_BOX:              '1110',
  CASH_LOCAL:            '1111',
  BANK:                  '1120',
  CHEQUES_UNDER_COLLECTION: '1130',
  CUSTODY_PARENT:        '1150',
  EMPLOYEE_LOAN_PARENT:  '1160',

  // أصول — ذمم ومخزون
  CUSTOMER_RECEIVABLE:   '1210',
  EMPLOYEE_RECEIVABLE:   '1220',
  OTHER_RECEIVABLE:      '1230',
  VAT_INPUT:             '1250',
  RAW_MATERIALS:         '1310',
  INVENTORY:             '1310',

  // أصول ثابتة
  FIXED_ASSET_LAND:      '1510',
  FIXED_ASSET_BUILDING:  '1520',
  FIXED_ASSET_MACHINERY: '1530',
  FIXED_ASSET_VEHICLE:   '1540',
  FIXED_ASSET_FURN:      '1550',

  // خصوم
  SUPPLIER_PAYABLE:      '2110',
  EMPLOYEE_PAYABLE:      '2120',
  GOSI_PAYABLE:          '2160',
  VAT_OUTPUT:            '2320',
  EOS_PROVISION:         '2420',

  // حقوق ملكية
  PAID_IN_CAPITAL:       '3110',
  RETAINED_EARNINGS:     '3200',

  // إيرادات
  SALES_REVENUE:         '4110',
  GAIN_ON_ASSET:         '4240',

  // تكلفة
  COGS_TRANSPORT:        '5120',
  DIRECT_LABOR:          '5110',
  SUBCONTRACT:           '5130',
  SITE_EQUIPMENT:        '5140',

  // مصروفات
  SALARIES_EXPENSE:      '5210',
  GOSI_EXPENSE:          '5220',
  ALLOWANCES_EXPENSE:    '5230',
  EOS_EXPENSE:           '5240',
  RENT_EXPENSE:          '5310',
  UTILITIES_EXPENSE:     '5320',
  MAINTENANCE_EXPENSE:   '5330',
  HOSPITALITY:           '5340',
  VEHICLE_EXPENSE:       '5410',
  BANK_FEES:             '5510',
  PENALTIES:             '5520',
  LOSS_ON_ASSET:         '5820',
  OTHER_EXPENSE:         '5800',
} as const

/** خيارات نوع الأصل في فواتير المشتريات */
export const PURCHASE_ASSET_OPTIONS = [
  { val: 'معدات', icon: '🔧', account: ACC.FIXED_ASSET_MACHINERY },
  { val: 'مركبات', icon: '🚗', account: ACC.FIXED_ASSET_VEHICLE },
  { val: 'أثاث', icon: '🪑', account: ACC.FIXED_ASSET_FURN },
] as const

/**
 * كود حساب المدين لفاتورة مشتريات حسب وجهة التسليم
 */
export function getPurchaseDebitAccountCode(deliveryTo: string, assetType?: string): string {
  if (deliveryTo === 'مستودع') return ACC.RAW_MATERIALS
  if (deliveryTo === 'أصل ثابت') {
    if (assetType === 'مركبات') return ACC.FIXED_ASSET_VEHICLE
    if (assetType === 'أثاث')   return ACC.FIXED_ASSET_FURN
    if (assetType === 'معدات') return ACC.FIXED_ASSET_MACHINERY
    return ACC.FIXED_ASSET_MACHINERY
  }
  return ACC.COGS_TRANSPORT
}
