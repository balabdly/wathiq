// src/app/(dashboard)/finance/accounting/page.tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AccountingIndexPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/finance/accounting/chart') }, [])
  return null
}
