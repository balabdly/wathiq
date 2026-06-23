import { useStore, DisplayView, DisplayPrefs } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'

export function useDisplayPref(key: keyof DisplayPrefs) {
  const { displayPrefs, updateDisplayPref, currentUser } = useStore()
  const view = displayPrefs[key] || 'list'

  async function setView(value: DisplayView) {
    // تحديث الـ store فوراً
    updateDisplayPref(key, value)
    // حفظ في قاعدة البيانات
    if (currentUser?.id) {
      await supabase.from('employees').update({
        display_preferences: { ...displayPrefs, [key]: value }
      }).eq('id', currentUser.id)
    }
  }

  return { view, setView }
}
