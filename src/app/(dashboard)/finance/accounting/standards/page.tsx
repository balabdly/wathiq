// src/app/(dashboard)/finance/accounting/standards/page.tsx
'use client'
import { BookOpen } from 'lucide-react'

export default function StandardsGuidePage() {
  const cats = [
    {
      code: '1', title: 'الأصول', color: '#1a56db', bg: '#eff6ff',
      desc: 'جميع الموارد التي تمتلكها الشركة والتي تُتوقع منها منافع اقتصادية مستقبلية',
      items: [
        { code: '11', name: 'الأصول المتداولة',    desc: 'النقدية، العملاء، المخزون، المدفوعات المقدمة' },
        { code: '12', name: 'الأصول الثابتة',      desc: 'المباني، الآليات، المعدات، الأثاث' },
        { code: '13', name: 'الأصول غير الملموسة', desc: 'البرامج، براءات الاختراع، العلامات التجارية' },
      ]
    },
    {
      code: '2', title: 'الخصوم', color: '#c81e1e', bg: '#fef2f2',
      desc: 'الالتزامات المالية المستحقة على الشركة تجاه الغير',
      items: [
        { code: '21', name: 'الخصوم المتداولة',   desc: 'الموردون، المصاريف المستحقة، الديون قصيرة الأجل' },
        { code: '22', name: 'الخصوم طويلة الأجل', desc: 'القروض البنكية، الديون طويلة الأجل' },
      ]
    },
    {
      code: '3', title: 'حقوق الملكية', color: '#0ea77b', bg: '#ecfdf5',
      desc: 'حقوق المساهمين وصافي أصول الشركة بعد خصم الالتزامات',
      items: [
        { code: '31', name: 'رأس المال',          desc: 'رأس المال المدفوع، الاحتياطيات' },
        { code: '32', name: 'الأرباح المحتجزة',   desc: 'الأرباح المتراكمة من السنوات السابقة' },
      ]
    },
    {
      code: '4', title: 'الإيرادات', color: '#0ea77b', bg: '#ecfdf5',
      desc: 'الدخل المتحقق من الأنشطة التشغيلية وغير التشغيلية',
      items: [
        { code: '41', name: 'إيرادات المبيعات', desc: 'مبيعات الخدمات والمنتجات' },
        { code: '42', name: 'إيرادات أخرى',    desc: 'إيرادات الفوائد، الإيجار، العمولات' },
      ]
    },
    {
      code: '5', title: 'المصروفات', color: '#6b7280', bg: '#f3f4f6',
      desc: 'التكاليف المتكبدة لتحقيق الإيرادات',
      items: [
        { code: '51', name: 'تكلفة المبيعات',        desc: 'المواد المباشرة، العمالة المباشرة' },
        { code: '55', name: 'مصروفات البيع والتسويق', desc: 'الإعلان، العمولات، التوزيع' },
        { code: '56', name: 'مصروفات إدارية',         desc: 'الرواتب الإدارية، الإيجار، المصاريف العمومية' },
      ]
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BookOpen style={{ width: '20px', height: '20px', color: '#7c3aed' }} />
        <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a2e' }}>دليل معايير شجرة الحسابات</h2>
        <span className="badge badge-gray" style={{ background: '#f3e8ff', color: '#7c3aed' }}>IFRS / IAS</span>
      </div>
      {cats.map(cat => (
        <div key={cat.code} className="card" style={{ padding: '16px', border: `1px solid ${cat.color}30` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
              {cat.code}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: cat.color }}>{cat.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{cat.desc}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {cat.items.map(item => (
              <div key={item.code} style={{ background: cat.bg, borderRadius: '8px', padding: '8px 14px', border: `1px solid ${cat.color}20` }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: cat.color, fontSize: '0.82rem' }}>{cat.code}{item.code}</div>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', marginTop: '2px' }}>{item.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
