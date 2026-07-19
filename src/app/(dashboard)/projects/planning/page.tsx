'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PlanningIndexPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/projects/planning/active') }, [router])
  return null
}
