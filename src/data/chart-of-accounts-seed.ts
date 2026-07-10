/**
 * شجرة الحسابات المعيارية — النظام الخماسي المباشر (مرجع أبو خالد، يوليو 2026)
 * يحل محل الشجرة السابقة بالكامل — راجع محادثة "إعادة هيكلة شجرة الحسابات" للسياق الكامل
 *
 * البنية: 1 أصول | 2 التزامات | 3 حقوق ملكية | 4 إيرادات | 5 مصروفات
 * كل مستوى يضيف خانة واحدة على كود الأب (1 → 11 → 111 → 1111)
 * تكاليف المشاريع والمصاريف الإدارية مدمجة تحت "5. المصروفات" — لا نوع "تكلفة" منفصل
 */

export type CoaSeedAccount = {
  code: string
  name: string
  name_en: string
  account_type: 'أصول' | 'خصوم' | 'حقوق ملكية' | 'إيرادات' | 'مصروفات'
  normal_balance: 'مدين' | 'دائن'
  is_parent: boolean
  level: number
  parent_code?: string
  cost_center_linked?: boolean   // يُربط بمراكز التكلفة/المشاريع
}

export function coaAccountClass(type: CoaSeedAccount['account_type']): 'ميزانية' | 'دخل' {
  return ['أصول', 'خصوم', 'حقوق ملكية'].includes(type) ? 'ميزانية' : 'دخل'
}

