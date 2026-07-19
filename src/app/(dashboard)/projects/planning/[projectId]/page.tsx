'use client'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function ProjectPlanningIndex() {
  const router = useRouter()
  const params = useParams()
  useEffect(() => {
    router.replace(`/projects/planning/${params.projectId}/permit`)
  }, [router, params.projectId])
  return null
}
