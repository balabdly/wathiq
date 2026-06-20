import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Tenant, Employee, Branch, Project, Visit, Material, StockLedger, Warehouse, Purchase, Client } from '@/types'

interface AppState {
  // ── Auth ──
  currentUser: Employee | null
  tenant: Tenant | null
  activeBranch: Branch | null
  branches: Branch[]
  setCurrentUser: (user: Employee | null) => void
  setTenant: (tenant: Tenant | null) => void
  setActiveBranch: (branch: Branch) => void
  setBranches: (branches: Branch[]) => void
  // ── Data ──
  projects: Project[]
  visits: Visit[]
  materials: Material[]
  warehouses: Warehouse[]
  stockLedger: StockLedger[]
  purchases: Purchase[]
  employees: Employee[]
  clients: Client[]
  // ── Setters ──
  setProjects: (projects: Project[]) => void
  setVisits: (visits: Visit[]) => void
  setMaterials: (materials: Material[]) => void
  setWarehouses: (warehouses: Warehouse[]) => void
  setStockLedger: (ledger: StockLedger[]) => void
  setPurchases: (purchases: Purchase[]) => void
  setEmployees: (employees: Employee[]) => void
  setHREmployees: (employees: any[]) => void
  setClients: (clients: Client[]) => void
  // ── UI ──
  isLoading: boolean
  setLoading: (v: boolean) => void
  isSidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  activeHRTab: string
  setActiveHRTab: (tab: string) => void
  // ── Reset ──
  reset: () => void
}

import { createClient } from '@supabase/supabase-js'
const _sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      currentUser: null,
      tenant: null,
      activeBranch: null,
      branches: [],
      setCurrentUser: (user) => set({ currentUser: user }),
      setTenant: (tenant) => set({ tenant }),
      setActiveBranch: (branch) => set({ activeBranch: branch }),
      setBranches: (branches) => set({ branches }),
      // Data
      projects: [],
      visits: [],
      materials: [],
      warehouses: [],
      stockLedger: [],
      purchases: [],
      employees: [],
      clients: [],
      // Setters
      setProjects: (projects) => set({ projects }),
      setVisits: (visits) => set({ visits }),
      setMaterials: (materials) => set({ materials }),
      setWarehouses: (warehouses) => set({ warehouses }),
      setStockLedger: (stockLedger) => set({ stockLedger }),
      setPurchases: (purchases) => set({ purchases }),
      setEmployees: (employees) => set({ employees }),
      setHREmployees: (employees: any[]) => set({ employees: employees as any }),
      setClients: (clients) => set({ clients }),
      // UI
      isLoading: false,
      setLoading: (isLoading) => set({ isLoading }),
      isSidebarOpen: true,
      setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
      activeHRTab: 'employees',
      setActiveHRTab: (activeHRTab) => set({ activeHRTab }),
      // Reset
      reset: () => set({
        currentUser: null, tenant: null, activeBranch: null,
        projects: [], visits: [], materials: [], warehouses: [],
        stockLedger: [], purchases: [], employees: [], clients: [],
      }),
    }),
    {
      name: 'wathiq-store',
      partialize: (state) => ({
        currentUser: state.currentUser,
        tenant: state.tenant,
        activeBranch: state.activeBranch,
        branches: state.branches,
      }),
      // ── تحديث permissions من DB عند كل تحميل للصفحة ──
      onRehydrateStorage: () => async (state) => {
        if (!state?.currentUser?.id) return
        try {
          const { data } = await _sb
            .from('employees')
            .select('permissions, role')
            .eq('id', state.currentUser.id)
            .single()
          if (data) {
            state.setCurrentUser({
              ...state.currentUser,
              permissions: data.permissions || [],
              role: data.role,
            })
          }
        } catch {}
      },
    }
  )
)
