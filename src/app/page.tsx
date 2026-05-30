'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'

export default function Home() {
  const router = useRouter()
  const { currentUser } = useStore()

  useEffect(() => {
    router.replace(currentUser ? '/dashboard' : '/login')
  }, [currentUser, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-600">
      <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  )
}
