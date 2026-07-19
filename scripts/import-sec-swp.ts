/**
 * Parse SWP docx + risk xlsx — run: npx tsx scripts/import-sec-swp.ts
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local or env
 */
import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const DOWNLOADS = 'C:\\Users\\bk606\\Downloads'

const SWP_FILES = [
  'SWP-MN-OH-05 2.docx',
  'SWP-MN-SS-05.docx',
  'SWP-MN-OH-01.docx',
  'SWP-OP-HT-04.docx',
  'SWP-MN-M-01.docx',
  'SWP-CN-PRJ-03.docx',
  'SWP-CN-PRJ-19.docx',
  'SWP-MN-C-07.docx',
  'SWP-OP-HT-11.docx',
  'SWP-CN-PRJ-12.docx',
  'SWP-MN-OH-06.docx',
  'SWP-MN-OH-08.docx',
]

function stripXml(xml: string): string {
  return xml
    .replace(/<w:tab[^/]*\/>/g, '\t')
    .replace(/<w:br[^/]*\/>/g, '\n')
    .replace(/<w:tr[^>]*>/g, '\n---ROW---\n')
    .replace(/<w:tc[^>]*>/g, '\t')
    .replace(/<w:p[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
}

function normalizeSpaces(s: string): string {
  return s.replace(/[\s\u00a0]+/g, ' ').trim()
}

function parseStepsFromTable(text: string): { step: number; text: string }[] {
  const rows = text.split('---ROW---').map(r => r.trim()).filter(Boolean)
  const stepMap = new Map<number, string>()

  for (const row of rows) {
    const numMatch = row.match(/(?:^|[\n\t])(\d{1,2})\s*$/)
    if (!numMatch) continue
    const stepNum = parseInt(numMatch[1], 10)
    if (stepNum < 1 || stepNum > 60) continue

    const firstCol = row.split(/\t{2,}/)[0] || row.split('\t')[0] || ''
    const lines = firstCol.split('\n').map(l => normalizeSpaces(l)).filter(Boolean)
    const stepLine = lines.find(l =>
      l.length > 8 &&
      /[\u0600-\u06FF]/.test(l) &&
      !/^(Hazard|Controls|Steps|Observation|List of|In each|الخطوات|الأخطار|الضوابط|ملاحظ)/i.test(l) &&
      !/^[\d\u0660-\u0669]+$/.test(l)
    )
    if (!stepLine || stepMap.has(stepNum)) continue
    stepMap.set(stepNum, stepLine.slice(0, 400))
  }

  return Array.from(stepMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([step, text]) => ({ step, text }))
}

function parseSwpFromText(procNo: string, text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && l !== '---ROW---')

  const workLine = lines.find(l => /نوع\s*العمل|المهمة/.test(l))
  let title = procNo
  if (workLine) {
    const m = workLine.match(/(?:نوع\s*العمل\s*\/?\s*المهمة\s*:?\s*)(.+)/i)
    title = normalizeSpaces(m?.[1] || workLine).slice(0, 200)
  }

  let stepLines = parseStepsFromTable(text)

  if (stepLines.length < 2) {
    const startIdx = lines.findIndex(l => /الخطوات|Steps|تسلسل/.test(l))
    if (startIdx >= 0) {
      for (let i = startIdx + 1; i < lines.length; i++) {
        const l = lines[i]
        if (/^(ملاحظ|تحذير|Warning|Note|PPE|معدات|Hazard|Controls)/i.test(l)) break
        const cleaned = l.replace(/^[\d\u0660-\u0669]+[\.\)\-\s]+/, '').trim()
        if (cleaned.length > 8) stepLines.push({ step: stepLines.length + 1, text: cleaned })
      }
    }
  }

  const workType = procNo.startsWith('SWP-MN') ? 'صيانة'
    : procNo.startsWith('SWP-OP') ? 'تشغيل'
    : procNo.startsWith('SWP-CN') ? 'إنشاءات'
    : 'SEC'

  return {
    proc_no: procNo.replace('.docx', '').trim(),
    title,
    work_type: workType,
    description: lines.slice(0, 8).join(' ').slice(0, 500) || null,
    steps: stepLines.slice(0, 40).map((s, i) => ({ step: s.step || i + 1, text: s.text })),
    approved_by: 'الشركة السعودية للكهرباء',
    hazards: null,
    precautions: null,
  }
}

async function extractDocxText(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath)
  const zip = await JSZip.loadAsync(buf)
  const doc = zip.file('word/document.xml')
  if (!doc) return ''
  const xml = await doc.async('string')
  return stripXml(xml)
}

function findRiskXlsx(): string | null {
  const files = fs.readdirSync(DOWNLOADS)
  const hit = files.find(f => f.endsWith('.xlsx') && (f.includes('2025') || f.includes('تقييم') || f.includes('(')))
  return hit ? path.join(DOWNLOADS, hit) : null
}

