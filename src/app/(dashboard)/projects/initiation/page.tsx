'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function InitiationIndexPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/projects/initiation/projects') }, [router])
  return null
}
