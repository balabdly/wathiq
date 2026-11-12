import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Run pure TypeScript accounting logic without Next.js or a database.
const source = readFileSync(new URL('../src/lib/financial-statement-calculations.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const exports = {}
runInNewContext(compiled, { module: { exports }, exports })
const { buildIncomeStatement, buildBalanceSheet, summarizeJournalLines } = exports
const account = (code, account_type, balance, balanceAsOf = balance) => ({
  code, account_type, balance, balanceAsOf, is_parent: false,
})

test('project costs in 51* are recognized as cost of revenue', () => {
  const s = buildIncomeStatement([
    account('411', 'إيرادات', -100000),
    account('5111', 'مصروفات', 40000),
    account('521', 'مصروفات', 15000),
  ])
  assert.equal(s.totalRevenue, 100000)
  assert.equal(s.totalCost, 40000)
  assert.equal(s.totalOpex, 15000)
  assert.equal(s.grossProfit, 60000)
  assert.equal(s.netProfit, 45000)
})

test('refunds and cost reversals preserve their signed value', () => {
  const s = buildIncomeStatement([
    account('411', 'إيرادات', -90000),
    account('5111', 'مصروفات', -5000),
    account('521', 'مصروفات', 10000),
  ])
  assert.equal(s.totalRevenue, 90000)
  assert.equal(s.totalCost, -5000)
  assert.equal(s.netProfit, 85000)
})

test('accumulated depreciation reduces fixed assets rather than inflating them', () => {
  const b = buildBalanceSheet([
    account('121', 'أصول', 100000),
    account('125', 'أصول', -30000),
    account('31', 'حقوق ملكية', -70000),
  ])
  assert.equal(b.totalNonCurrentAssets, 70000)
  assert.equal(b.totalAssets, 70000)
  assert.equal(b.totalEquity, 70000)
  assert.equal(b.isBalanced, true)
})

test('as-of balance sheet includes signed liabilities, equity and unclosed profit', () => {
  const b = buildBalanceSheet([
    account('1113', 'أصول', 1000),
    account('2111', 'خصوم', -300),
    account('31', 'حقوق ملكية', -600),
    account('411', 'إيرادات', -200),
    account('521', 'مصروفات', 100),
  ])
  assert.equal(b.netProfit, 100)
  assert.equal(b.totalLiabEq, 1000)
  assert.equal(b.isBalanced, true)
})

test('opening balances remain in as-of values outside selected P&L period', () => {
  const {period,asOf} = summarizeJournalLines([
    {account_id:1,debit:1000,credit:0,entry_date:'2025-12-31'},
    {account_id:1,debit:0,credit:200,entry_date:'2026-02-01'},
    {account_id:1,debit:0,credit:500,entry_date:'2027-01-01'},
  ],'2026-01-01','2026-12-31')
  assert.equal(period.get(1).debit, 0)
  assert.equal(period.get(1).credit, 200)
  assert.equal(asOf.get(1).debit-asOf.get(1).credit, 800)
})

test('year-end closing debits and credits produce the same cumulative equity', () => {
  const b = buildBalanceSheet([
    account('1113','أصول',1000),
    account('31','حقوق ملكية',-600),
    account('32','حقوق ملكية',-100),
    account('2111','خصوم',-300),
    account('411','إيرادات',0),
    account('521','مصروفات',0),
  ])
  assert.equal(b.netProfit, 0)
  assert.equal(b.totalEquity, 700)
  assert.equal(b.isBalanced, true)
})

test('annual close affects retained earnings but not historical profit and loss', () => {
  const {period,asOf} = summarizeJournalLines([
    {account_id:411,debit:0,credit:100,entry_date:'2025-06-01',reference_type:'فاتورة'},
    {account_id:411,debit:100,credit:0,entry_date:'2025-12-31',reference_type:'إقفال سنوي'},
  ],'2025-01-01','2025-12-31')
  assert.equal(period.get(411).debit, 0)
  assert.equal(period.get(411).credit, 100)
  assert.equal(asOf.get(411).debit - asOf.get(411).credit, 0)
})
