'use client'

import { useRouter } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { REPORT_SECTIONS, REPORT_COUNTS } from '@/lib/reports-config'

const AVAILABLE_TOTAL =
  REPORT_COUNTS.finance +
  REPORT_COUNTS.hr +
  REPORT_COUNTS.projects +
  REPORT_COUNTS.inventory +
  REPORT_COUNTS.visits

export default function ReportsPage() {
  const router = useRouter()

  return (
    <div className="space-y-6 fade-in">

      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary-500" />
          التقارير
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {AVAILABLE_TOTAL} تقرير جاهز · {REPORT_COUNTS.qhse} قيد التطوير (QHSE)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_SECTIONS.map(section => {
          const Icon = section.icon
          return (
            <button
              key={section.id}
              onClick={() => router.push(section.href)}
              className="text-right w-full"
              style={{ outline: 'none' }}
            >
              <div
                className="rounded-2xl p-5 border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                style={{
                  background: section.bg,
                  borderColor: section.border,
                  opacity: section.comingSoon ? 0.92 : 1,
                }}
              >
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
                      background: section.comingSoon ? '#f3f4f6' : section.color + '15',
                      color: section.comingSoon ? '#6b7280' : section.color,
                    }}
                  >
                    {section.comingSoon ? `${section.count} قريباً` : `${section.count} تقرير`}
                  </span>
                </div>

                <h3
                  className="font-bold text-base mb-1"
                  style={{ color: section.color }}
                >
                  {section.label}
                </h3>

                <p className="text-xs text-gray-500 leading-relaxed">
                  {section.description}
                </p>

                <div className="mt-3 flex items-center gap-1" style={{ color: section.color }}>
                  <span className="text-xs font-medium">
                    {section.comingSoon ? 'عرض الخطة' : 'عرض التقارير'}
                  </span>
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
