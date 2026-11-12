import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/zatca-phase1-qr.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText
const exports = {}
runInNewContext(js, { exports, TextEncoder, btoa })
const { createZatcaPhase1Qr } = exports

function decodeTagValue(base64) {
  const bytes = Buffer.from(base64, 'base64')
  const fields = []
  for (let index = 0; index < bytes.length;) {
    const tag = bytes[index++]
    const length = bytes[index++]
    const value = bytes.subarray(index, index + length).toString('utf8')
    fields.push({ tag, value, length })
    index += length
  }
  return fields
}

test('ZATCA Phase 1 TLV encodes Arabic seller with byte lengths, no double UTF-8 encoding', () => {
  const qr = createZatcaPhase1Qr({
    sellerName: 'شركة إنشاءات الشمال',
    vatNumber: '300000000000003',
    issuedAt: '2026-11-12T12:00:00+03:00',
    totalAmount: 1150,
    vatAmount: 150,
  })
  const tags = decodeTagValue(qr)
  assert.deepEqual(tags.map(tag => tag.tag), [1, 2, 3, 4, 5])
  assert.equal(tags[0].value, 'شركة إنشاءات الشمال')
  assert.equal(tags[0].length, Buffer.byteLength('شركة إنشاءات الشمال', 'utf8'))
  assert.equal(tags[1].value, '300000000000003')
  assert.equal(tags[2].value, '2026-11-12T09:00:00.000Z')
  assert.equal(tags[3].value, '1150.00')
  assert.equal(tags[4].value, '150.00')
})

test('date-only values do not pretend to be a real invoice issuance timestamp', () => {
  assert.equal(createZatcaPhase1Qr({
    sellerName: 'Company', vatNumber: '300000000000003',
    issuedAt: '2026-11-12', totalAmount: 115, vatAmount: 15,
  }), '')
})

test('missing seller or VAT identity produces no deceptive QR payload', () => {
  assert.equal(createZatcaPhase1Qr({
    sellerName: '', vatNumber: '300000000000003',
    issuedAt: '2026-11-12T09:00:00Z', totalAmount: 115, vatAmount: 15,
  }), '')
})

test('non-finite VAT values cannot be encoded', () => {
  assert.equal(createZatcaPhase1Qr({
    sellerName: 'Company', vatNumber: '300000000000003',
    issuedAt: '2026-11-12T09:00:00Z', totalAmount: NaN, vatAmount: 15,
  }), '')
})
