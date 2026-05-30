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

      <div className="wq-sidebar-desktop">
        <Sidebar />
      </div>

      <button className="wq-menu-btn" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99998,
          }}
        />
      )}

      {open && (
        <div style={{
          position: 'fixed', top: 0, right: 0,
          height: '100vh', width: '260px',
          zIndex: 99999,
          overflowY: 'auto',
        }}>
          <Sidebar />
        </div>
      )}

      <main className="wq-main">
        {children}
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
        .wq-sidebar-desktop {
          position: fixed; top: 0; right: 0;
          height: 100vh; width: 240px; z-index: 30;
        }
        .wq-menu-btn { display: none; }
        .wq-main {
          margin-right: 240px;
          flex: 1; min-height: 100vh;
          padding: 24px;
          width: calc(100% - 240px);
          box-sizing: border-box;
        }
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
            padding: 68px 16px 24px !important;
          }
        }
      `}</style>
    </div>
  )
}