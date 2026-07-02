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

  // مزامنة جلسة المستخدم إلى cookie موقعة (HttpOnly) عبر API
  useEffect(() => {
    async function syncAuthCookie() {
      if (currentUser) {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentUser.id,
            role: currentUser.role,
            permissions: currentUser.permissions || [],
          }),
        })
      } else {
        await fetch('/api/auth/logout', { method: 'POST' })
      }
    }
    syncAuthCookie().catch(() => {})
  }, [currentUser?.id, currentUser?.permissions, currentUser?.role])

  // ── جلب permissions من DB فوراً عند كل تحميل صفحة ──
  useEffect(() => {
    if (!currentUser?.id) return

    async function syncPermissions() {
      const { data } = await supabase
        .from('employees')
        .select('permissions, role')
        .eq('id', currentUser!.id)
        .single()

      if (!data) return

      // تحديث دائماً من DB — permissions لا تُقرأ من localStorage
      setCurrentUser({
        ...currentUser!,
        permissions: data.permissions || [],
        role: data.role,
      })
    }

    syncPermissions()

    // Realtime للتحديث الفوري عند تغيير الصلاحيات
    const channel = supabase
      .channel(`perms_${currentUser.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'employees',
        filter: `id=eq.${currentUser.id}`,
      }, (payload) => {
        const updated = payload.new as any
        setCurrentUser({
          ...currentUser!,
          permissions: updated.permissions || [],
          role: updated.role || currentUser!.role,
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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
