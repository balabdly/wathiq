'use client'
import { WifiOff, RefreshCw } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: 'var(--font-arabic, system-ui)', direction: 'rtl',
    }}>
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: '#f1f5f9', margin: '0 auto 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <WifiOff style={{ width: '36px', height: '36px', color: '#94a3b8' }} />
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1a2e', marginBottom: '8px' }}>
          لا يوجد اتصال بالإنترنت
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '28px', fontSize: '0.875rem' }}>
          تحقق من الاتصال وأعد المحاولة
        </p>
        <button onClick={() => window.location.reload()}
          style={{
            padding: '10px 28px', borderRadius: '10px', border: 'none',
            background: '#1a56db', color: 'white', cursor: 'pointer',
            fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px',
          }}>
          <RefreshCw style={{ width: '16px', height: '16px' }} />
          إعادة المحاولة
        </button>
      </div>
    </div>
  )
}
