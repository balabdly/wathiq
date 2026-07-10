import { create } from 'zustand'
import { createBrowserClient } from '@supabase/ssr'

export type DisplayView = 'list' | 'cards' | 'kanban'
export type DisplayPrefs = {
  projects:  DisplayView
  visits:    DisplayView
  tasks:     DisplayView
  employees: DisplayView
  materials: DisplayView
}
const DEFAULT_PREFS: DisplayPrefs = {
  projects: 'list', visits: 'list', tasks: 'list',
  employees: 'list', materials: 'list',
}
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
  // ── Display Prefs ──
  displayPrefs: DisplayPrefs
  setDisplayPrefs: (prefs: Partial<DisplayPrefs>) => void
  updateDisplayPref: (key: keyof DisplayPrefs, value: DisplayView) => void
  // ── Reset ──
  reset: () => void
}

const _sb = createBrowserClient(
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
      // Display Prefs
      displayPrefs: DEFAULT_PREFS,
      setDisplayPrefs: (prefs) => set(state => ({ displayPrefs: { ...state.displayPrefs, ...prefs } })),
      updateDisplayPref: (key, value) => set(state => ({ displayPrefs: { ...state.displayPrefs, [key]: value } })),
      // Reset
      reset: () => set({
        currentUser: null, tenant: null, activeBranch: null,
        projects: [], visits: [], materials: [], warehouses: [],
        stockLedger: [], purchases: [], employees: [], clients: [],
      }),
    }),
    {
      name: 'wathiq-store',
      // لا نحفظ permissions في localStorage — تُجلب دائماً من DB
      partialize: (state) => ({
        currentUser: state.currentUser
          ? { ...state.currentUser, permissions: [] } // نحفظ بدون permissions
          : null,
        tenant: state.tenant,
        activeBranch: state.activeBranch,
        branches: state.branches,
        displayPrefs: state.displayPrefs,
      }),
      onRehydrateStorage: () => async (state) => {
        if (!state?.currentUser?.id) return
        try {
          const { data } = await _sb
            .from('employees')
            .select('permissions, role, hr_employee_id')
            .eq('id', state.currentUser.id)
            .single()
          if (data) {
            state.setCurrentUser({
              ...state.currentUser,
              permissions: data.permissions || [],
              role: data.role,
              hr_employee_id: data.hr_employee_id ?? undefined,
            })
          }
        } catch {}
      },
    }
  )
)
