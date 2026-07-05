// src/app/(dashboard)/finance/purchases/page.tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PurchasesIndexPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/finance/purchases/orders') }, [])
  return null
}