/** الحسابات مرتبة حسب المستوى — الأب قبل الابن دائماً */
export const CHART_OF_ACCOUNTS_SEED: CoaSeedAccount[] = [

  // ══════════════════ 1. الأصول ══════════════════
  { code: '1',  name: 'الأصول', name_en: 'Assets', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 1 },

  { code: '11', name: 'الأصول المتداولة', name_en: 'Current Assets', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 2, parent_code: '1' },
  { code: '111', name: 'النقدية وما في حكمها', name_en: 'Cash & Cash Equivalents', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 3, parent_code: '11' },
  { code: '1111', name: 'الصناديق (صندوق المركز الرئيسي)', name_en: 'Cash Boxes', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '111' },
  { code: '1112', name: 'عهد المشاريع والمهندسين (عهدة مهندس موقع أ)', name_en: 'Site Engineers Custody', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '111' },
  { code: '1113', name: 'البنوك (حساب بنك ... الجاري)', name_en: 'Banks', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '111' },
  { code: '112', name: 'العملاء ومستخلصات تحت التحصيل', name_en: 'Customers & Retentions Receivable', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 3, parent_code: '11' },
  { code: '1121', name: 'حسابات العملاء (المالكين)', name_en: 'Customer Accounts (Owners)', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '112' },
  { code: '1122', name: 'مستخلصات معتمدة تحت التحصيل', name_en: 'Approved Certificates Under Collection', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '112' },
  { code: '113', name: 'المخزون', name_en: 'Inventory', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 3, parent_code: '11' },
  { code: '1131', name: 'مخزن المواد الرئيسي', name_en: 'Main Materials Warehouse', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '113' },
  { code: '1132', name: 'مخازن المواقع والمشاريع', name_en: 'Site & Project Warehouses', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '113' },
  { code: '114', name: 'أرصدة مدينة أخرى', name_en: 'Other Debit Balances', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 3, parent_code: '11' },
  { code: '1141', name: 'خطابات ضمان وابتدائية (تأمينات مناقصات)', name_en: 'Bid & Initial Guarantee Letters', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '114' },
  { code: '1142', name: 'سُلف ومستحقات عاملين', name_en: 'Employee Advances & Dues', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '114' },

  { code: '12', name: 'الأصول غير المتداولة (الثابتة)', name_en: 'Non-Current (Fixed) Assets', account_type: 'أصول', normal_balance: 'مدين', is_parent: true, level: 2, parent_code: '1' },
  { code: '121', name: 'الآلات والمعدات الثقيلة', name_en: 'Heavy Machinery & Equipment', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '12' },
  { code: '122', name: 'سيارات ووسائل نقل', name_en: 'Vehicles', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '12' },
  { code: '123', name: 'عُدد وأدوات موقع', name_en: 'Site Tools & Equipment', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '12' },
  { code: '124', name: 'أثاث وتجهيزات مكتبية', name_en: 'Office Furniture & Fixtures', account_type: 'أصول', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '12' },
  { code: '125', name: 'مجمع إهلاك الأصول الثابتة', name_en: 'Accumulated Depreciation', account_type: 'أصول', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '12' },

  // ══════════════════ 2. الالتزامات ══════════════════
  { code: '2',  name: 'الالتزامات', name_en: 'Liabilities', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 1 },

  { code: '21', name: 'الالتزامات المتداولة', name_en: 'Current Liabilities', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '2' },
  { code: '211', name: 'الموردون ومقاولو الباطن', name_en: 'Suppliers & Subcontractors', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 3, parent_code: '21' },
  { code: '2111', name: 'حسابات الموردين (موردي المواد)', name_en: 'Suppliers Accounts', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 4, parent_code: '211' },
  { code: '2112', name: 'حسابات مقاولي الباطن', name_en: 'Subcontractors Accounts', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 4, parent_code: '211' },
  { code: '212', name: 'محتجزات ضمان مقاولي الباطن', name_en: 'Subcontractors Retention', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '21' },
  { code: '213', name: 'دفعات مقدمة من العملاء', name_en: 'Advance Payments from Customers', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '21' },
  { code: '214', name: 'أرصدة دائنة أخرى', name_en: 'Other Credit Balances', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 3, parent_code: '21' },
  { code: '2141', name: 'مخصصات ومستحقات العاملين (رواتب، تذاكر، نهاية خدمة)', name_en: 'Employee Provisions & Dues', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 4, parent_code: '214' },
  { code: '2142', name: 'مصلحة الضرائب / الزكاة والدخل', name_en: 'Tax & Zakat Authority', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 4, parent_code: '214' },

  { code: '22', name: 'الالتزامات غير المتداولة', name_en: 'Non-Current Liabilities', account_type: 'خصوم', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '2' },
  { code: '221', name: 'قروض وتمويلات طويلة الأجل', name_en: 'Long-Term Loans & Financing', account_type: 'خصوم', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '22' },

  // ══════════════════ 3. حقوق الملكية ══════════════════
  { code: '3',  name: 'حقوق الملكية', name_en: 'Equity', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: true, level: 1 },
  { code: '31', name: 'رأس المال', name_en: 'Capital', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: false, level: 2, parent_code: '3' },
  { code: '32', name: 'الأرباح المبقاة (المحتجزة)', name_en: 'Retained Earnings', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: false, level: 2, parent_code: '3' },
  { code: '33', name: 'جار الشركاء', name_en: 'Partners Current Account', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: false, level: 2, parent_code: '3' },
  { code: '34', name: 'أرباح وخسائر العام الحالي', name_en: 'Current Year Profit & Loss', account_type: 'حقوق ملكية', normal_balance: 'دائن', is_parent: false, level: 2, parent_code: '3' },

  // ══════════════════ 4. الإيرادات ══════════════════
  { code: '4',  name: 'الإيرادات', name_en: 'Revenue', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: true, level: 1 },

  { code: '41', name: 'إيرادات النشاط الجاري (المشاريع)', name_en: 'Operating Revenue (Projects)', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '4' },
  { code: '411', name: 'إيرادات مستخلصات المشاريع', name_en: 'Project Certificates Revenue', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '41', cost_center_linked: true },

  { code: '42', name: 'إيرادات أخرى', name_en: 'Other Revenue', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: true, level: 2, parent_code: '4' },
  { code: '421', name: 'إيرادات تأجير معدات الشركة للغير', name_en: 'Equipment Rental Income', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '42' },
  { code: '422', name: 'إيرادات بيع مخلفات وصنايع موقع', name_en: 'Scrap & Site Waste Sale Income', account_type: 'إيرادات', normal_balance: 'دائن', is_parent: false, level: 3, parent_code: '42' },

  // ══════════════════ 5. المصروفات ══════════════════
  { code: '5',  name: 'المصروفات', name_en: 'Expenses', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 1 },

  // ── 51 تكاليف المشاريع المباشرة (تُربط بمراكز التكلفة) ──
  { code: '51', name: 'تكاليف المشاريع المباشرة', name_en: 'Direct Project Costs', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 2, parent_code: '5', cost_center_linked: true },

  { code: '511', name: 'تكلفة المواد والخامات المباشرة', name_en: 'Direct Materials Cost', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 3, parent_code: '51', cost_center_linked: true },
  { code: '5111', name: 'حديد تسليح', name_en: 'Reinforcement Steel', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '511', cost_center_linked: true },
  { code: '5112', name: 'خرسانة جاهزة', name_en: 'Ready-Mix Concrete', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '511', cost_center_linked: true },
  { code: '5113', name: 'طوب وبلوك', name_en: 'Bricks & Blocks', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '511', cost_center_linked: true },
  { code: '5114', name: 'مواد تشطيبات (سباكة، كهرباء، دهانات)', name_en: 'Finishing Materials', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '511', cost_center_linked: true },

  { code: '512', name: 'تكلفة أجور وعمالة مباشرة', name_en: 'Direct Labor Cost', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 3, parent_code: '51', cost_center_linked: true },
  { code: '5121', name: 'رواتب مهندسي ومشرفي المواقع', name_en: 'Site Engineers & Supervisors Salaries', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '512', cost_center_linked: true },
  { code: '5122', name: 'أجور عمالة يومية (يوميات)', name_en: 'Daily Labor Wages', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '512', cost_center_linked: true },
  { code: '5123', name: 'بدل سكن وإعاشة لعمال الموقع', name_en: 'Site Workers Housing & Subsistence', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '512', cost_center_linked: true },

  { code: '513', name: 'تكلفة مقاولي الباطن', name_en: 'Subcontractors Cost', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 3, parent_code: '51', cost_center_linked: true },
  { code: '5131', name: 'مقاولو أعمال الحفر والردم', name_en: 'Excavation & Backfill Subcontractors', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '513', cost_center_linked: true },
  { code: '5132', name: 'مقاولو أعمال العظم والخرسانات', name_en: 'Structural & Concrete Subcontractors', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '513', cost_center_linked: true },
  { code: '5133', name: 'مقاولو أعمال التشطيبات', name_en: 'Finishing Subcontractors', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '513', cost_center_linked: true },

  { code: '514', name: 'تكلفة تشغيل وإيجار المعدات', name_en: 'Equipment Operation & Rental Cost', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 3, parent_code: '51', cost_center_linked: true },
  { code: '5141', name: 'وقود وزيوت لمعدات الموقع', name_en: 'Fuel & Oil for Site Equipment', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '514', cost_center_linked: true },
  { code: '5142', name: 'صيانة وقطع غيار معدات المشروع', name_en: 'Equipment Maintenance & Spare Parts', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '514', cost_center_linked: true },
  { code: '5143', name: 'إيجار معدات خارجية (كرينات، لودر خارجي)', name_en: 'External Equipment Rental', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '514', cost_center_linked: true },

  { code: '515', name: 'مصاريف موقع غير مباشرة', name_en: 'Indirect Site Expenses', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 3, parent_code: '51', cost_center_linked: true },
  { code: '5151', name: 'رسوم تراخيص واختبارات تربة', name_en: 'Permits & Soil Testing Fees', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '515', cost_center_linked: true },
  { code: '5152', name: 'تأمين على المشروع', name_en: 'Project Insurance', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '515', cost_center_linked: true },
  { code: '5153', name: 'كهرباء ومياه ونظافة الموقع', name_en: 'Site Utilities & Cleaning', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 4, parent_code: '515', cost_center_linked: true },

  // ── 52 المصروفات العمومية والإدارية (لا تُربط بمشروع) ──
  { code: '52', name: 'المصروفات العمومية والإدارية', name_en: 'General & Administrative Expenses', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: true, level: 2, parent_code: '5' },
  { code: '521', name: 'رواتب وأجور الإدارة العامة (المحاسبة، HR، المديرين)', name_en: 'G&A Salaries', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '52' },
  { code: '522', name: 'إيجار مقر الشركة الرئيسي', name_en: 'Head Office Rent', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '52' },
  { code: '523', name: 'مصاريف كهرباء ومياه وإنترنت المركز الرئيسي', name_en: 'Head Office Utilities', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '52' },
  { code: '524', name: 'مصاريف التسويق والمناقصات (شراء كراسات الشروط)', name_en: 'Marketing & Tender Expenses', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '52' },
  { code: '525', name: 'مصاريف بنكية وعمولات خطابات الضمان', name_en: 'Bank Charges & Guarantee Commissions', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '52' },
  { code: '526', name: 'إهلاك الأصول الإدارية (الكمبيوترات، أثاث المكاتب)', name_en: 'Administrative Assets Depreciation', account_type: 'مصروفات', normal_balance: 'مدين', is_parent: false, level: 3, parent_code: '52' },
]
