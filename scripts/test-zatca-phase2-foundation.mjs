import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'

function loadTs(file) {
  const source = readFileSync(new URL(file, import.meta.url),'utf8')
  const js=ts.transpileModule(source,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020
  }}).outputText
  const exports={}
  runInNewContext(js,{exports,module:{exports}})
  return exports
}
const {validateUnsignedStandardInvoice,buildUnsignedStandardInvoiceXml}=
  loadTs('../src/lib/zatca/phase2-draft.ts')
const {assessInvoiceForPhase2}=loadTs('../src/lib/zatca/phase2-preflight.ts')

function fixture() {
  const seller={name:'إنشاءات الشمال',vatNumber:'300000000000003',
    address:{street:'طريق الملك فهد',district:'حي النزهة',city:'القريات',postalCode:'77455',countryCode:'SA'},
    commercialRegistration:'1010101010'}
  const buyer={name:'عميل اختباري',vatNumber:'300000000000003',
    address:{street:'شارع 1',district:'حي 2',city:'الرياض',postalCode:'12345',countryCode:'SA'}}
  return {
    invoiceNumber:'INV-TEST-001',uuid:'123e4567-e89b-42d3-a456-426614174000',
    issueDate:'2026-11-13',issueTime:'14:31:01',currency:'SAR',
    icv:1,previousInvoiceHash:'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==',
    seller,buyer,
    lines:[{description:'صيانة',quantity:2,unitCode:'EA',unitPrice:100,lineNetAmount:200,vatRate:15}],
    netAmount:200,vatAmount:30,totalAmount:230,
  }
}

test('valid complete 15 percent standard invoice passes initial structural checks',()=>{
  assert.equal(validateUnsignedStandardInvoice(fixture()).length,0)
})
test('generated unsigned XML contains UBL fields but no fake signature',()=>{
  const xml=buildUnsignedStandardInvoiceXml(fixture())
  assert.match(xml,/xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"/)
  assert.match(xml,/<cbc:UUID>123e4567-e89b-42d3-a456-426614174000<\/cbc:UUID>/)
  assert.match(xml,/<cbc:InvoiceTypeCode name="0100000">388<\/cbc:InvoiceTypeCode>/)
  assert.match(xml,/<cbc:ID>ICV<\/cbc:ID>/)
  assert.match(xml,/<cbc:ID>PIH<\/cbc:ID>/)
  assert.match(xml,/<cbc:PayableAmount currencyID="SAR">230.00<\/cbc:PayableAmount>/)
  assert.match(xml,/UNSIGNED XML STRUCTURE FOR DEVELOPMENT ONLY/)
  assert.doesNotMatch(xml,/<ds:Signature|<sac:SignatureInformation|<cbc:EmbeddedDocumentBinaryObject mimeCode="application\/pdf"/)
})
test('XML values escape special characters rather than interpolate markup',()=>{
  const f=fixture()
  f.lines[0].description='Fix <panel> & "line"'
  f.seller.name='A & B'
  const xml=buildUnsignedStandardInvoiceXml(f)
  assert.match(xml,/Fix &lt;panel&gt; &amp; &quot;line&quot;/)
  assert.match(xml,/A &amp; B/)
  assert.doesNotMatch(xml,/<panel>/)
})
test('missing buyer VAT number is rejected for current B2B-only slice',()=>{
  const f=fixture()
  f.buyer.vatNumber=''
  assert.ok(validateUnsignedStandardInvoice(f).some(x=>x.field==='buyer.vatNumber'))
})
test('unsupported zero-rated/exempt tax is rejected rather than silently mislabeled',()=>{
  const f=fixture()
  f.lines[0].vatRate=0
  assert.ok(validateUnsignedStandardInvoice(f).some(x=>x.field==='lines.0.vatRate'))
})
test('invalid invoice totals cannot be converted to XML',()=>{
  const f=fixture()
  f.vatAmount=15
  assert.ok(validateUnsignedStandardInvoice(f).some(x=>x.field==='totals'))
  assert.throws(()=>buildUnsignedStandardInvoiceXml(f),/totals/)
})
test('invalid line subtotal is detected',()=>{
  const f=fixture()
  f.lines[0].lineNetAmount=190
  assert.ok(validateUnsignedStandardInvoice(f).some(x=>x.field==='lines.0.lineNetAmount'))
})
test('hash chaining and invoice counter are mandatory',()=>{
  const f=fixture()
  f.icv=0
  f.previousInvoiceHash='not-valid'
  const issues=validateUnsignedStandardInvoice(f)
  assert.ok(issues.some(x=>x.field==='icv'))
  assert.ok(issues.some(x=>x.field==='previousInvoiceHash'))
})
test('valid UUID and issue time formats are required',()=>{
  const f=fixture()
  f.uuid='not-a-uuid'
  f.issueTime='9:30'
  assert.ok(validateUnsignedStandardInvoice(f).some(x=>x.field==='uuid'))
  assert.ok(validateUnsignedStandardInvoice(f).some(x=>x.field==='issueTime'))
})
test('current invoice data audit highlights missing company/buyer fields',()=>{
  const report=assessInvoiceForPhase2({
    invoiceNumber:'INV-1',invoiceDate:'2026-11-13',vatRate:15,
    subtotal:200,vatAmount:30,totalAmount:230,
    seller:{name:'Company',vatNumber:''},
    buyer:{name:'Buyer',vatNumber:''},
    items:[{description:'Service',quantity:2,unitPrice:100,total:200}],
  })
  assert.equal(report.dataComplete,false)
  assert.equal(report.productionReady,false)
  assert.ok(report.issues.some(i=>i.field==='seller.vatNumber'))
})
test('even a complete input audit is NOT production readiness',()=>{
  const f=fixture()
  const report=assessInvoiceForPhase2({
    invoiceNumber:f.invoiceNumber,invoiceDate:f.issueDate,vatRate:15,
    subtotal:200,vatAmount:30,totalAmount:230,
    seller:{name:f.seller.name,vatNumber:f.seller.vatNumber,...f.seller.address},
    buyer:{name:f.buyer.name,vatNumber:f.buyer.vatNumber,...f.buyer.address},
    items:[{description:'Service',quantity:2,unitPrice:100,total:200}],
  })
  assert.equal(report.dataComplete,true)
  assert.equal(report.productionReady,false)
})

test('first-invoice PIH requires the official ZATCA genesis value',()=>{
  const f=fixture()
  f.previousInvoiceHash='A'.repeat(43)+'='
  assert.ok(validateUnsignedStandardInvoice(f).some(x=>x.field==='previousInvoiceHash'))
  f.previousInvoiceHash='NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ=='
  assert.equal(validateUnsignedStandardInvoice(f).length,0)
})
test('subsequent PIH requires a 32-byte SHA-256 base64 digest',()=>{
  const f=fixture()
  f.icv=2
  assert.ok(validateUnsignedStandardInvoice(f).some(x=>x.field==='previousInvoiceHash'))
  f.previousInvoiceHash='A'.repeat(43)+'='
  assert.equal(validateUnsignedStandardInvoice(f).length,0)
})
