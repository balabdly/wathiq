/**
 * Push exported sec-swp-procedures.json to Supabase via SQL batches.
 * Run: npx tsx scripts/push-sec-swp-sql.ts > /tmp/swp-import.sql
 * Then apply via Supabase MCP execute_sql (or psql).
 */
import fs from 'fs'
import path from 'path'

const TENANT_ID = process.argv[2] || '0ab73907-7cb3-4cbc-8b29-05f6f531190a'
const jsonPath = path.join(process.cwd(), 'public', 'data', 'sec-swp-procedures.json')
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as {
  procedures: Array<Record<string, unknown>>
  riskTemplate: Record<string, unknown> | null
}

function esc(s: string): string {
  return s.replace(/'/g, "''")
}

function upsertSql(p: Record<string, unknown>) {
  const procNo = esc(String(p.proc_no))
  const steps = esc(JSON.stringify(p.steps || []))
  return `
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM qhse_safe_work_procedures WHERE tenant_id = '${TENANT_ID}' AND proc_no = '${procNo}') THEN
    UPDATE qhse_safe_work_procedures SET
      title = '${esc(String(p.title))}',
      work_type = '${esc(String(p.work_type || ''))}',
      description = ${p.description ? `'${esc(String(p.description))}'` : 'NULL'},
      steps = '${steps}'::jsonb,
      approved_by = '${esc(String(p.approved_by || ''))}',
      is_active = true,
      version = 'SEC'
    WHERE tenant_id = '${TENANT_ID}' AND proc_no = '${procNo}';
  ELSE
    INSERT INTO qhse_safe_work_procedures (tenant_id, proc_no, title, work_type, description, steps, approved_by, is_active, version)
    VALUES ('${TENANT_ID}', '${procNo}', '${esc(String(p.title))}', '${esc(String(p.work_type || ''))}',
      ${p.description ? `'${esc(String(p.description))}'` : 'NULL'},
      '${steps}'::jsonb, '${esc(String(p.approved_by || ''))}', true, 'SEC');
  END IF;
END $$;`
}

console.log('-- SEC SWP import for tenant', TENANT_ID)
for (const p of data.procedures) console.log(upsertSql(p))
if (data.riskTemplate) console.log(upsertSql({ ...data.riskTemplate, proc_no: 'SEC-RISK-TEMPLATE-2025' }))
console.log('-- Done:', data.procedures.length, 'SWP + risk template')
