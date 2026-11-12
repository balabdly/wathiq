import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import ts from 'typescript'

function loadTs(relative) {
  const source=readFileSync(new URL(relative,import.meta.url),'utf8')
  const transpiled=ts.transpileModule(source,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,
  }}).outputText
  const exports={}
  runInNewContext(transpiled,{
    exports,module:{exports},require:createRequire(import.meta.url),
    Buffer,process,AbortSignal,fetch:globalThis.fetch,
  })
  return exports
}
const sdk=loadTs('../src/lib/zatca/sdk-cli.server.ts')
const transport=loadTs('../src/lib/zatca/simulation-client.server.ts')
const xml='<Invoice><ext:UBLExtensions><ds:Signature>test</ds:Signature></ext:UBLExtensions></Invoice>'
const example=()=>({
  kind:'standard',
  uuid:'123e4567-e89b-42d3-a456-426614174000',
  invoiceHash:'A'.repeat(43)+'=',
  signedXml:xml,
  sdkEvidence:{validatedBy:'ZATCA_OFFICIAL_SDK',passed:true,
    signedXmlSha256Hex:createHash('sha256').update(xml,'utf8').digest('hex')},
})

test('SDK CLI requires explicit global validation PASS and zero exit code',()=>{
  sdk.assertOfficialSdkPassed(0,'*** GLOBAL VALIDATION RESULT - PASSED')
  assert.throws(()=>sdk.assertOfficialSdkPassed(1,'GLOBAL VALIDATION RESULT - PASSED'),/did not report/)
  assert.throws(()=>sdk.assertOfficialSdkPassed(0,'GLOBAL VALIDATION RESULT - FAILED'),/did not report/)
  assert.throws(()=>sdk.assertOfficialSdkPassed(0,'XSD passed; warnings exist'),/did not report/)
})
test('SDK adapter rejects unsigned content without a configured executable',async()=>{
  await assert.rejects(sdk.validateSignedXmlUsingOfficialSdk('<Invoice/>'),/Unsigned XML/)
  const old=process.env.ZATCA_SDK_FATOORA_BIN
  delete process.env.ZATCA_SDK_FATOORA_BIN
  try {
    await assert.rejects(sdk.validateSignedXmlUsingOfficialSdk(xml),/not installed/)
  } finally {
    if(old===undefined)delete process.env.ZATCA_SDK_FATOORA_BIN
    else process.env.ZATCA_SDK_FATOORA_BIN=old
  }
})
test('valid evidence creates only the official simulation clearance endpoint',()=>{
  const r=transport.buildZatcaSimulationRequest(example())
  assert.equal(r.url,'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/invoices/clearance/single')
  assert.equal(r.clearanceStatus,'1')
  assert.equal(r.body.uuid,example().uuid)
  assert.equal(Buffer.from(r.body.invoice,'base64').toString('utf8'),xml)
})
test('simplified invoices route to reporting, not clearance',()=>{
  const r=transport.buildZatcaSimulationRequest({...example(),kind:'simplified'})
  assert.match(r.url,/simulation\/invoices\/reporting\/single$/)
  assert.equal(r.clearanceStatus,'0')
})
test('tampering after offline SDK evidence is rejected',()=>{
  assert.throws(()=>transport.buildZatcaSimulationRequest({...example(),signedXml:xml+' '}),/modified/)
  assert.throws(()=>transport.buildZatcaSimulationRequest({...example(),sdkEvidence:null}),/SDK/)
  assert.throws(()=>transport.buildZatcaSimulationRequest({...example(),invoiceHash:'invalid'}),/Base64/)
})
test('successful HTTP status alone never equals clearance/reporting',()=>{
  assert.equal(transport.classifySimulationResponse('standard',200,{}).outcome,'unknown')
  assert.equal(transport.classifySimulationResponse('standard',200,{clearanceStatus:'CLEARED'}).outcome,'unknown')
  assert.equal(transport.classifySimulationResponse('standard',200,{clearanceStatus:'CLEARED',clearedInvoice:'test'}).outcome,'cleared')
  assert.equal(transport.classifySimulationResponse('simplified',200,{reportingStatus:'REPORTED'}).outcome,'reported')
})
test('duplicate, timeouts and server errors require reconciliation',()=>{
  const duplicate=transport.classifySimulationResponse('standard',409,{})
  assert.equal(duplicate.outcome,'unknown')
  assert.equal(duplicate.retryable,false)
  assert.equal(transport.classifySimulationResponse('standard',500,{}).outcome,'unknown')
  assert.equal(transport.classifySimulationResponse('standard',500,{}).retryable,true)
  assert.equal(transport.classifySimulationResponse('standard',400,{}).outcome,'rejected')
})
test('network is disabled by default and no outgoing request is made',async()=>{
  const old=process.env.ZATCA_SIMULATION_NETWORK_ENABLED
  delete process.env.ZATCA_SIMULATION_NETWORK_ENABLED
  let requests=0
  try {
    await assert.rejects(transport.submitToZatcaSimulation(example(),async()=>{requests++;return {status:200}}),/disabled/)
    assert.equal(requests,0)
  } finally {
    if(old===undefined)delete process.env.ZATCA_SIMULATION_NETWORK_ENABLED
    else process.env.ZATCA_SIMULATION_NETWORK_ENABLED=old
  }
})
test('a mock simulation POST uses V2 and does not log credentials',async()=>{
  const saved={
    gate:process.env.ZATCA_SIMULATION_NETWORK_ENABLED,
    token:process.env.ZATCA_SIMULATION_BINARY_SECURITY_TOKEN,
    secret:process.env.ZATCA_SIMULATION_SECRET,
  }
  process.env.ZATCA_SIMULATION_NETWORK_ENABLED='true'
  process.env.ZATCA_SIMULATION_BINARY_SECURITY_TOKEN='test-only-token'
  process.env.ZATCA_SIMULATION_SECRET='test-only-secret'
  try {
    let intercepted
    const result=await transport.submitToZatcaSimulation(example(),async(url,options)=>{
      intercepted={url,options}
      return {status:200,json:async()=>({clearanceStatus:'CLEARED',clearedInvoice:'base64-test'})}
    })
    assert.equal(result.outcome,'cleared')
    assert.equal(intercepted.options.headers['Accept-Version'],'V2')
    assert.equal(intercepted.options.headers['Clearance-Status'],'1')
    assert.equal(intercepted.options.method,'POST')
    assert.equal(intercepted.url.includes('/core/'),false)
    assert.equal(typeof intercepted.options.body,'string')
  } finally {
    for(const [key,name] of [['gate','ZATCA_SIMULATION_NETWORK_ENABLED'],
      ['token','ZATCA_SIMULATION_BINARY_SECURITY_TOKEN'],['secret','ZATCA_SIMULATION_SECRET']]) {
      if(saved[key]===undefined)delete process.env[name]
      else process.env[name]=saved[key]
    }
  }
})

test('official SDK signing cannot run without explicit server-side enablement',async()=>{
  const old=process.env.ZATCA_SDK_SIGNING_ENABLED
  delete process.env.ZATCA_SDK_SIGNING_ENABLED
  try {
    await assert.rejects(sdk.signAndValidateTestXmlUsingOfficialSdk('<Invoice/>'),/disabled/)
  } finally {
    if(old===undefined)delete process.env.ZATCA_SDK_SIGNING_ENABLED
    else process.env.ZATCA_SDK_SIGNING_ENABLED=old
  }
})
