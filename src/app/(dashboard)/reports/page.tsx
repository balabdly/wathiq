'use client'

import { useRouter } from 'next/navigation'
import {
  BarChart3, DollarSign, Users, FolderOpen,
  Package, ShoppingCart, Shield, ClipboardCheck
} from 'lucide-react'

const REPORT_SECTIONS = [
  {
    id: 'finance',
    label: 'المالية والمحاسبة',
    description: 'الحسابات العامة، القيود، المصروفات، سندات القبض، الفواتير، الخزينة',
    icon: DollarSign,
    color: '#1a56db',
    bg: '#eff6ff',
    border: '#bfdbfe',
    count: 35,
  },
  {
    id: 'hr',
    label: 'الموارد البشرية',
    description: 'الموظفين، الرواتب، الإجازات، الحضور، نهايات الخدمة',
    icon: Users,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    count: 5,
  },
  {
    id: 'projects',
    label: 'المشاريع',
    description: 'قائمة المشاريع، المتأخرة، ملخص الحالة، التكاليف، أداء المهندسين',
    icon: FolderOpen,
    color: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc',
    count: 5,
  },
  {
    id: 'inventory',
    label: 'المخزون',
    description: 'قائمة المواد، تحت حد الأمان، حركة المخزون، عهدة المشاريع',
    icon: Package,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    count: 4,
  },
  {
    id: 'purchases',
    label: 'المشتريات',
    description: 'طلبات الشراء، فواتير الموردين، المرتجعات، أداء الموردين',
    icon: ShoppingCart,
    color: '#059669',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    count: 4,
  },
  {
    id: 'qhse',
    label: 'السلامة والجودة',
    description: 'التدقيق، الشهادات، الحوادث، NCR المعلقة',
    icon: Shield,
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    count: 4,
  },
  {
    id: 'visits',
    label: 'الزيارات الميدانية',
    description: 'قائمة الزيارات، NCR المعلقة، أداء المهندسين، ملخص حسب النوع',
    icon: ClipboardCheck,
    color: '#0f766e',
    bg: '#f0fdfa',
    border: '#99f6e4',
    count: 4,
  },
]

export default function ReportsPage() {
  const router = useRouter()

  return (
    <div className="space-y-6 fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary-500" />
          التقارير
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          اختر القسم لعرض تقاريره التفصيلية
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_SECTIONS.map(section => {
          const Icon = section.icon
          return (
            <button
              key={section.id}
              onClick={() => router.push(`/reports/${section.id}`)}
              className="text-right w-full"
              style={{ outline: 'none' }}
            >
              <div
                className="rounded-2xl p-5 border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                style={{
                  background: section.bg,
                  borderColor: section.border,
                }}
              >
                {/* Icon + Count */}
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: section.color + '18' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: section.color }} />
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      background: section.color + '15',
                      color: section.color,
                    }}
                  >
                    {section.count} تقرير
                  </span>
                </div>

                {/* Label */}
                <h3
                  className="font-bold text-base mb-1"
                  style={{ color: section.color }}
                >
                  {section.label}
                </h3>

                {/* Description */}
                <p className="text-xs text-gray-500 leading-relaxed">
                  {section.description}
                </p>

                {/* Arrow */}
                <div className="mt-3 flex items-center gap-1" style={{ color: section.color }}>
                  <span className="text-xs font-medium">عرض التقارير</span>
                  <span className="text-sm">←</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
