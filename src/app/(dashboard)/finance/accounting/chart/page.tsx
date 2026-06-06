export default function ChartOfAccountsPage() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      <div className="card" style={{ padding: '32px' }}>

        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          📋 معايير شجرة الحسابات
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.85rem', marginBottom: '32px' }}>
          دليل الحسابات المحاسبية الموحدة للشركة وفق المعايير المهنية
        </p>

        {/* الفئات الرئيسية */}
        {[
          {
            code: '1', title: 'الأصول', color: '#1a56db', bg: '#eff6ff',
            desc: 'جميع الموارد التي تمتلكها الشركة والتي تُتوقع منها منافع اقتصادية مستقبلية',
            items: [
              { code: '11', name: 'الأصول المتداولة', desc: 'النقدية، العملاء، المخزون، المدفوعات المقدمة' },
              { code: '12', name: 'الأصول الثابتة', desc: 'المباني، الآليات، المعدات، الأثاث' },
              { code: '13', name: 'الأصول غير الملموسة', desc: 'البرامج، براءات الاختراع، العلامات التجارية' },
            ]
          },
          {
            code: '2', title: 'الخصوم', color: '#c81e1e', bg: '#fef2f2',
            desc: 'الالتزامات المالية المستحقة على الشركة تجاه الغير',
            items: [
              { code: '21', name: 'الخصوم المتداولة', desc: 'الموردون، المصاريف المستحقة، الديون قصيرة الأجل' },
              { code: '22', name: 'الخصوم طويلة الأجل', desc: 'القروض البنكية، الديون طويلة الأجل' },
            ]
          },
          {
            code: '3', title: 'حقوق الملكية', color: '#0ea77b', bg: '#ecfdf5',
            desc: 'حقوق المساهمين وصافي أصول الشركة بعد خصم الالتزامات',
            items: [
              { code: '31', name: 'رأس المال', desc: 'رأس المال المدفوع والاحتياطيات' },
              { code: '32', name: 'الأرباح المبقاة', desc: 'الأرباح غير الموزعة من السنوات السابقة' },
            ]
          },
          {
            code: '4', title: 'الإيرادات', color: '#0891b2', bg: '#f0f9ff',
            desc: 'الدخل الناتج عن الأنشطة التشغيلية وغير التشغيلية للشركة',
            items: [
              { code: '41', name: 'إيرادات العقود', desc: 'الإيرادات من عقود المشاريع والخدمات' },
              { code: '42', name: 'إيرادات أخرى', desc: 'الفوائد، الأرباح، الإيرادات المتنوعة' },
            ]
          },
          {
            code: '5', title: 'تكلفة الإيرادات', color: '#e6820a', bg: '#fffbeb',
            desc: 'التكاليف المباشرة المرتبطة بتنفيذ المشاريع وتقديم الخدمات',
            items: [
              { code: '51', name: 'تكلفة العمالة', desc: 'رواتب ومستحقات العمالة المباشرة' },
              { code: '52', name: 'تكلفة المواد', desc: 'مواد البناء والتشغيل المستخدمة في المشاريع' },
              { code: '53', name: 'تكلفة المقاولين', desc: 'مدفوعات المقاولين من الباطن' },
            ]
          },
          {
            code: '6', title: 'المصروفات', color: '#6b7280', bg: '#f9fafb',
            desc: 'التكاليف الإدارية والتشغيلية غير المرتبطة مباشرة بالمشاريع',
            items: [
              { code: '61', name: 'المصروفات الإدارية', desc: 'الرواتب الإدارية، الإيجارات، المرافق' },
              { code: '62', name: 'مصروفات التسويق', desc: 'الإعلانات، العلاقات العامة' },
              { code: '63', name: 'المصروفات المالية', desc: 'الفوائد، رسوم البنوك' },
            ]
          },
        ].map(cat => (
          <div key={cat.code} style={{ marginBottom: '24px', border: `1px solid ${cat.color}30`, borderRadius: '12px', overflow: 'hidden' }}>
            {/* رأس الفئة */}
            <div style={{ background: cat.bg, padding: '14px 18px', borderBottom: `1px solid ${cat.color}20`, display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.1rem', flexShrink: 0 }}>
                {cat.code}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: cat.color }}>{cat.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text3)', marginTop: '2px' }}>{cat.desc}</div>
              </div>
            </div>
            {/* الحسابات الفرعية */}
            <div>
              {cat.items.map((item, i) => (
                <div key={item.code} style={{
                  display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 18px',
                  borderBottom: i < cat.items.length - 1 ? '1px solid var(--bg2)' : 'none',
                  background: 'white'
                }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: cat.color, background: cat.bg, padding: '3px 10px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                    {item.code}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '2px' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ملاحظة */}
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '14px 16px', fontSize: '0.82rem', color: '#92400e', lineHeight: 1.7 }}>
          <strong>ملاحظة:</strong> هذا الدليل يوضح الهيكل العام لشجرة الحسابات. لإضافة حسابات تفصيلية أو تعديل الشجرة، استخدم تاب <strong>شجرة الحسابات</strong> في صفحة الحسابات العامة.
        </div>

      </div>
    </div>
  )
}
