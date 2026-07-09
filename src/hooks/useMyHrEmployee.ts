'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import {
  canAccessSelfService,
  resolveHrEmployeeId,
  type HrEmployeeProfile,
} from '@/lib/hrSelfService'

export function useMyHrEmployee() {
  const { tenant, currentUser } = useStore()
  const [profile, setProfile] = useState<HrEmployeeProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenant?.id || !currentUser?.id) {
      setProfile(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function load() {
      const { data } = await supabase
        .from('hr_employees')
        .select('id, employee_id, name, job_title, department, hire_date, direct_manager')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)

      if (cancelled) return

      const employees = (data || []) as HrEmployeeProfile[]
      const hrId = resolveHrEmployeeId(currentUser as any, employees)
      const mine = employees.find(e => e.id === hrId) || null
      setProfile(mine)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [tenant?.id, currentUser?.id, (currentUser as any)?.hr_employee_id])

  const hrEmployeeId = profile?.id ?? null
  const allowed = canAccessSelfService(currentUser?.permissions, hrEmployeeId, currentUser?.role)

  return {
    profile,
    hrEmployeeId,
    allowed,
    loading,
    currentUser,
    tenant,
  }
}
