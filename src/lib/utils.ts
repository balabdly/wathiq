import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date?: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

export function formatNumber(n?: number | null) {
  if (n == null) return '0'
  return n.toLocaleString('ar-EG')
}

export function formatCurrency(n?: number | null) {
  if (n == null) return '0 ر.س'
  return `${n.toLocaleString('ar-EG')} ر.س`
}

export function daysUntil(date?: string | null): number | null {
  if (!date) return null
  const now = new Date(); now.setHours(0,0,0,0)
  const d = new Date(date); d.setHours(0,0,0,0)
  return Math.round((d.getTime() - now.getTime()) / 86400000)
}

export function isOverdue(date?: string | null): boolean {
  const days = daysUntil(date)
  return days !== null && days < 0
}

export const PROJECT_STAGES = [
  { id:'s1', name:'استلام المشروع',     icon:'📋', pct:5,  requiresAttach:false },
  { id:'s2', name:'كشف مبدئي',         icon:'🔍', pct:15, requiresAttach:false },
  { id:'s3', name:'استلام المواد',      icon:'📦', pct:25, requiresAttach:false },
  { id:'s4', name:'إصدار تصريح بلدية', icon:'📄', pct:35, requiresAttach:true  },
  { id:'s5', name:'التنفيذ',            icon:'⚡', pct:60, requiresAttach:false },
  { id:'s6', name:'الاختبارات',         icon:'🧪', pct:75, requiresAttach:true  },
  { id:'s7', name:'التشغيل',            icon:'✅', pct:85, requiresAttach:false },
  { id:'s8', name:'المستخلصات',         icon:'💰', pct:92, requiresAttach:true  },
  { id:'s9', name:'الإغلاق',            icon:'🏁', pct:100,requiresAttach:true  },
]

export const ROLES_PERMISSIONS: Record<string, string[]> = {
  'مدير عام':      ['dashboard','projects_view','projects_edit','visits_quality','visits_safety','visits_electrical','visits_field','inventory','purchases','employees','reports','qhse'],
  'مدير مشروع':    ['dashboard','projects_view','projects_edit','visits_quality','visits_safety','visits_electrical','visits_field','inventory','purchases','reports','qhse'],
  'مهندس جودة':    ['dashboard','projects_view','visits_quality','reports','qhse'],
  'مهندس سلامة':   ['dashboard','projects_view','visits_safety','reports','qhse'],
  'مشرف كهربائي': ['dashboard','projects_view','visits_electrical','reports'],
  'مهندس مدني':    ['dashboard','projects_view','visits_field','reports'],
  'أمين مستودع':   ['dashboard','projects_view','inventory','reports'],
}
