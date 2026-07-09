/**
 * شجرة الحسابات المعيارية — مصدر البيانات لـ seedChartOfAccounts()
 * مطابقة لـ CHART_OF_ACCOUNTS_STANDARDS.md + حسابات تشغيلية للتطبيق
 */

export type CoaSeedAccount = {
  code: string
  name: string
  name_en: string
  account_type: 'أصول' | 'خصوم' | 'حقوق ملكية' | 'إيرادات' | 'تكلفة' | 'مصروفات'
  normal_balance: 'مدين' | 'دائن'
  is_parent: boolean
  level: number
  parent_code?: string
}

export function coaAccountClass(type: CoaSeedAccount['account_type']): 'ميزانية' | 'دخل' {
  return ['أصول', 'خصوم', 'حقوق ملكية'].includes(type) ? 'ميزانية' : 'دخل'
}

/** الحسابات مرتبة حسب المستوى — الأب قبل الابن */
export const CHART_OF_ACCOUNTS_SEED: CoaSeedAccount[] = [
  // ══ أصول ══
  { code: '1000', name: 'الأصول المتداولة', name_en: 'Current Assets', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 1 },
  { code: '1100', name: 'النقد والعملات', name_en: 'Cash & Currency', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 2, parent_code: '1000' },
  { code: '1110', name: 'الصندوق', name_en: 'Cash Box', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 3, parent_code: '1100' },
  { code: '1111', name: 'الصندوق - العملة المحلية', name_en: 'Cash - Local Currency', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '1110' },
  { code: '1112', name: 'الصندوق - دولار أمريكي', name_en: 'Cash - USD', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '1110' },
  { code: '1120', name: 'البنك', name_en: 'Bank Account', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 3, parent_code: '1100' },
  { code: '1121', name: 'البنك الأهلي', name_en: 'National Bank', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '1120' },
  { code: '1122', name: 'البنك الراجحي', name_en: 'Al Rajhi Bank', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '1120' },
  { code: '1130', name: 'الشيكات تحت التحصيل', name_en: 'Cheques Under Collection', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '1100' },
  { code: '1140', name: 'التحويلات البنكية', name_en: 'Bank Transfers', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '1100' },
  { code: '1150', name: 'عهد الموظفين', name_en: 'Employee Custody', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 3, parent_code: '1100' },
  { code: '1200', name: 'الذمم المدينة', name_en: 'Accounts Receivable', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 2, parent_code: '1000' },
  { code: '1210', name: 'ذمم العملاء', name_en: 'Customer Receivables', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '1200' },
  { code: '1220', name: 'ذمم موظفين', name_en: 'Employee Receivables', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '1200' },
  { code: '1230', name: 'ذمم أخرى', name_en: 'Other Receivables', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '1200' },
  { code: '1240', name: 'مخصص ديون مشكوك فيها', name_en: 'Provision for Doubtful Debts', account_type: 'أصول', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '1200' },
  { code: '1250', name: 'ضريبة القيمة المضافة المستردة', name_en: 'VAT Input Recoverable', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '1200' },
  { code: '1300', name: 'المخزون', name_en: 'Inventory', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 2, parent_code: '1000' },
  { code: '1310', name: 'المواد الخام', name_en: 'Raw Materials', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '1300' },
  { code: '1320', name: 'الإنتاج تحت التشغيل', name_en: 'Work in Progress', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '1300' },
  { code: '1330', name: 'المنتجات النهائية', name_en: 'Finished Goods', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '1300' },
  { code: '1340', name: 'البضائع الراكدة', name_en: 'Obsolete Inventory', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '1300' },
  { code: '1400', name: 'المصروفات المقدمة', name_en: 'Prepaid Expenses', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 2, parent_code: '1000' },
  { code: '1410', name: 'الإيجار المقدم', name_en: 'Prepaid Rent', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '1400' },
  { code: '1420', name: 'التأمين المقدم', name_en: 'Prepaid Insurance', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '1400' },
  { code: '1430', name: 'الرسوم والاشتراكات المقدمة', name_en: 'Prepaid Fees', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '1400' },
  { code: '1500', name: 'الممتلكات والآلات والمعدات', name_en: 'Property, Plant & Equipment', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 1 },
  { code: '1510', name: 'الأراضي', name_en: 'Land', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '1500' },
  { code: '1520', name: 'المباني', name_en: 'Buildings', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '1500' },
  { code: '1530', name: 'الآلات والمعدات', name_en: 'Machinery & Equipment', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '1500' },
  { code: '1540', name: 'المركبات', name_en: 'Vehicles', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '1500' },
  { code: '1550', name: 'الأثاث والتجهيزات', name_en: 'Furniture & Fixtures', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '1500' },
  { code: '1600', name: 'الاستهلاك المتراكم', name_en: 'Accumulated Depreciation', account_type: 'أصول', normal_balance: 'دائن', is_parent: true, level: 1 },
  { code: '1610', name: 'استهلاك المباني', name_en: 'Depreciation - Buildings', account_type: 'أصول', normal_balance: 'دائن', is_parent: false, level: 2, parent_code: '1600' },
  { code: '1620', name: 'استهلاك الآلات', name_en: 'Depreciation - Machinery', account_type: 'أصول', normal_balance: 'دائن', is_parent: false, level: 2, parent_code: '1600' },
  { code: '1630', name: 'استهلاك المركبات', name_en: 'Depreciation - Vehicles', account_type: 'أصول', normal_balance: 'دائن', is_parent: false, level: 2, parent_code: '1600' },
  { code: '1640', name: 'استهلاك الأثاث', name_en: 'Depreciation - Furniture', account_type: 'أصول', normal_balance: 'دائن', is_parent: false, level: 2, parent_code: '1600' },
  { code: '1700', name: 'الأصول غير الملموسة', name_en: 'Intangible Assets', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 1 },
  { code: '1710', name: 'الشهرة', name_en: 'Goodwill', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '1700' },
  { code: '1720', name: 'براءات الاختراع', name_en: 'Patents', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '1700' },
  { code: '1730', name: 'العلامات التجارية', name_en: 'Trademarks', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '1700' },
  { code: '1740', name: 'حقوق الامتياز', name_en: 'Franchise Rights', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '1700' },
  { code: '1800', name: 'استثمارات طويلة الأجل', name_en: 'Long-term Investments', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 1 },
  { code: '1810', name: 'استثمارات في أسهم', name_en: 'Share Investments', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '1800' },
  { code: '1820', name: 'سندات استثمارية', name_en: 'Investment Bonds', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '1800' },
  { code: '1830', name: 'قروض طويلة الأجل', name_en: 'Long-term Loans', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '1800' },

  // ══ خصوم ══
  { code: '2000', name: 'الخصوم المتداولة', name_en: 'Current Liabilities', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 1 },
  { code: '2100', name: 'الذمم الدائنة', name_en: 'Accounts Payable', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '2000' },
  { code: '2110', name: 'ذمم الموردين', name_en: 'Supplier Payables', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2100' },
  { code: '2120', name: 'ذمم الموظفين', name_en: 'Employee Payables', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2100' },
  { code: '2130', name: 'ذمم أخرى', name_en: 'Other Payables', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2100' },
  { code: '2160', name: 'تأمينات مستحقة', name_en: 'GOSI Payable', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2100' },
  { code: '2200', name: 'القروض قصيرة الأجل', name_en: 'Short-term Loans', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '2000' },
  { code: '2210', name: 'قرض بنكي قصير الأجل', name_en: 'Bank Short-term Loan', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2200' },
  { code: '2220', name: 'قروض من الجهات الحكومية', name_en: 'Government Loans', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2200' },
  { code: '2300', name: 'الضرائب المستحقة', name_en: 'Taxes Payable', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '2000' },
  { code: '2310', name: 'ضريبة الدخل المستحقة', name_en: 'Income Tax Payable', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2300' },
  { code: '2320', name: 'ضريبة القيمة المضافة', name_en: 'VAT Payable', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2300' },
  { code: '2330', name: 'ضرائب أخرى', name_en: 'Other Taxes', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2300' },
  { code: '2400', name: 'الرواتب والأجور المستحقة', name_en: 'Accrued Salaries & Wages', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '2000' },
  { code: '2410', name: 'رواتب الموظفين', name_en: 'Employee Salaries', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2400' },
  { code: '2420', name: 'مكافآت نهاية الخدمة', name_en: 'End of Service Benefits', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2400' },
  { code: '2500', name: 'الخصوم طويلة الأجل', name_en: 'Long-term Liabilities', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 1 },
  { code: '2600', name: 'القروض طويلة الأجل', name_en: 'Long-term Loans', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '2500' },
  { code: '2610', name: 'قروض بنكية طويلة الأجل', name_en: 'Bank Long-term Loans', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2600' },
  { code: '2620', name: 'سندات الدين', name_en: 'Bonds Payable', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2600' },
  { code: '2700', name: 'الإيرادات المقدمة', name_en: 'Deferred Revenue', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '2500' },
  { code: '2710', name: 'إيرادات الخدمات المقدمة', name_en: 'Deferred Service Revenue', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2700' },
  { code: '2720', name: 'إيرادات المشاريع المقدمة', name_en: 'Deferred Project Revenue', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2700' },
  { code: '2800', name: 'المخصصات', name_en: 'Provisions', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '2500' },
  { code: '2810', name: 'مخصص قضايا قانونية', name_en: 'Litigation Provision', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2800' },
  { code: '2820', name: 'مخصص ضمانات المنتجات', name_en: 'Warranty Provision', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '2800' },

  // ══ حقوق ملكية ══
  { code: '3000', name: 'حقوق الملكية', name_en: 'Equity', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: true, level: 1 },
  { code: '3100', name: 'رأس المال', name_en: 'Capital', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '3000' },
  { code: '3110', name: 'رأس المال المدفوع', name_en: 'Paid-in Capital', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '3100' },
  { code: '3120', name: 'الاحتياطيات', name_en: 'Reserves', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '3100' },
  { code: '3130', name: 'علاوة الإصدار', name_en: 'Share Premium', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '3100' },
  { code: '3200', name: 'الأرباح المحتفظ بها', name_en: 'Retained Earnings', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: false, level: 2, parent_code: '3000' },
  { code: '3300', name: 'الأرباح الموزعة', name_en: 'Dividends', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '3000' },
  { code: '3310', name: 'أرباح نقدية موزعة', name_en: 'Cash Dividends', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '3300' },
  { code: '3320', name: 'أرباح أسهم موزعة', name_en: 'Stock Dividends', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '3300' },

  // ══ إيرادات ══
  { code: '4000', name: 'الإيرادات', name_en: 'Revenue', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: true, level: 1 },
  { code: '4100', name: 'إيرادات المبيعات', name_en: 'Sales Revenue', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '4000' },
  { code: '4110', name: 'مبيعات المنتجات', name_en: 'Product Sales', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '4100' },
  { code: '4120', name: 'مبيعات الخدمات', name_en: 'Service Revenue', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '4100' },
  { code: '4130', name: 'مبيعات مرتجعة', name_en: 'Sales Returns', account_type: 'إيرادات', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '4100' },
  { code: '4140', name: 'خصومات المبيعات', name_en: 'Sales Discounts', account_type: 'إيرادات', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '4100' },
  { code: '4200', name: 'إيرادات أخرى', name_en: 'Other Revenue', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '4000' },
  { code: '4210', name: 'إيرادات الفوائد', name_en: 'Interest Revenue', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '4200' },
  { code: '4220', name: 'إيرادات الإيجار', name_en: 'Rental Revenue', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '4200' },
  { code: '4230', name: 'إيرادات العمولات', name_en: 'Commission Revenue', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '4200' },
  { code: '4240', name: 'أرباح بيع الأصول', name_en: 'Gain on Sale of Assets', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '4200' },

  // ══ تكلفة ══
  { code: '5000', name: 'تكلفة المبيعات', name_en: 'Cost of Goods Sold', account_type: 'تكلفة', normal_balance: 'مدين', is_parent: true, level: 1 },
  { code: '5100', name: 'المواد الخام المستخدمة', name_en: 'Raw Materials Used', account_type: 'تكلفة', normal_balance: 'مدين', is_parent: true, level: 2, parent_code: '5000' },
  { code: '5110', name: 'تكلفة المواد الأولية', name_en: 'Prime Materials Cost', account_type: 'تكلفة', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '5100' },
  { code: '5120', name: 'النقل والتأمين', name_en: 'Transportation & Insurance', account_type: 'تكلفة', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '5100' },
  { code: '5130', name: 'مقاولي باطن', name_en: 'Subcontractors', account_type: 'تكلفة', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '5100' },
  { code: '5140', name: 'معدات وآلات الموقع', name_en: 'Site Equipment', account_type: 'تكلفة', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '5100' },
  { code: '5200', name: 'العمل المباشر', name_en: 'Direct Labor', account_type: 'تكلفة', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5000' },
  { code: '5300', name: 'المصروفات الصناعية', name_en: 'Manufacturing Overhead', account_type: 'تكلفة', normal_balance: 'مدين', is_parent: true, level: 2, parent_code: '5000' },

  // ══ مصروفات ══
  { code: '5500', name: 'مصروفات البيع والتسويق', name_en: 'Selling & Marketing', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 1 },
  { code: '5510', name: 'رواتب فريق البيع', name_en: 'Sales Staff Salaries', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5500' },
  { code: '5520', name: 'مصروفات الإعلان', name_en: 'Advertising Expenses', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5500' },
  { code: '5530', name: 'عمولات البيع', name_en: 'Sales Commissions', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5500' },
  { code: '5540', name: 'مصروفات التوزيع', name_en: 'Distribution Expenses', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5500' },
  { code: '5410', name: 'مصروفات السيارات', name_en: 'Vehicle Expenses', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5500' },
  { code: '5600', name: 'مصروفات إدارية', name_en: 'Administrative Expenses', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 1 },
  { code: '5610', name: 'رواتب الموظفين الإداريين', name_en: 'Administrative Staff Salaries', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5600' },
  { code: '5210', name: 'رواتب وأجور', name_en: 'Salaries & Wages', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5600' },
  { code: '5220', name: 'تأمينات اجتماعية', name_en: 'GOSI Expense', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5600' },
  { code: '5230', name: 'بدلات وعلاوات', name_en: 'Allowances', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5600' },
  { code: '5240', name: 'مصروف مكافأة نهاية الخدمة', name_en: 'EOS Expense', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5600' },
  { code: '5340', name: 'ضيافة وعلاقات عامة', name_en: 'Hospitality', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5600' },
  { code: '5620', name: 'مصروفات المكتب', name_en: 'Office Expenses', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5600' },
  { code: '5630', name: 'مصروفات القانونية والاستشارات', name_en: 'Legal & Consulting', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5600' },
  { code: '5640', name: 'مصروفات السفر', name_en: 'Travel Expenses', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5600' },
  { code: '5700', name: 'مصروفات المرافق', name_en: 'Utilities & Rent', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 1 },
  { code: '5310', name: 'الإيجار', name_en: 'Rent', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5700' },
  { code: '5320', name: 'الكهرباء والمياه', name_en: 'Electricity & Water', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5700' },
  { code: '5330', name: 'الصيانة', name_en: 'Maintenance', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5700' },
  { code: '5710', name: 'الإيجار — تفصيلي', name_en: 'Rent Detail', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5700' },
  { code: '5720', name: 'الكهرباء والمياه — تفصيلي', name_en: 'Utilities Detail', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5700' },
  { code: '5730', name: 'الإنترنت والاتصالات', name_en: 'Internet & Communications', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5700' },
  { code: '5740', name: 'التأمين', name_en: 'Insurance', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5700' },
  { code: '5800', name: 'مصروفات أخرى', name_en: 'Other Expenses', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 1 },
  { code: '5810', name: 'الاستهلاك', name_en: 'Depreciation', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5800' },
  { code: '5820', name: 'خسائر بيع الأصول', name_en: 'Loss on Sale of Assets', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5800' },
  { code: '5830', name: 'فائدة مصروفة', name_en: 'Interest Expense', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '5800' },
  { code: '6000', name: 'المصروفات العامة', name_en: 'General Expenses', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 1 },
  { code: '6100', name: 'رسوم وعمولات بنكية', name_en: 'Bank Fees & Commissions', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '6000' },
  { code: '6200', name: 'ضرائب ومدفوعات حكومية', name_en: 'Taxes & Government Fees', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 2, parent_code: '6000' },
  { code: '6300', name: 'مصروفات موارد بشرية', name_en: 'HR Expenses', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 2, parent_code: '6000' },
  { code: '6310', name: 'تكاليف التدريب', name_en: 'Training Costs', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '6300' },
  { code: '6320', name: 'مصروفات الصحة والسلامة', name_en: 'Health & Safety', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '6300' },
]
