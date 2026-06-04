'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import Sidebar from '@/components/layout/Sidebar'
import { Toaster } from 'react-hot-toast'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { currentUser } = useStore()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!currentUser) router.push('/login')
  }, [currentUser, router])

  useEffect(() => { setOpen(false) }, [pathname])

  if (!currentUser) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Desktop Sidebar */}
      <div className="wq-sidebar-desktop">
        <Sidebar />
      </div>

      {/* Mobile: زر الفتح */}
      <button className="wq-menu-btn" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Mobile: Overlay */}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 99998,
        }} />
      )}

      {/* Mobile: Drawer */}
      {open && (
        <div style={{
          position: 'fixed', top: 0, right: 0,
          height: '100vh', width: '260px',
          zIndex: 99999, overflowY: 'auto',
          background: 'white',
        }}>
          <Sidebar />
        </div>
      )}

      {/* المحتوى الرئيسي */}
      <main className="wq-main">
        <div className="wq-content">
          {children}
        </div>
      </main>

      <Toaster
        position="top-center"
        containerStyle={{ pointerEvents: 'none' }}
        toastOptions={{
          style: {
            fontFamily: 'IBM Plex Sans Arabic, sans-serif',
            direction: 'rtl',
            borderRadius: '10px',
            padding: '12px 16px',
            pointerEvents: 'auto',
          },
          success: { iconTheme: { primary: '#0ea77b', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#c81e1e', secondary: '#fff' } },
        }}
      />

      <style>{`
        /* ══ متغير عرض السايدبار — غيّره من مكان واحد ══ */
        :root {
          --sidebar-width: 260px;
        }

        /* ══ السايدبار ══ */
        .wq-sidebar-desktop {
          position: fixed;
          top: 0; right: 0;
          height: 100vh;
          width: var(--sidebar-width);
          z-index: 30;
          overflow-y: auto;
        }

        /* ══ زر الموبايل ══ */
        .wq-menu-btn { display: none; }

        /* ══ المنطقة الرئيسية ══ */
        .wq-main {
          margin-right: var(--sidebar-width);
          flex: 1;
          min-height: 100vh;
          width: calc(100% - var(--sidebar-width));
          box-sizing: border-box;
          background: var(--bg);
          /* يمنع تمدد المحتوى على شاشات 4K */
          display: flex;
          justify-content: center;
        }

        /* ══ المحتوى الداخلي — محدود العرض على الشاشات الكبيرة ══ */
        .wq-content {
          width: 100%;
          max-width: 1400px;
          padding: 28px 32px;
          box-sizing: border-box;
        }

        /* ══ شاشات متوسطة 768px - 1280px ══ */
        @media (min-width: 769px) and (max-width: 1280px) {
          :root { --sidebar-width: 240px; }
          .wq-content { padding: 24px; }
        }

        /* ══ شاشات كبيرة 1280px - 1600px ══ */
        @media (min-width: 1281px) and (max-width: 1600px) {
          :root { --sidebar-width: 260px; }
          .wq-content { padding: 28px 36px; }
        }

        /* ══ شاشات كبيرة جداً 1600px+ ══ */
        @media (min-width: 1601px) {
          :root { --sidebar-width: 280px; }
          .wq-content {
            padding: 32px 40px;
            max-width: 1600px;
          }
        }

        /* ══ موبايل ══ */
        @media (max-width: 768px) {
          .wq-sidebar-desktop { display: none !important; }

          .wq-menu-btn {
            display: flex !important;
            position: fixed; top: 12px; right: 12px;
            z-index: 100000;
            width: 44px; height: 44px;
            background: #1a56db; color: white;
            border: none; border-radius: 10px;
            align-items: center; justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(26,86,219,0.3);
          }

          .wq-main {
            margin-right: 0 !important;
            width: 100% !important;
          }

          .wq-content {
            padding: 68px 16px 24px !important;
            max-width: 100% !important;
          }

          .sidebar {
            position: relative !important;
            width: 100% !important;
            min-height: 100vh;
          }
        }
      `}</style>
    </div>
  )
}
