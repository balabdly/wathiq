import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'وثيق — نظام إدارة مقاولي الكهرباء',
  description: 'نظام إدارة متكامل لمقاولي شركة الكهرباء السعودية',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1a56db" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="وثيق" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: { fontFamily: 'IBM Plex Sans Arabic, sans-serif', direction: 'rtl', borderRadius: '10px', padding: '12px 16px' },
            success: { iconTheme: { primary: '#0ea77b', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#c81e1e', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
