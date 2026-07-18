/** Parse sec-contract-items.csv lines (quoted descriptions) */
export function parseSecBoqCsv(text: string) {
  const lines = text.split(/\r?\n/).slice(1).filter(l => l.trim())
  return lines.map(line => {
    const parts: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { inQ = !inQ; continue }
      if (c === ',' && !inQ) { parts.push(cur); cur = ''; continue }
      cur += c
    }
    parts.push(cur)
    const [item_code, unit, unit_price, description] = parts
    const price = parseFloat(unit_price)
    if (!item_code || isNaN(price)) return null
    return {
      item_code: item_code.trim(),
      unit: (unit || 'EA').trim(),
      unit_price: price,
      description_ar: (description || '').trim(),
      description_en: (description || '').trim(),
    }
  }).filter(Boolean) as {
    item_code: string; unit: string; unit_price: number
    description_ar: string; description_en: string
  }[]
}
