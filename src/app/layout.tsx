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
