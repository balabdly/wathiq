/**
 * استيراد قائمة مواد SEC من ملف SE MAT.xlsx إلى مستودع المشاريع
 * الاستخدام: node scripts/import-se-mat.mjs [مسار_الملف]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) throw new Error('ملف .env.local غير موجود')
  let text = fs.readFileSync(envPath, 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

const UNIT_MAP = {
  MTR: 'متر',
  M: 'متر',
  EA: 'قطعة',
  PCS: 'قطعة',
  PC: 'قطعة',
  KIT: 'علبة',
  ROLL: 'رول',
}

function mapUnit(raw) {
  const key = String(raw || '').trim().toUpperCase()
  return UNIT_MAP[key] || 'قطعة'
}

function parseRows(filePath) {
  const wb = XLSX.readFile(filePath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  const rows = []
  const seenSec = new Set()

  for (const r of raw) {
    const itemNo = String(r['Item No'] || r['item no'] || r['ITEM NO'] || '').trim()
    const desc = String(r.Description || r['DESCRIPTION'] || r['description'] || '').trim()
    const unit = mapUnit(r.Unit || r['UNIT'])
    if (!itemNo || !desc) continue
    if (seenSec.has(itemNo)) continue
    seenSec.add(itemNo)
    rows.push({
      name: desc,
      unit,
      catalog_no: itemNo,
      sec_number: itemNo,
      mat_code: itemNo,
      item_code: itemNo,
      source: 'SEC',
      qty: 0,
      reorder: 0,
      is_active: true,
    })
  }
  return rows
}

async function main() {
  const filePath = process.argv[2] || 'C:/Users/bk606/OneDrive/Desktop/SE MAT.xlsx'
  if (!fs.existsSync(filePath)) throw new Error(`الملف غير موجود: ${filePath}`)

  const env = loadEnvLocal()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SUPABASE URL/KEY مفقود في .env.local')

  const supabase = createClient(url, key)
  const materials = parseRows(filePath)
  console.log(`جاهز للاستيراد: ${materials.length} مادة من ${path.basename(filePath)}`)

  const { data: warehouses, error: whErr } = await supabase
    .from('warehouses')
    .select('id, name, tenant_id, branch_id, wh_category')
    .or('name.ilike.%مشاريع%,wh_category.eq.مشاريع')

  if (whErr) throw new Error(whErr.message)
  if (!warehouses?.length) throw new Error('لم يُعثر على مستودع المشاريع')

  const wh = warehouses.find(w => w.name.includes('مشاريع'))
    || warehouses.find(w => w.wh_category === 'مشاريع')
    || warehouses[0]

  console.log(`المستودع: ${wh.name} (id=${wh.id}, tenant=${wh.tenant_id})`)

  const { data: existing } = await supabase
    .from('materials')
    .select('id, sec_number, catalog_no, name')
    .eq('tenant_id', wh.tenant_id)
    .eq('warehouse_id', wh.id)

  const bySec = new Map((existing || []).map(m => [String(m.sec_number || ''), m]))
  const byName = new Map((existing || []).map(m => [m.name, m]))

  let added = 0
  let updated = 0
  let skipped = 0
  const BATCH = 50

  for (let i = 0; i < materials.length; i += BATCH) {
    const batch = materials.slice(i, i + BATCH)
    const toInsert = []

    for (const m of batch) {
      const prev = bySec.get(m.sec_number) || byName.get(m.name)
      if (prev) {
        const { error: updErr } = await supabase.from('materials').update({
          unit: m.unit,
          source: m.source,
          catalog_no: m.catalog_no,
          sec_number: m.sec_number,
          mat_code: m.mat_code,
          item_code: m.item_code,
          is_active: true,
        }).eq('id', prev.id)
        if (updErr) {
          console.error(`تحديث ${m.sec_number}:`, updErr.message)
          skipped++
        } else {
          updated++
        }
      } else {
        toInsert.push({
          ...m,
          tenant_id: wh.tenant_id,
          branch_id: wh.branch_id,
          warehouse_id: wh.id,
        })
      }
    }

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('materials').insert(toInsert)
      if (insErr) {
        console.error('خطأ دفعة:', insErr.message)
        for (const row of toInsert) {
          const { error: oneErr } = await supabase.from('materials').insert(row)
          if (oneErr) {
            console.error(`  ✗ ${row.sec_number} ${row.name.slice(0, 40)}: ${oneErr.message}`)
            skipped++
          } else {
            added++
          }
        }
      } else {
        added += toInsert.length
      }
    }

    process.stdout.write(`\r${Math.min(i + BATCH, materials.length)}/${materials.length}`)
  }

  console.log(`\n✅ انتهى — أُضيف ${added} | حُدّث ${updated} | تخطي ${skipped}`)
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
