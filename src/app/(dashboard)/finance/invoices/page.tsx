// src/app/(dashboard)/finance/invoices/page.tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SalesIndexPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/finance/invoices/list') }, [])
  return null
}
