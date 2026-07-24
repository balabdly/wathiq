'use client'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function MaterialsRedirectPage() {
  const router = useRouter()
  const params = useParams()
  useEffect(() => {
    router.replace(`/projects/planning/${params.projectId}/boq`)
  }, [router, params.projectId])
  return null
}
