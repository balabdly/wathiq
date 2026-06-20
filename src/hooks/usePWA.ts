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

  // حفظ بيانات المستخدم في cookie
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

  // ── Realtime: تحديث permissions فوراً عند تغييرها ──
  useEffect(() => {
    if (!currentUser?.id) return

    // تحديث فوري عند التحميل
    async function fetchPerms() {
      const { data } = await supabase
        .from('employees')
        .select('permissions, role, name')
        .eq('id', currentUser!.id)
        .single()
      if (!data) return
      // تحديث لو تغيّرت
      if (
        JSON.stringify(data.permissions) !== JSON.stringify(currentUser!.permissions) ||
        data.role !== currentUser!.role
      ) {
        setCurrentUser({ ...currentUser!, permissions: data.permissions || [], role: data.role })
      }
    }
    fetchPerms()

    // Realtime subscription — يستمع لأي تغيير على هذا الموظف
    const channel = supabase
      .channel(`employee_perms_${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'employees',
          filter: `id=eq.${currentUser.id}`,
        },
        (payload) => {
          const updated = payload.new as any
          if (updated.permissions || updated.role) {
            setCurrentUser({
              ...currentUser!,
              permissions: updated.permissions || [],
              role:        updated.role || currentUser!.role,
            })
          }
        }
      )
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
