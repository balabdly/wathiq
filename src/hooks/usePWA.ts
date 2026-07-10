import { useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { syncUserCookie } from '@/lib/authCookie'

export function usePWA() {
  useAuthSyncInternal()

  // تسجيل Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
}

export function useAuthSync() {
  useAuthSyncInternal()
}

function useAuthSyncInternal() {
  const { currentUser, setCurrentUser } = useStore()

  useEffect(() => {
    syncUserCookie(currentUser)
  }, [currentUser?.id, currentUser?.role, currentUser?.permissions])

  useEffect(() => {
    if (!currentUser?.id) return

    async function syncFromDb() {
      const { data } = await supabase
        .from('employees')
        .select('permissions, role, hr_employee_id')
        .eq('id', currentUser!.id)
        .single()

      if (!data) return

      setCurrentUser({
        ...currentUser!,
        permissions: data.permissions || [],
        role: data.role,
        hr_employee_id: data.hr_employee_id ?? undefined,
      } as typeof currentUser)
    }

    syncFromDb()

    const channel = supabase
      .channel(`auth_sync_${currentUser.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'employees',
        filter: `id=eq.${currentUser.id}`,
      }, (payload) => {
        const updated = payload.new as {
          permissions?: string[]
          role?: string
          hr_employee_id?: number | null
        }
        setCurrentUser({
          ...currentUser!,
          permissions: updated.permissions || [],
          role: updated.role || currentUser!.role,
          hr_employee_id: updated.hr_employee_id ?? undefined,
        } as typeof currentUser)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUser?.id, setCurrentUser])
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
