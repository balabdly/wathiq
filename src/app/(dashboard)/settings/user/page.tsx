'use client'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { User, Monitor } from 'lucide-react'
import toast from 'react-hot-toast'
import type { DisplayView } from '@/hooks/useStore'

const VIEW_OPTIONS: { value: DisplayView; label: string; icon: string; desc: string }[] = [
  { value: 'list',   label: 'قائمة',  icon: '☰', desc: 'عرض مدمج وسريع' },
  { value: 'cards',  label: 'بطاقات', icon: '⊞', desc: 'عرض بصري أوضح' },
  { value: 'kanban', label: 'كانبان', icon: '⊟', desc: 'عرض حسب الحالة' },
]

const SECTIONS = [
  { key: 'projects',  label: 'المشاريع',  icon: '🏗️', options: ['kanban', 'cards', 'list'] as DisplayView[] },
  { key: 'visits',    label: 'الزيارات',  icon: '🔍', options: ['list', 'cards'] as DisplayView[] },
  { key: 'tasks',     label: 'المهام',    icon: '✅', options: ['list', 'cards', 'kanban'] as DisplayView[] },
  { key: 'employees', label: 'الموظفون', icon: '👥', options: ['list', 'cards'] as DisplayView[] },
  { key: 'materials', label: 'المواد',    icon: '📦', options: ['list', 'cards'] as DisplayView[] },
]

export default function UserSettingsPage() {
  const { currentUser, displayPrefs, updateDisplayPref } = useStore()

  async function saveDisplayPref(key: string, value: DisplayView) {
    updateDisplayPref(key as any, value)
    if (currentUser?.id) {
      const newPrefs = { ...displayPrefs, [key]: value }
      const { error } = await supabase.from('employees')
        .update({ display_preferences: newPrefs })
        .eq('id', currentUser.id)
      if (error) toast.error('خطأ في الحفظ')
      else toast.success('✅ تم حفظ التفضيل')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '720px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
          إعدادات المستخدم
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '3px' }}>
          تخصيص تجربة العرض الخاصة بك — تُحفظ على حسابك وتنطبق على كل أجهزتك
        </p>
      </div>

      {/* معلومات المستخدم */}
      <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
          👤
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a2e' }}>{currentUser?.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '3px' }}>{currentUser?.role}</div>
        </div>
      </div>

      {/* تفضيلات العرض */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Monitor style={{ width: '17px', height: '17px', color: 'var(--primary)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>تفضيلات العرض</span>
        </div>

        <div style={{ padding: '8px 0' }}>
          {SECTIONS.map((section, i) => {
            const current = displayPrefs[section.key as keyof typeof displayPrefs] || 'list'
            return (
              <div key={section.key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 20px',
                borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--bg2)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>{section.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)' }}>{section.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: '2px' }}>
                      الحالي: {current === 'list' ? 'قائمة' : current === 'cards' ? 'بطاقات' : 'كانبان'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {section.options.map(opt => {
                    const o = VIEW_OPTIONS.find(v => v.value === opt)!
                    const isActive = current === opt
                    return (
                      <button key={opt} onClick={() => saveDisplayPref(section.key, opt)}
                        title={o.desc}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '7px 12px', borderRadius: '8px', border: '1.5px solid',
                          cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                          fontFamily: 'inherit', transition: 'all 0.15s',
                          borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                          background:  isActive ? '#eff6ff' : 'white',
                          color:       isActive ? 'var(--primary)' : 'var(--text3)',
                          boxShadow:   isActive ? '0 0 0 3px rgba(26,86,219,0.1)' : 'none',
                        }}>
                        <span>{o.icon}</span>
                        <span>{o.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid var(--bg2)', fontSize: '0.72rem', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>💡</span>
          <span>يمكنك أيضاً تغيير طريقة العرض مباشرة من داخل كل صفحة — وستُحفظ تلقائياً</span>
        </div>
      </div>

    </div>
  )
}
