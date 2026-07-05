// src/lib/treasury-types.ts
export type CashAccount = {
  id: number; name: string; account_type: string
  bank_name?: string; account_no?: string; iban?: string
  opening_balance: number; is_active: boolean; notes?: string
  balance?: number; account_id?: number
}
export type Custody = {
  id: number; custody_no: string; custody_date: string
  employee_id?: number; employee_name: string
  custody_type: string; amount: number; purpose: string
  project_id?: number; due_date?: string
  settled_amount: number; settled_date?: string
  status: string; notes?: string
  project?: { name: string }
  employee?: { name: string }
}
export type Project  = { id: number; name: string }
export type Employee = { id: number; name: string }
