'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** إعادة توجيه — حمولة الفرق أصبحت تاباً داخل إدارة الفرق */
export default function TeamWorkloadReportPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/projects/teams?tab=workload')
  }, [router])
  return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
      جاري التوجيه إلى إدارة الفرق...
    </div>
  )
}
