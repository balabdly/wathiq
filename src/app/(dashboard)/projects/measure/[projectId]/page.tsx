'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MeasureProjectRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/projects/close')
  }, [router])
  return null
}
