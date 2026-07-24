'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** مرحلة المقايسة دُمجت في التخطيط — إعادة توجيه للإغلاق */
export default function MeasureRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/projects/close')
  }, [router])
  return null
}
