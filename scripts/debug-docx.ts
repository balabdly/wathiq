import fs from 'fs'
import JSZip from 'jszip'

async function main() {
const fp = 'C:\\Users\\bk606\\Downloads\\SWP-MN-OH-05 2.docx'
const zip = await JSZip.loadAsync(fs.readFileSync(fp))
const xml = await zip.file('word/document.xml')!.async('string')

function stripWithBreaks(xml: string): string {
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
}

const text = stripWithBreaks(xml)
const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
console.log('Total lines:', lines.length)
for (const r of rows) {
  if (/^1$/.test(r.split('\t').pop()?.trim() || '') || r.endsWith('\n1') || /\t1$/.test(r)) {
    console.log('ROW for step 1:', JSON.stringify(r.slice(0, 400)))
  }
}
console.log('\nRows 8-12:')
rows.slice(8, 13).forEach((r, i) => console.log(i+8, JSON.stringify(r.slice(0, 300))))
}
main()
