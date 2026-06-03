import { supabase } from './supabase'
import type { Project, Visit, Material, StockLedger, Employee, Branch, Warehouse, Purchase, Client } from '@/types'

// ══ Projects ══
export const projectsApi = {
  async getAll(tenantId: string, branchId: number) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    return { data: data as Project[], error }
  },

  async getOne(id: number) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()
    return { data: data as Project, error }
  },

  async upsert(project: Partial<Project>) {
    const { data, error } = await supabase
      .from('projects')
      .upsert(project, { onConflict: 'id' })
      .select()
      .single()
    return { data: data as Project, error }
  },

  async delete(id: number) {
    return supabase.from('projects').delete().eq('id', id)
  },
}

// ══ Visits ══
export const visitsApi = {
  async getAll(tenantId: string, branchId: number, limit = 50) {
    const { data, error } = await supabase
      .from('visits')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return { data: data as Visit[], error }
  },

  async upsert(visit: Partial<Visit>) {
    const { data, error } = await supabase
      .from('visits')
      .upsert(visit, { onConflict: 'id' })
      .select()
      .single()
    return { data: data as Visit, error }
  },

  async delete(id: number) {
    return supabase.from('visits').delete().eq('id', id)
  },
}

// ══ Materials ══
export const materialsApi = {
  async getAll(tenantId: string, branchId: number) {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .order('name')
    return { data: data as Material[], error }
  },

  async search(tenantId: string, branchId: number, query: string) {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .or(`name.ilike.%${query}%,catalog_no.ilike.%${query}%,sku.ilike.%${query}%`)
      .limit(50)
    return { data: data as Material[], error }
  },

  async upsert(material: Partial<Material>) {
    const { data, error } = await supabase
      .from('materials')
      .upsert(material, { onConflict: 'id' })
      .select()
      .single()
    return { data: data as Material, error }
  },

  async delete(id: number) {
    return supabase.from('materials').delete().eq('id', id)
  },

  async deleteMany(ids: number[]) {
    return supabase.from('materials').delete().in('id', ids)
  },
}

// ══ Stock Ledger ══
export const ledgerApi = {
  async getRecent(tenantId: string, branchId: number, limit = 100) {
    const { data, error } = await supabase
      .from('stock_ledger')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return { data: data as StockLedger[], error }
  },

  async insert(entry: Partial<StockLedger>) {
    const { data, error } = await supabase
      .from('stock_ledger')
      .insert(entry)
      .select()
      .single()
    return { data: data as StockLedger, error }
  },

  async insertMany(entries: Partial<StockLedger>[]) {
    const { data, error } = await supabase
      .from('stock_ledger')
      .insert(entries)
      .select()
    return { data: data as StockLedger[], error }
  },
}

// ══ Employees ══
export const employeesApi = {
  async getAll(tenantId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    return { data: data as Employee[], error }
  },

  async upsert(employee: Partial<Employee>) {
    const { data, error } = await supabase
      .from('employees')
      .upsert(employee, { onConflict: 'id' })
      .select()
      .single()
    return { data: data as Employee, error }
  },

  async delete(id: number) {
    return supabase.from('employees').delete().eq('id', id)
  },
}

// ══ Branches ══
export const branchesApi = {
  async getAll(tenantId: string) {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('id')
    return { data: data as Branch[], error }
  },

  async upsert(branch: Partial<Branch>) {
    const { data, error } = await supabase
      .from('branches')
      .upsert(branch, { onConflict: 'id' })
      .select()
      .single()
    return { data: data as Branch, error }
  },
}

// ══ Warehouses ══
export const warehousesApi = {
  async getAll(tenantId: string, branchId: number) {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
    return { data: data as Warehouse[], error }
  },

  async upsert(warehouse: Partial<Warehouse>) {
    const { data, error } = await supabase
      .from('warehouses')
      .upsert(warehouse, { onConflict: 'id' })
      .select()
      .single()
    return { data: data as Warehouse, error }
  },
}

// ══ Purchases ══
export const purchasesApi = {
  async getAll(tenantId: string, branchId: number) {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    return { data: data as Purchase[], error }
  },

  async upsert(purchase: Partial<Purchase>) {
    const { data, error } = await supabase
      .from('purchases')
      .upsert(purchase, { onConflict: 'id' })
      .select()
      .single()
    return { data: data as Purchase, error }
  },
}

// ══ Clients ══
export const clientsApi = {
  async getAll(tenantId: string) {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    return { data: data as Client[], error }
  },

  async upsert(client: Partial<Client>) {
    const { data, error } = await supabase
      .from('clients')
      .upsert(client, { onConflict: 'id' })
      .select()
      .single()
    return { data: data as Client, error }
  },
}
import { supabase } from '@/lib/supabase'

export const zonesApi = {
  async list(warehouseId: number) {
    return supabase
      .from('warehouse_zones')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .order('name', { ascending: true })
  },
  async create(payload: {
    tenant_id: string
    branch_id: number
    warehouse_id: number
    name: string
    zone_type?: string
    color?: string
    notes?: string
  }) {
    return supabase.from('warehouse_zones').insert(payload).select().single()
  },
  async update(id: number, patch: Partial<{ name: string; zone_type: string; color: string; notes: string }>) {
    return supabase.from('warehouse_zones').update(patch).eq('id', id)
  },
  async delete(id: number) {
    return supabase.from('warehouse_zones').delete().eq('id', id)
  },
}
