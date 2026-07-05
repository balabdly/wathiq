// src/app/(dashboard)/finance/treasury/page.tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TreasuryIndexPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/finance/treasury/accounts') }, [])
  return null
}
