'use client'
import { useEffect } from 'react'
import { useStore } from '@/hooks/useStore'

// ── تسجيل Service Worker ──
export function usePWA() {
  const { currentUser } = useStore()

  useEffect(() => {
    // تسجيل Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('SW registered:', reg.scope)
        })
        .catch((err) => {
          console.log('SW registration failed:', err)
        })
    }
  }, [])

  // حفظ بيانات المستخدم في cookie عند تغيير الـ session
  useEffect(() => {
    if (currentUser) {
      const userData = {
        id:          currentUser.id,
        name:        currentUser.name,
        role:        currentUser.role,
        permissions: currentUser.permissions || [],
      }
      // حفظ في cookie مشفر — يُقرأ من الـ Middleware
      document.cookie = `wathiq_user=${encodeURIComponent(JSON.stringify(userData))}; path=/; max-age=86400; SameSite=Strict`
    } else {
      // مسح الـ cookie عند تسجيل الخروج
      document.cookie = 'wathiq_user=; path=/; max-age=0'
    }
  }, [currentUser?.id])
}

// ── Hook لعرض زر "تثبيت التطبيق" ──
export function usePWAInstall() {
  useEffect(() => {
    let deferredPrompt: any = null

    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt = e

      // إظهار زر التثبيت
      const btn = document.getElementById('pwa-install-btn')
      if (btn) btn.style.display = 'flex'
    }

    window.addEventListener('beforeinstallprompt', handler)

    // زر التثبيت
    const installBtn = document.getElementById('pwa-install-btn')
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') {
          installBtn.style.display = 'none'
        }
        deferredPrompt = null
      })
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
}
