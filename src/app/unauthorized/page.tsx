'use client'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShieldOff, ArrowRight, UserCog } from 'lucide-react'

const REASONS: Record<string, { title: string; body: string; action?: { label: string; href: string } }> = {
  no_permission: {
    title: 'غير مصرح بالوصول',
    body: 'ليس لديك صلاحية "الخدمة الذاتية" (hr_self). تواصل مع مدير النظام لإضافتها من: الإعدادات → المستخدمون والصلاحيات.',
    action: { label: 'إعدادات الصلاحيات', href: '/settings/employees' },
  },
  no_hr_profile: {
    title: 'ملف HR غير مربوط',
    body: 'صلاحية الخدمة الذاتية موجودة، لكن حسابك غير مربوط بملف موظف في الموارد البشرية. يجب ربطك بسجل hr_employees قبل عرض الحضور والإجازات والرواتب.',
    action: { label: 'ربط الملف من الإعدادات', href: '/settings/employees' },
  },
}

function UnauthorizedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason') || ''
  const info = REASONS[reason] || {
    title: 'غير مصرح بالوصول',
    body: 'ليس لديك صلاحية للوصول لهذه الصفحة. تواصل مع مدير النظام لطلب الصلاحيات المناسبة.',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #fef2f2 0%, #fff 60%)',
      fontFamily: 'var(--font-arabic, system-ui)', direction: 'rtl',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '480px', padding: '40px' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: '#fef2f2', border: '2px solid #fca5a5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          {reason === 'no_hr_profile'
            ? <UserCog style={{ width: '36px', height: '36px', color: '#c81e1e' }} />
            : <ShieldOff style={{ width: '36px', height: '36px', color: '#c81e1e' }} />}
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a2e', marginBottom: '8px' }}>
          {info.title}
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '32px' }}>
          {info.body}
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.back()}
            style={{
              padding: '10px 24px', borderRadius: '10px', border: '1px solid #e5e7eb',
              background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
              color: '#374151', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
            <ArrowRight style={{ width: '16px', height: '16px' }} />
            الرجوع
          </button>
          {info.action && (
            <button onClick={() => router.push(info.action!.href)}
              style={{
                padding: '10px 24px', borderRadius: '10px', border: 'none',
                background: '#0ea77b', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
                color: 'white',
              }}>
              {info.action.label}
            </button>
          )}
          <button onClick={() => router.push('/dashboard')}
            style={{
              padding: '10px 24px', borderRadius: '10px', border: 'none',
              background: '#1a56db', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
              color: 'white',
            }}>
            الصفحة الرئيسية
          </button>
        </div>
      </div>
    </div>
  )
}

function UnauthorizedFallback() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #fef2f2 0%, #fff 60%)',
      fontFamily: 'var(--font-arabic, system-ui)', direction: 'rtl',
    }}>
      <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>جاري التحميل...</div>
    </div>
  )
}

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={<UnauthorizedFallback />}>
      <UnauthorizedContent />
    </Suspense>
  )
}
