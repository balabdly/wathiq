/**
 * أكواد الحسابات المعيارية — النظام الخماسي المباشر (أبو خالد، يوليو 2026)
 * مطابقة لشجرة src/data/chart-of-accounts-seed.ts — راجعها قبل أي تعديل هنا
 *
 * قاعدة صارمة: كل قيمة هنا يجب أن تشير لحساب ورقة (is_parent=false) فقط.
 * الترحيل على حساب له أبناء (513، 514، 52...) يخالف قاعدة "لا رصيد لحساب تجميعي" المُثبتة.
 */
export const ACC = {
  // ══ أصول — نقد ══
  CASH_BOX:                 '1111',   // الصناديق
  CASH_LOCAL:                '1111',
  BANK:                       '1113',   // البنوك
  CUSTODY_PARENT:          '1112',   // عهد المشاريع والمهندسين

  // ══ أصول — ذمم ومخزون ══
  CUSTOMER_RECEIVABLE:  '1121',   // حسابات العملاء (المالكين)
  RETENTION_RECEIVABLE: '1122',   // مستخلصات معتمدة تحت التحصيل
  EMPLOYEE_RECEIVABLE:  '1142',   // سُلف ومستحقات عاملين
  EMPLOYEE_LOAN_PARENT: '1142',
  OTHER_RECEIVABLE:        '1142',   // لا حساب "أخرى" مستقل بالشجرة الجديدة — نفس دلو السُلف
  VAT_INPUT:                   '1143',   // ضريبة القيمة المضافة (مشتريات) — أُضيف: غائب عن الوثيقة الأصلية
  RAW_MATERIALS:            '1131',   // مخزن المواد الرئيسي
  INVENTORY:                   '1131',
  SITE_INVENTORY:            '1132',   // مخازن المواقع والمشاريع
  GUARANTEE_LETTERS:      '1141',   // خطابات ضمان وابتدائية

  // ══ أصول ثابتة (لا "أراضي/مباني" بالوثيقة — أقرب تصنيف متاح) ══
  FIXED_ASSET_MACHINERY: '121',    // الآلات والمعدات الثقيلة
  FIXED_ASSET_VEHICLE:      '122',    // سيارات ووسائل نقل
  FIXED_ASSET_TOOLS:         '123',    // عُدد وأدوات موقع
  FIXED_ASSET_FURN:          '124',    // أثاث وتجهيزات مكتبية
  FIXED_ASSET_LAND:          '124',    // لا حساب مخصص — يُسجَّل مؤقتاً تحت الأثاث حتى يُقرَّر حساب مستقل
  FIXED_ASSET_BUILDING:    '124',
  ACCUM_DEPRECIATION:      '125',    // مجمع إهلاك الأصول الثابتة

  // ══ خصوم ══
  SUPPLIER_PAYABLE:        '2111',   // حسابات الموردين
  SUBCONTRACTOR_PAYABLE:'2112',   // حسابات مقاولي الباطن
  RETENTION_PAYABLE:      '212',    // محتجزات ضمان مقاولي الباطن
  ADVANCE_FROM_CUSTOMER: '213',    // دفعات مقدمة من العملاء
  EMPLOYEE_PAYABLE:         '21413',  // رواتب وتذاكر مستحقة أخرى
  GOSI_PAYABLE:                 '21411',  // تأمينات اجتماعية مستحقة — أُضيف تفصيلاً تحت 2141
  EOS_PROVISION:              '21412',  // مخصص مكافأة نهاية الخدمة — أُضيف تفصيلاً تحت 2141
  VAT_OUTPUT:                   '2143',   // ضريبة القيمة المضافة (مبيعات) — أُضيف
  TAX_ZAKAT_AUTHORITY:     '2142',   // مصلحة الضرائب / الزكاة والدخل
  LOAN_LONG_TERM:            '221',    // قروض وتمويلات طويلة الأجل

  // ══ حقوق ملكية ══
  PAID_IN_CAPITAL:           '31',     // رأس المال
  RETAINED_EARNINGS:       '32',     // الأرباح المبقاة
  PARTNERS_CURRENT:         '33',     // جار الشركاء
  CURRENT_YEAR_PL:           '34',     // أرباح وخسائر العام الحالي

  // ══ إيرادات ══
  SALES_REVENUE:              '411',    // إيرادات مستخلصات المشاريع (مربوط بمركز تكلفة)
  RENTAL_INCOME:               '421',    // إيرادات تأجير معدات الشركة للغير
  SCRAP_INCOME:                 '422',    // إيرادات بيع مخلفات وصنايع موقع
  GAIN_ON_ASSET:               '422',    // لا حساب مخصص لأرباح استبعاد أصل — أقرب تصنيف "إيرادات أخرى"

  // ══ تكاليف مشاريع مباشرة (51 — مربوطة بمركز التكلفة) ══
  // مواد
  DIRECT_MATERIAL_STEEL:    '5111',  // حديد تسليح
  DIRECT_MATERIAL_CONCRETE: '5112',  // خرسانة جاهزة
  DIRECT_MATERIAL_BLOCK:    '5113',  // طوب وبلوك
  DIRECT_MATERIAL_FINISH:   '5114',  // مواد تشطيبات
  RAW_MATERIALS_DEFAULT:    '5114',  // افتراضي عام لمادة غير مصنّفة
  // عمالة
  DIRECT_LABOR:                  '5122',  // أجور عمالة يومية (يوميات) — افتراضي
  SITE_ENGINEER_SALARY:     '5121',  // رواتب مهندسي ومشرفي المواقع
  SITE_HOUSING:                 '5123',  // بدل سكن وإعاشة عمال الموقع
  // مقاولو باطن — افتراضي عام؛ التصنيف الدقيق (حفر/عظم/تشطيبات) يحدَّد وقت الفاتورة
  SUBCONTRACT:                    '5132',  // افتراضي: أعمال العظم والخرسانات
  SUBCONTRACT_EXCAVATION: '5131',
  SUBCONTRACT_STRUCTURE:    '5132',
  SUBCONTRACT_FINISHING:     '5133',
  // معدات — افتراضي عام
  SITE_EQUIPMENT:              '5142',  // افتراضي: صيانة وقطع غيار
  EQUIPMENT_FUEL:               '5141',
  EQUIPMENT_MAINTENANCE:   '5142',
  EQUIPMENT_RENTAL:            '5143',
  COGS_TRANSPORT:              '5143',  // لا حساب "نقل" مخصص — أقرب تصنيف إيجار معدات خارجية
  // مصاريف موقع غير مباشرة
  SITE_PERMITS:                   '5151',
  SITE_INSURANCE:               '5152',
  SITE_UTILITIES:                 '5153',

  // ══ مصروفات عمومية وإدارية (52 — غير مربوطة بمشروع) ══
  SALARIES_EXPENSE:            '521',   // رواتب وأجور الإدارة العامة
  GOSI_EXPENSE:                    '521',   // لا حساب مصروف GOSI مستقل — ضمن رواتب الإدارة
  ALLOWANCES_EXPENSE:         '521',
  EOS_EXPENSE:                       '521',
  RENT_EXPENSE:                      '522',   // إيجار مقر الشركة الرئيسي
  UTILITIES_EXPENSE:              '523',   // كهرباء ومياه وإنترنت المركز الرئيسي
  MARKETING_EXPENSE:            '524',   // مصاريف التسويق والمناقصات
  BANK_FEES:                          '525',   // مصاريف بنكية وعمولات خطابات الضمان
  ADMIN_ASSET_DEPRECIATION: '526',  // إهلاك الأصول الإدارية

  // بلا حساب مخصص بالوثيقة الجديدة — يُوجَّه مؤقتاً لأقرب تصنيف عام حتى يُستحدث حساب خاص
  MAINTENANCE_EXPENSE:  '523',
  HOSPITALITY:               '524',
  VEHICLE_EXPENSE:          '5141',
  PENALTIES:                    '525',
  LOSS_ON_ASSET:              '526',
  OTHER_EXPENSE:              '524',
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
  if (deliveryTo === 'صيانة أسطول') return ACC.EQUIPMENT_MAINTENANCE
  if (deliveryTo === 'امتثال أسطول') return ACC.EQUIPMENT_MAINTENANCE
  if (deliveryTo === 'مستودع') return ACC.RAW_MATERIALS
  if (deliveryTo === 'أصل ثابت') {
    if (assetType === 'مركبات') return ACC.FIXED_ASSET_VEHICLE
    if (assetType === 'أثاث')   return ACC.FIXED_ASSET_FURN
    if (assetType === 'معدات') return ACC.FIXED_ASSET_MACHINERY
    return ACC.FIXED_ASSET_MACHINERY
  }
  return ACC.COGS_TRANSPORT
}
