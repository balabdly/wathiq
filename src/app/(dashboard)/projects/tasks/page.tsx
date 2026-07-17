'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** إعادة توجيه — المهام أصبحت تاباً داخل إدارة الفرق */
export default function ProjectTasksPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/projects/teams?tab=tasks')
  }, [router])
  return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
      جاري التوجيه إلى مهام الفريق...
    </div>
  )
}
