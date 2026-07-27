'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

/** مسودة الكميات أُلغيت — المقايسة في مرحلة التخطيط */
export default function InitiationProjectQuantitiesRedirect() {
  const router = useRouter()
  const params = useParams()
  useEffect(() => {
    router.replace('/projects/initiation/projects')
  }, [router, params.projectId])
  return null
}
