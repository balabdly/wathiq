import { useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'

export function usePWA() {
  const { currentUser, setCurrentUser } = useStore()

  // تسجيل Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
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
      document.cookie = `wathiq_user=${encodeURIComponent(JSON.stringify(userData))}; path=/; max-age=86400; SameSite=Strict`
    } else {
      document.cookie = 'wathiq_user=; path=/; max-age=0'
    }
  }, [currentUser?.id])

  // تحديث الصلاحيات تلقائياً كل دقيقة
  useEffect(() => {
    if (!currentUser?.id) return

    async function refreshPermissions() {
      const { data } = await supabase
        .from('employees')
        .select('permissions, role')
        .eq('id', currentUser!.id)
        .single()

      if (data && JSON.stringify(data.permissions) !== JSON.stringify(currentUser!.permissions)) {
        // الصلاحيات تغيّرت — حدّث الـ store
        setCurrentUser({ ...currentUser!, permissions: data.permissions, role: data.role })
      }
    }

    // تحديث فوري عند الدخول
    refreshPermissions()

    // تحديث كل 60 ثانية
    const interval = setInterval(refreshPermissions, 60000)
    return () => clearInterval(interval)
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
