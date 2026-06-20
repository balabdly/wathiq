'use client'
import { useRouter } from 'next/navigation'
import { ShieldOff, ArrowRight } from 'lucide-react'

export default function UnauthorizedPage() {
  const router = useRouter()

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #fef2f2 0%, #fff 60%)',
      fontFamily: 'var(--font-arabic, system-ui)', direction: 'rtl',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '420px', padding: '40px' }}>
        {/* أيقونة */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: '#fef2f2', border: '2px solid #fca5a5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <ShieldOff style={{ width: '36px', height: '36px', color: '#c81e1e' }} />
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a2e', marginBottom: '8px' }}>
          غير مصرح بالوصول
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '32px' }}>
          ليس لديك صلاحية للوصول لهذه الصفحة.
          تواصل مع مدير النظام لطلب الصلاحيات المناسبة.
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
