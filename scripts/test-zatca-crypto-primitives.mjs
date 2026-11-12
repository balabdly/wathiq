import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {createRequire} from 'node:module'
import {generateKeyPairSync,sign} from 'node:crypto'
import ts from 'typescript'

const source=readFileSync(new URL('../src/lib/zatca/crypto-primitives.server.ts',import.meta.url),'utf8')
const code=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020
}}).outputText
const exports={}
runInNewContext(code,{exports,module:{exports},require:createRequire(import.meta.url),Buffer})
const {sha256Base64,verifyP256Signature,encodeQrTlvBase64}=exports

test('SHA-256 digest over exact bytes matches standard known vector',()=>{
  assert.equal(sha256Base64(Buffer.from('abc')),'ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=')
})
test('empty content cannot be signed or hashed',()=>{
  assert.throws(()=>sha256Base64(new Uint8Array()),/non-empty/)
})
test('detached P-256 signature verification accepts the correct document',()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'})
  const data=Buffer.from('<Invoice>test &amp; demo</Invoice>')
  const signature=sign('sha256',data,{key:privateKey,dsaEncoding:'ieee-p1363'})
  assert.equal(verifyP256Signature(data,signature,publicKey.export({type:'spki',format:'pem'})),true)
  assert.equal(verifyP256Signature(Buffer.from('<Invoice>different</Invoice>'),signature,
    publicKey.export({type:'spki',format:'pem'})),false)
})
test('P-256 verifier rejects keys from a different curve',()=>{
  const {publicKey}=generateKeyPairSync('ec',{namedCurve:'secp256k1'})
  assert.throws(()=>verifyP256Signature(Buffer.from('x'),Buffer.alloc(64),
    publicKey.export({type:'spki',format:'pem'})),/Only the P-256/)
})
test('P-256 verifier rejects truncated ECDSA signatures',()=>{
  const {publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'})
  assert.throws(()=>verifyP256Signature(Buffer.from('x'),Buffer.from([1]),
    publicKey.export({type:'spki',format:'pem'})),/64 bytes/)
})
test('TLV uses UTF-8 byte count for Arabic company names, not character count',()=>{
  const name='شركة وثيق'
  const raw=Buffer.from(encodeQrTlvBase64([{tag:1,value:name}]),'base64')
  assert.equal(raw[0],1)
  assert.equal(raw[1],Buffer.byteLength(name,'utf8'))
  assert.equal(raw.subarray(2).toString('utf8'),name)
})
test('TLV supports binary fields without reencoding',()=>{
  const raw=Buffer.from(encodeQrTlvBase64([
    {tag:6,value:Buffer.from([0,255,13,10])},
    {tag:7,value:'abc'},
  ]),'base64')
  assert.deepEqual([...raw],[6,4,0,255,13,10,7,3,97,98,99])
})
test('TLV refuses duplicate, oversized and empty tag values',()=>{
  assert.throws(()=>encodeQrTlvBase64([{tag:1,value:'a'},{tag:1,value:'b'}]),/distinct/)
  assert.throws(()=>encodeQrTlvBase64([{tag:1,value:'x'.repeat(256)}]),/between 1 and 255/)
  assert.throws(()=>encodeQrTlvBase64([{tag:1,value:''}]),/between 1 and 255/)
  assert.throws(()=>encodeQrTlvBase64([]),/at least one/)
})
