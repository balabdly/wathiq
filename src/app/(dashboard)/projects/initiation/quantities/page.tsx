'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function InitiationQuantitiesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/projects/initiation/projects') }, [router])
  return null
}
