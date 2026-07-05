// src/app/(dashboard)/finance/expenses/page.tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ExpensesIndexPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/finance/expenses/list') }, [])
  return null
}
