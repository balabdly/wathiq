import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/vat-reconciliation.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const exports = {}
runInNewContext(js, { exports, module: { exports } })
const { calculateVatSnapshot } = exports
const v = vat_amount => ({vat_amount})

test('purchase orders do not enter the input VAT preview', () => {
  const r = calculateVatSnapshot({
    sales:[v(150000)], purchases:[v(30000)],
    creditNotes:[], purchaseReturns:[], purchaseDebitNotes:[],
  })
  assert.equal(r.netVat,120000)
})

test('approved credit notes reduce output VAT in their own period', () => {
  const r = calculateVatSnapshot({
    sales:[v(15000)], purchases:[], creditNotes:[v(1500)],
    purchaseReturns:[], purchaseDebitNotes:[],
  })
  assert.equal(r.netOutputVat,13500)
})

test('purchase returns and debit notes reverse previously recognized input VAT', () => {
  const r = calculateVatSnapshot({
    sales:[], purchases:[v(12000)], creditNotes:[],
    purchaseReturns:[v(2000)], purchaseDebitNotes:[v(1000)],
  })
  assert.equal(r.netInputVat,9000)
  assert.equal(r.netVat,-9000)
})

test('halala rounding is stable across multiple documents', () => {
  const r = calculateVatSnapshot({
    sales:[v(0.1),v(0.2)], purchases:[],creditNotes:[],
    purchaseReturns:[],purchaseDebitNotes:[],
  })
  assert.equal(r.outputVat,0.3)
})

test('empty period yields zero and excludes invalid VAT amounts', () => {
  const r = calculateVatSnapshot({
    sales:[v(-10),v(NaN),v(0)], purchases:[],creditNotes:[],
    purchaseReturns:[],purchaseDebitNotes:[],
  })
  assert.equal(r.netVat,0)
})