function parseRiskXlsx(filePath: string) {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' })
  const risks: { title: string; category: string; description: string }[] = []
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: '' })
    for (const row of rows) {
      const vals = Object.values(row).map(v => String(v).trim()).filter(Boolean)
      if (vals.length < 2) continue
      const title = vals.find(v => v.length > 5 && v.length < 120) || ''
      if (!title || /^(رقم|#|no|م\s*\/\s*o)/i.test(title)) continue
      const category = sheetName.includes('انش') || sheetName.includes('صيان') ? 'تشغيلي'
        : sheetName.includes('مخاط') ? 'سلامة' : 'فني'
      if (risks.some(r => r.title === title)) continue
      risks.push({ title, category, description: vals.slice(1, 4).join(' — ').slice(0, 300) })
    }
  }
  return risks.slice(0, 80)
}

async function main() {
  const exportOnly = process.argv.includes('--export')
  const outPath = path.join(process.cwd(), 'public', 'data', 'sec-swp-procedures.json')

  const procedures: ReturnType<typeof parseSwpFromText>[] = []

  for (const file of SWP_FILES) {
    const fp = path.join(DOWNLOADS, file)
    if (!fs.existsSync(fp)) { console.warn('Missing:', file); continue }
    const text = await extractDocxText(fp)
    const procNo = file.replace('.docx', '').replace(' 2', '')
    const parsed = parseSwpFromText(procNo, text)
    if (parsed.steps.length === 0) {
      parsed.steps = [{ step: 1, text: `اتباع إجراء ${procNo} المعتمد من SEC — راجع المرفق الأصلي` }]
    }
    procedures.push(parsed)
    console.log(`✓ ${procNo}: ${parsed.steps.length} steps — ${parsed.title.slice(0, 60)}`)
  }

  let riskTemplate: Record<string, unknown> | null = null
  const riskFile = findRiskXlsx()
  if (riskFile) {
    console.log('\nRisk file:', path.basename(riskFile))
    const risks = parseRiskXlsx(riskFile)
    console.log(`Parsed ${risks.length} risk items`)
    riskTemplate = {
      proc_no: 'SEC-RISK-TEMPLATE-2025',
      title: 'تقييم المخاطر — إدارة كهرباء الجوف 2025 (إنشاءات + صيانة)',
      work_type: 'تقييم مخاطر',
      description: `استورد من ${path.basename(riskFile)} — ${risks.length} بند`,
      steps: risks.map((r, i) => ({ step: i + 1, text: `${r.title}${r.description ? ': ' + r.description : ''}` })),
      approved_by: 'الشركة السعودية للكهرباء',
      version: '2025',
    }
  }

  if (exportOnly) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify({ procedures, riskTemplate }, null, 2), 'utf8')
    console.log('\nExported to', outPath)
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or use --export')
    process.exit(1)
  }

  const allTenants = process.argv.includes('--all-tenants')
  const tenantArg = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1] && !a.includes('tsx'))
  const supabase = createClient(url, key)

  let tenantIds: string[] = []
  if (allTenants) {
    const { data, error } = await supabase.from('tenants').select('id, name').order('name')
    if (error || !data?.length) { console.error('Could not load tenants', error?.message); process.exit(1) }
    tenantIds = data.map(t => t.id)
    console.log(`Importing for ${tenantIds.length} tenants...`)
  } else if (tenantArg) {
    tenantIds = [tenantArg]
  } else {
    console.error('Usage: npx tsx scripts/import-sec-swp.ts --all-tenants  OR  <tenant_id>  OR  --export')
    process.exit(1)
  }

  async function upsertForTenant(tenantId: string) {
    for (const p of procedures) {
      const { data: existing } = await supabase.from('qhse_safe_work_procedures')
        .select('id').eq('tenant_id', tenantId).eq('proc_no', p.proc_no).maybeSingle()
      const payload = { ...p, tenant_id: tenantId, is_active: true, version: 'SEC' }
      if (existing) {
        await supabase.from('qhse_safe_work_procedures').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('qhse_safe_work_procedures').insert(payload)
      }
    }
    if (riskTemplate) {
      const { data: existing } = await supabase.from('qhse_safe_work_procedures')
        .select('id').eq('tenant_id', tenantId).eq('proc_no', 'SEC-RISK-TEMPLATE-2025').maybeSingle()
      const riskPayload = { ...riskTemplate, tenant_id: tenantId, is_active: true, version: 'SEC' }
      if (existing) {
        await supabase.from('qhse_safe_work_procedures').update(riskPayload).eq('id', existing.id)
      } else {
        await supabase.from('qhse_safe_work_procedures').insert(riskPayload)
      }
    }
  }

  for (const tenantId of tenantIds) {
    await upsertForTenant(tenantId)
    console.log(`✓ Tenant ${tenantId}: ${procedures.length} SWP + risk template`)
  }

  console.log('\nDone.')
}

main().catch(e => { console.error(e); process.exit(1) })
