import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Tenant, Employee, Branch, Project, Visit, Material, StockLedger, Warehouse, Purchase, Client } from '@/types'

// ── نوع موظف HR ──
export type HREmployee = {
  id: number
  tenant_id: string
  employee_id?: number        // الربط بـ employees (للـ login)
  employee_number?: string
  name?: string               // الاسم المدمج
  first_name?: string
  father_name?: string
  grandfather_name?: string
  family_name?: string
  job_title?: string
  department?: string
  nationality?: string
  is_active: boolean
  basic_salary?: number
  housing_allow?: number
  transport_allow?: number
  other_allow?: number
  hire_date?: string
  iqama_expiry?: string
  passport_expiry?: string
}

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
  employees: Employee[]       // مستخدمو النظام (login/صلاحيات)
  hrEmployees: HREmployee[]   // موظفو HR (بيانات وظيفية)
  clients: Client[]
  // ── Setters ──
  setProjects: (projects: Project[]) => void
  setVisits: (visits: Visit[]) => void
  setMaterials: (materials: Material[]) => void
  setWarehouses: (warehouses: Warehouse[]) => void
  setStockLedger: (ledger: StockLedger[]) => void
  setPurchases: (purchases: Purchase[]) => void
  setEmployees: (employees: Employee[]) => void
  setHREmployees: (hrEmployees: HREmployee[]) => void
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
      hrEmployees: [],
      clients: [],
      // Setters
      setProjects: (projects) => set({ projects }),
      setVisits: (visits) => set({ visits }),
      setMaterials: (materials) => set({ materials }),
      setWarehouses: (warehouses) => set({ warehouses }),
      setStockLedger: (stockLedger) => set({ stockLedger }),
      setPurchases: (purchases) => set({ purchases }),
      setEmployees: (employees) => set({ employees }),
      setHREmployees: (hrEmployees) => set({ hrEmployees }),
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
        stockLedger: [], purchases: [], employees: [], hrEmployees: [], clients: [],
      }),
    }),
    {
      name: 'wathiq-store',
      // نحفظ فقط بيانات المصادقة — البيانات الثقيلة تُحمّل من جديد
      partialize: (state) => ({
        currentUser: state.currentUser,
        tenant: state.tenant,
        activeBranch: state.activeBranch,
        branches: state.branches,
      }),
    }
  )
)
