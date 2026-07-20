'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PlanningActiveRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/projects/planning') }, [router])
  return null
}
