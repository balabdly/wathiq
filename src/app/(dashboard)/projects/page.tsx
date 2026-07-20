'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** إعادة توجيه — لوحة المتابعة على /projects/monitoring */
export default function ProjectsRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/projects/monitoring') }, [router])
  return null
}
