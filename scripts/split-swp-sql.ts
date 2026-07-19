/** Output one SQL statement per line block for MCP import */
import fs from 'fs'
import path from 'path'

const TENANT_ID = process.argv[2] || '0ab73907-7cb3-4cbc-8b29-05f6f531190a'
const outDir = path.join(process.cwd(), 'scripts', 'swp-sql-chunks')
fs.mkdirSync(outDir, { recursive: true })

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'sec-swp-procedures.json'), 'utf8'))

function esc(s: string) { return s.replace(/'/g, "''") }

function upsertSql(p: Record<string, unknown>) {
  const procNo = esc(String(p.proc_no))
  const steps = esc(JSON.stringify(p.steps || []))
  return `DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM qhse_safe_work_procedures WHERE tenant_id = '${TENANT_ID}' AND proc_no = '${procNo}') THEN
    UPDATE qhse_safe_work_procedures SET title='${esc(String(p.title))}', work_type='${esc(String(p.work_type||''))}',
      description=${p.description ? `'${esc(String(p.description))}'` : 'NULL'}, steps='${steps}'::jsonb,
      approved_by='${esc(String(p.approved_by||''))}', is_active=true, version='SEC'
    WHERE tenant_id='${TENANT_ID}' AND proc_no='${procNo}';
  ELSE
    INSERT INTO qhse_safe_work_procedures (tenant_id, proc_no, title, work_type, description, steps, approved_by, is_active, version)
    VALUES ('${TENANT_ID}','${procNo}','${esc(String(p.title))}','${esc(String(p.work_type||''))}',
      ${p.description ? `'${esc(String(p.description))}'` : 'NULL'}, '${steps}'::jsonb,
      '${esc(String(p.approved_by||''))}', true, 'SEC');
  END IF; END $$;`
}

const all = [...data.procedures, ...(data.riskTemplate ? [{ ...data.riskTemplate, proc_no: 'SEC-RISK-TEMPLATE-2025' }] : [])]
all.forEach((p, i) => {
  fs.writeFileSync(path.join(outDir, `${String(i).padStart(2, '0')}-${p.proc_no}.sql`), upsertSql(p), 'utf8')
})
console.log('Wrote', all.length, 'chunks to', outDir)
