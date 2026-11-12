import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/vat-reconciliation.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020
}}).outputText
const exports = {}
runInNewContext(js, { exports, module: { exports } })
const { calculateVatReconciliation } = exports
const doc = (vat_amount, status) => ({ vat_amount, status })
function calculate(override = {}) {
  return calculateVatReconciliation({
    sales: [], vendorInvoices: [], creditNotes: [],
    purchaseReturns: [], supplierDebitNotes: [], expenses: [],
    ...override,
  })
}

test('draft sales and supplier invoices are excluded', () => {
  const r = calculate({
    sales: [doc(150, 'مسودة'), doc(200, 'مرسلة')],
    vendorInvoices: [doc(50, 'مسودة'), doc(80, 'معتمدة')],
  })
  assert.equal(r.outputVat, 200)
  assert.equal(r.inputVatCandidate, 80)
  assert.equal(r.estimatedNetVat, 120)
})

test('approved supplier invoices, not purchase orders, determine input VAT candidates', () => {
  const r = calculate({ vendorInvoices: [doc(30, 'معتمدة')] })
  assert.equal(r.inputVatCandidate, 30)
})

test('approved credit notes reduce output VAT', () => {
  const r = calculate({
    sales: [doc(150, 'مدفوعة')],
    creditNotes: [doc(45, 'معتمد'), doc(25, 'مسودة')],
  })
  assert.equal(r.outputVat, 105)
})

test('approved purchase returns and supplier debit notes reverse candidate input VAT', () => {
  const r = calculate({
    vendorInvoices: [doc(100, 'معتمدة')],
    purchaseReturns: [doc(15, 'معتمد'), doc(99, 'مسودة')],
    supplierDebitNotes: [doc(10, 'معتمد')],
  })
  assert.equal(r.reverseVat, 25)
  assert.equal(r.inputVatCandidate, 75)
})

test('expense VAT must not be automatically included in deductible input VAT', () => {
  const r = calculate({ expenses: [doc(300, 'مدفوع')] })
  assert.equal(r.expenseVatForReview, 300)
  assert.equal(r.inputVatCandidate, 0)
})

test('negative or invalid VAT values are never silently added', () => {
  const r = calculate({ sales: [doc(-10, 'مرسلة'), doc('oops', 'مرسلة')] })
  assert.equal(r.salesVat, 0)
})

test('net VAT rounds to halalas', () => {
  const r = calculate({
    sales: [doc(30.015, 'مرسلة')],
    vendorInvoices: [doc(10.005, 'معتمدة')],
  })
  assert.equal(r.estimatedNetVat, 20.01)
})
