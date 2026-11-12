import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/vat-reconciliation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText
const exports = {}
runInNewContext(compiled, { exports, module: { exports } })
const { summarizeVatDocuments } = exports

const base = () => ({
  invoices: [], creditNotes: [], vendorInvoices: [],
  debitNotes: [], purchaseReturns: [], expenses: [],
})

test('VAT output only includes issued/paid sales, never drafts', () => {
  const data = base()
  data.invoices = [
    { status: 'مسودة', vat_amount: 900 },
    { status: 'مرسلة', vat_amount: 150 },
    { status: 'مدفوعة', vat_amount: 200 },
    { status: 'ملغاة', vat_amount: 250 },
  ]
  const r = summarizeVatDocuments(data)
  assert.equal(r.outputVat, 350)
  assert.equal(r.salesRows.length, 2)
})

test('purchase orders are not a deductible input VAT source', () => {
  const data = base()
  data.invoices = [{ status: 'مرسلة', vat_amount: 150000 }]
  data.purchaseOrders = [{ status: 'معتمد', vat_amount: 60000 }]
  data.vendorInvoices = [{ status: 'معتمدة', vat_amount: 30000 }]
  const r = summarizeVatDocuments(data)
  assert.equal(r.vendorVat, 30000)
  assert.equal(r.netVatEstimate, 120000)
})

test('draft vendor invoices never generate input tax', () => {
  const data = base()
  data.vendorInvoices = [
    { status: 'مسودة', vat_amount: 1500 },
    { status: 'معتمدة', vat_amount: 50 },
    { status: 'مدفوعة', vat_amount: 70 },
    { status: 'مرتجعة', vat_amount: 80 },
  ]
  assert.equal(summarizeVatDocuments(data).vendorVat, 200)
})

test('approved sales credit notes reduce VAT output', () => {
  const data = base()
  data.invoices = [{ status: 'مرسلة', vat_amount: 150 }]
  data.creditNotes = [
    { status: 'معتمد', vat_amount: 40 },
    { status: 'مسودة', vat_amount: 20 },
    { status: 'ملغي', vat_amount: 10 },
  ]
  const r = summarizeVatDocuments(data)
  assert.equal(r.salesCreditVat, -40)
  assert.equal(r.outputVat, 110)
})

test('approved debit notes and purchase returns reduce input VAT', () => {
  const data = base()
  data.vendorInvoices = [{ status: 'معتمدة', vat_amount: 1000 }]
  data.debitNotes = [{ status: 'معتمد', vat_amount: 150 }]
  data.purchaseReturns = [{ status: 'معتمد', vat_amount: 50 }, { status: 'ملغي', vat_amount: 80 }]
  const r = summarizeVatDocuments(data)
  assert.equal(r.purchaseAdjustmentVat, -200)
  assert.equal(r.inputVatCandidate, 800)
})

test('expense input VAT is disclosed pending eligibility and NOT deducted', () => {
  const data = base()
  data.invoices = [{ status: 'مرسلة', vat_amount: 1000 }]
  data.expenses = [{ status: 'مدفوع', vat_amount: 100 }, { status: 'ملغي', vat_amount: 200 }]
  const r = summarizeVatDocuments(data)
  assert.equal(r.expenseVatPendingReview, 100)
  assert.equal(r.netVatEstimate, 1000)
})

test('zero rate does not turn into fifteen percent in detailed rows', () => {
  const data = base()
  data.invoices = [{ status: 'مرسلة', vat_rate: 0, subtotal: 100, total_amount: 100, vat_amount: 0 }]
  const r = summarizeVatDocuments(data)
  assert.equal(r.salesRows.length, 1)
  assert.equal(r.salesRows[0].vat_rate, 0)
})

test('credit/return adjustments retain negative values in detail rows', () => {
  const data = base()
  data.creditNotes = [{ status: 'معتمد', note_number: 'CN-01', note_date: '2026-11-12', vat_amount: '15', subtotal: 100, total_amount: 115 }]
  data.debitNotes = [{ status: 'معتمد', note_number: 'DN-01', note_date: '2026-11-12', vat_amount: 7.5, subtotal: 50, total_amount: 57.5 }]
  const r = summarizeVatDocuments(data)
  assert.equal(r.salesRows[0].invoice_number, 'CN-01')
  assert.equal(r.salesRows[0].vat_amount, -15)
  assert.equal(r.purchaseRows[0].vat_amount, -7.5)
})

test('invalid numerical values fail rather than silently create false reports', () => {
  const data = base()
  data.invoices = [{ status: 'مرسلة', vat_amount: 'invalid' }]
  assert.throws(() => summarizeVatDocuments(data), /غير صالحة/)
})
