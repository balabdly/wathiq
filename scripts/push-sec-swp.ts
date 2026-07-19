/** Execute swp-sql-chunks via Supabase REST (reads .env.local) */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

async function main() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('Missing Supabase env'); process.exit(1) }

  const supabase = createClient(url, key)
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'sec-swp-procedures.json'), 'utf8'))
  const all = [...data.procedures, ...(data.riskTemplate ? [{ ...data.riskTemplate, proc_no: 'SEC-RISK-TEMPLATE-2025' }] : [])]

  const allTenants = process.argv.includes('--all-tenants')
  const tenantArg = process.argv[2]

  let tenantIds: string[] = []
  if (allTenants) {
    const { data: tenants, error } = await supabase.from('tenants').select('id').order('name')
    if (error || !tenants?.length) { console.error('Could not load tenants', error?.message); process.exit(1) }
    tenantIds = tenants.map(t => t.id)
    console.log(`Pushing to ${tenantIds.length} tenants...`)
  } else if (tenantArg && !tenantArg.startsWith('-')) {
    tenantIds = [tenantArg]
  } else {
    console.error('Usage: npx tsx scripts/push-sec-swp.ts --all-tenants  OR  <tenant_id>')
    process.exit(1)
  }

  for (const TENANT_ID of tenantIds) {
    console.log(`\nTenant ${TENANT_ID}:`)
    for (const p of all) {
      const { data: existing } = await supabase.from('qhse_safe_work_procedures')
        .select('id').eq('tenant_id', TENANT_ID).eq('proc_no', p.proc_no).maybeSingle()
      const payload = { ...p, tenant_id: TENANT_ID, is_active: true, version: p.version || 'SEC' }
      delete (payload as Record<string, unknown>).hazards
      delete (payload as Record<string, unknown>).precautions
      if (existing) {
        const { error } = await supabase.from('qhse_safe_work_procedures').update(payload).eq('id', existing.id)
        if (error) console.error('UPDATE', p.proc_no, error.message)
        else console.log('Updated', p.proc_no, `(${(p.steps as unknown[])?.length || 0} steps)`)
      } else {
        const { error } = await supabase.from('qhse_safe_work_procedures').insert(payload)
        if (error) console.error('INSERT', p.proc_no, error.message)
        else console.log('Inserted', p.proc_no, `(${(p.steps as unknown[])?.length || 0} steps)`)
      }
    }
  }
  console.log('\nDone.')
}
main().catch(e => { console.error(e); process.exit(1) })
