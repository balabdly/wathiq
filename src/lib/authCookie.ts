import type { Employee } from '@/types'

/** مزامنة cookie الـ middleware مع بيانات المستخدم الحالية */
export function syncUserCookie(user: Pick<Employee, 'id' | 'name' | 'role' | 'permissions'> | null) {
  if (typeof document === 'undefined') return
  if (user) {
    const userData = {
      id: user.id,
      name: user.name,
      role: user.role,
      permissions: user.permissions || [],
    }
    document.cookie = `wathiq_user=${encodeURIComponent(JSON.stringify(userData))}; path=/; max-age=86400; SameSite=Strict`
  } else {
    document.cookie = 'wathiq_user=; path=/; max-age=0'
  }
}
