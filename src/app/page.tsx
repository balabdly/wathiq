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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a56db' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}
