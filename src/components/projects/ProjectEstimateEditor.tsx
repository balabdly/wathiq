'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useStore } from '@/hooks/useStore'
import { fetchBoqVersions, createBoqVersion, activateBoqVersion, replaceBoqVersionLines, formatSupabaseError, resolveBoqVersionForSave } from '@/lib/pmc-service'
import { updateProjectPlanning } from '@/lib/project-planning-service'
import { supabase } from '@/lib/supabase'
import type { ProjectBoqLine } from '@/lib/pmc-types'
import type { BoqRevisionSnapshotLine, ProjectPlanning } from '@/lib/project-planning-service'
import { fetchPlanningMaterialLines, parseMaterialsSpreadsheet } from '@/lib/planning-material-lines-service'
import { findMaterialBySecCode, lookupSecCodeMap, normalizeSecItemCode, resolveSecDisplayCode } from '@/lib/sec-item-code'
import ImportQuantitiesModal, { BoqLineStatusBadge, type BoqImportKind } from '@/components/projects/ImportQuantitiesModal'
import { MaterialsReservationBlock, type MaterialsReservationHandle } from '@/components/projects/BoqReservationPanel'
import {
  type BoqImportLine,
  type BoqLineSource,
  type BoqMatchStatus,
  buildFrameworkMap,
} from '@/lib/project-boq-import'
import { Plus, Save, Trash2, FileSpreadsheet, FileText, Image, Package, HardHat } from 'lucide-react'
import toast from 'react-hot-toast'

export type BoqLineCategory = 'MATERIAL' | 'WORK'

type LineRow = BoqImportLine & { qty_previous?: number; line_category: BoqLineCategory; is_new?: boolean }

const SECTION_STYLE = {
  MATERIAL: { headerBg: '#eef2ff', headerBorder: '#c7d2fe', titleColor: '#4338ca', rowTint: '#faf5ff' },
  WORK: { headerBg: '#eff6ff', headerBorder: '#bfdbfe', titleColor: '#1a56db', rowTint: '#f8fafc' },
} as const

function emptyLine(category: BoqLineCategory): LineRow {
  return {
    item_code: '',
    description: '',
    unit: category === 'MATERIAL' ? 'قطعة' : 'EA',
    qty: category === 'MATERIAL' ? 0 : 1,
    unit_price: 0,
    source: 'manual',
    matchStatus: 'manual',
    qty_previous: category === 'MATERIAL' ? 0 : undefined,
    line_category: category,
  }
}

function inferMatchStatus(itemCode: string, frameworkMap: Map<string, { item_code: string }>): BoqMatchStatus {
  if (!itemCode.trim()) return 'manual'
  return lookupSecCodeMap(frameworkMap, itemCode) ? 'matched' : 'review'
}

function resolveCategory(line: ProjectBoqLine & { line_category?: string | null }): BoqLineCategory {
  if (line.line_category === 'MATERIAL' || line.line_category === 'WORK') return line.line_category
  if (line.notes?.includes('line_category:MATERIAL')) return 'MATERIAL'
  if (line.material_id) return 'MATERIAL'
  return 'WORK'
}

function parsePrevQty(notes?: string | null): number | undefined {
  if (!notes) return undefined
  const m = notes.match(/prev_qty:([\d.]+)/)
  return m ? Number(m[1]) : undefined
}

function buildNotes(category: BoqLineCategory, trackPrevQty: boolean, qtyPrevious?: number, isNew?: boolean): string | null {
  const parts: string[] = [`line_category:${category}`]
  if (isNew) parts.push('is_new:1')
  if (trackPrevQty && qtyPrevious != null && !isNew) parts.push(`prev_qty:${qtyPrevious}`)
  return parts.join('|')
}

function isNewLineFromNotes(notes?: string | null): boolean {
  return !!notes?.includes('is_new:1')
}

function mergeRevisionCategoryRows(
  currentRows: LineRow[],
  snapshotRows: BoqRevisionSnapshotLine[],
  category: BoqLineCategory,
): LineRow[] {
  const snaps = snapshotRows.filter(s => (s.line_category || 'WORK') === category)
  const byDesc = new Map(currentRows.map(r => [r.description.trim(), r]))
  const merged: LineRow[] = []

  for (const row of currentRows) {
    const snap = snaps.find(s => s.description.trim() === row.description.trim())
    merged.push({
      ...row,
      qty_previous: snap ? Number(snap.qty) : (row.qty_previous ?? Number(row.qty)),
    })
  }

  for (const snap of snaps) {
    const desc = snap.description.trim()
    if (!desc || byDesc.has(desc)) continue
    merged.push({
      ...emptyLine(category),
      description: snap.description,
      unit: snap.unit,
      qty: Number(snap.qty),
      qty_previous: Number(snap.qty),
      item_code: snap.catalog_no || '',
      unit_price: Number(snap.unit_price || 0),
    })
  }

  return merged.length ? merged : [emptyLine(category)]
}

type FrameworkBoqRow = {
  id: number
  item_code: string
  description_ar?: string
  unit: string
  unit_price: number
}

type MaterialCatalogRow = {
  id: number
  name: string
  unit: string
  catalog_no?: string | null
  sec_number?: string | null
}

function normalizeItemCode(v: string): string {
  return normalizeSecItemCode(v)
}

function enrichMaterialSecLookup(row: LineRow, catalog: MaterialCatalogRow[]): LineRow {
  if (row.line_category !== 'MATERIAL') return row
  const trimmed = row.item_code.trim()
  if (!trimmed) return row
  const mat = findMaterialBySecCode(catalog, trimmed)
  if (!mat) return row
  return {
    ...row,
    item_code: resolveSecDisplayCode(trimmed, mat),
    description: mat.name || row.description,
    unit: mat.unit || row.unit,
    warehouse_material_id: mat.id,
  }
}

const IMPORT_BTN = {
  excel: { border: '1px solid #bfdbfe', color: '#1a56db', label: 'Excel / CSV' },
  pdf: { border: '1px solid #fecaca', color: '#c81e1e', label: 'PDF' },
  image: { border: '1px solid #ddd6fe', color: '#7c3aed', label: 'صورة UDS' },
} as const

function SectionImportButtons({
  onImport,
}: {
  onImport: (kind: BoqImportKind) => void
}) {
  return (
    <>
      {(Object.keys(IMPORT_BTN) as BoqImportKind[]).map(kind => {
        const cfg = IMPORT_BTN[kind]
        const Icon = kind === 'excel' ? FileSpreadsheet : kind === 'pdf' ? FileText : Image
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onImport(kind)}
            className="btn btn-ghost"
            style={{ fontSize: '0.72rem', padding: '4px 8px', border: cfg.border, color: cfg.color, background: 'white' }}
            title={`استيراد ${cfg.label}`}
          >
            <Icon style={{ width: '12px', height: '12px' }} /> {cfg.label}
          </button>
        )
      })}
    </>
  )
}

function EstimateSectionTable({
  category,
  title,
  icon,
  lines,
  lineIndices,
  frameworkItems,
  frameworkMap,
  readOnly,
  isRevision,
  onUpdate,
  onSelectFramework,
  onRemove,
  onAdd,
  onImport,
  onMaterialSecLookup,
  reservationSlot,
}: {
  category: BoqLineCategory
  title: string
  icon: React.ReactNode
  lines: LineRow[]
  lineIndices: number[]
  frameworkItems: FrameworkBoqRow[]
  frameworkMap: Map<string, { item_code: string; unit_price?: number }>
  readOnly: boolean
  isRevision: boolean
  onUpdate: (globalIdx: number, key: keyof LineRow, val: string | number) => void
  onSelectFramework: (globalIdx: number, code: string) => void
  onRemove: (globalIdx: number) => void
  onAdd: () => void
  onImport?: (kind: BoqImportKind) => void
  onMaterialSecLookup?: (globalIdx: number, query: string) => void
  reservationSlot?: React.ReactNode
}) {
  const style = SECTION_STYLE[category]
  const qtyHeaders = isRevision ? ['الكمية السابقة', 'الكمية المعدّلة'] : ['الكمية']
  const sectionTotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const sectionPrevTotal = isRevision ? lines.reduce((s, l) => s + (l.qty_previous ?? 0) * l.unit_price, 0) : 0

  return (
    <div style={{ borderRadius: '12px', border: `2px solid ${style.headerBorder}`, overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', background: style.headerBg, borderBottom: `1px solid ${style.headerBorder}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
      }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: style.titleColor, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon} {title}
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {onImport && (
              <SectionImportButtons onImport={onImport} />
            )}
            <button type="button" onClick={onAdd} className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '4px 10px', color: style.titleColor, border: `1px solid ${style.headerBorder}`, background: 'white' }}>
              <Plus style={{ width: '12px', height: '12px' }} /> بند
            </button>
          </div>
        )}
      </div>

      {reservationSlot}

      <div style={{ overflow: 'auto', background: style.rowTint }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: style.headerBg }}>
              {category === 'WORK' && frameworkItems.length > 0 && (
                <th style={{ padding: '8px', fontSize: '0.72rem', color: style.titleColor, textAlign: 'right' }}>من العقد</th>
              )}
              {category === 'WORK' && (
                <th style={{ padding: '8px', fontSize: '0.72rem', color: style.titleColor, textAlign: 'right' }}>الحالة</th>
              )}
              {category === 'MATERIAL' && (
                <th style={{ padding: '8px', fontSize: '0.72rem', color: style.titleColor, textAlign: 'right', minWidth: '110px' }}>SEC#</th>
              )}
              <th style={{ padding: '8px', fontSize: '0.72rem', color: style.titleColor, textAlign: 'right' }}>الوصف</th>
              {qtyHeaders.map(h => (
                <th key={h} style={{ padding: '8px', fontSize: '0.72rem', color: style.titleColor, textAlign: 'right' }}>{h}</th>
              ))}
              <th style={{ padding: '8px', fontSize: '0.72rem', color: style.titleColor, textAlign: 'right' }}>الوحدة</th>
              <th style={{ padding: '8px', fontSize: '0.72rem', color: style.titleColor, textAlign: 'right' }}>سعر الوحدة</th>
              <th style={{ padding: '8px', fontSize: '0.72rem', color: style.titleColor, textAlign: 'right' }}>الإجمالي</th>
              <th style={{ padding: '8px' }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, localIdx) => {
              const globalIdx = lineIndices[localIdx]
              const qtyChanged = isRevision && line.qty_previous != null && line.qty !== line.qty_previous
              const isNewRow = !!line.is_new
              const canEditDetails = !readOnly && (!isRevision || isNewRow)
              const canEditQty = !readOnly
              const canEditPrice = canEditDetails && !(category === 'WORK' && line.matchStatus === 'matched' && line.unit_price > 0 && !isNewRow)
              return (
                <tr key={globalIdx} style={{
                  borderTop: `1px solid ${style.headerBorder}`,
                  background: qtyChanged ? '#fffbeb55' : isNewRow ? '#ecfdf533' : undefined,
                }}>
                  {category === 'WORK' && frameworkItems.length > 0 && (
                    <td style={{ padding: '6px 8px', minWidth: '140px' }}>
                      {(!isRevision || isNewRow) ? (
                        <select value={line.item_code} onChange={e => onSelectFramework(globalIdx, e.target.value)} disabled={readOnly}
                          style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                          <option value="">—</option>
                          {frameworkItems.slice(0, 200).map(f => (
                            <option key={f.item_code} value={f.item_code}>{f.item_code}</option>
                          ))}
                        </select>
                      ) : null}
                    </td>
                  )}
                  {category === 'WORK' && (
                    <td style={{ padding: '6px 8px' }}>
                      {(!isRevision || isNewRow) ? <BoqLineStatusBadge status={line.matchStatus} /> : null}
                    </td>
                  )}
                  {category === 'MATERIAL' && (
                    <td style={{ padding: '6px 8px', minWidth: '110px' }}>
                      {canEditDetails ? (
                        <input
                          list="sec-material-catalog"
                          value={line.item_code}
                          onChange={e => onUpdate(globalIdx, 'item_code', e.target.value)}
                          onBlur={e => onMaterialSecLookup?.(globalIdx, e.target.value)}
                          className="input"
                          style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
                          placeholder="SEC#"
                          dir="ltr"
                        />
                      ) : (
                        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#6b7280' }} dir="ltr">{line.item_code || '—'}</span>
                      )}
                    </td>
                  )}
                  <td style={{ padding: '6px 8px', minWidth: '160px' }}>
                    {isNewRow && isRevision && (
                      <span style={{ display: 'block', fontSize: '0.62rem', color: '#0ea77b', fontWeight: 700, marginBottom: '2px' }}>بند جديد</span>
                    )}
                    <input value={line.description} onChange={e => onUpdate(globalIdx, 'description', e.target.value)} className="input" style={{ fontSize: '0.8rem' }} readOnly={!canEditDetails} placeholder={category === 'MATERIAL' ? 'المادة' : 'البند'} />
                  </td>
                  {isRevision && (
                    <td style={{ padding: '6px 8px', width: '80px' }}>
                      <div style={{ padding: '5px', borderRadius: '6px', background: '#f3f4f6', fontWeight: 700, textAlign: 'center', fontSize: '0.8rem', color: '#6b7280' }} dir="ltr">
                        {(line.qty_previous ?? 0).toLocaleString('ar-SA')}
                      </div>
                    </td>
                  )}
                  <td style={{ padding: '6px 8px', width: '80px' }}>
                    <input type="number" min="0" step="0.01" value={line.qty} onChange={e => onUpdate(globalIdx, 'qty', Number(e.target.value))} className="input" style={{ fontSize: '0.8rem', borderColor: qtyChanged ? '#fcd34d' : undefined, fontWeight: qtyChanged ? 700 : 400 }} dir="ltr" readOnly={!canEditQty} />
                  </td>
                  <td style={{ padding: '6px 8px', width: '64px' }}>
                    <input value={line.unit} onChange={e => onUpdate(globalIdx, 'unit', e.target.value)} className="input" style={{ fontSize: '0.8rem' }} readOnly={!canEditDetails} />
                  </td>
                  <td style={{ padding: '6px 8px', width: '80px' }}>
                    <input type="number" min="0" value={line.unit_price} onChange={e => onUpdate(globalIdx, 'unit_price', Number(e.target.value))} className="input" style={{ fontSize: '0.8rem' }} dir="ltr"
                      readOnly={!canEditPrice} />
                  </td>
                  <td style={{ padding: '6px 8px', fontWeight: 700, color: qtyChanged ? '#e6820a' : '#0ea77b', whiteSpace: 'nowrap' }}>
                    {(line.qty * line.unit_price).toLocaleString('ar-SA')}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {!readOnly && (!isRevision || isNewRow) && (
                      <button type="button" onClick={() => onRemove(globalIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}>
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 16px', background: style.headerBg, borderTop: `1px solid ${style.headerBorder}`, display: 'flex', justifyContent: 'flex-end', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem' }}>
        {isRevision && (
          <span style={{ color: '#6b7280' }}>إجمالي {title} السابق: <strong>{sectionPrevTotal.toLocaleString('ar-SA')}</strong> ر.س</span>
        )}
        <span style={{ fontWeight: 800, color: style.titleColor }}>
          {isRevision ? 'المعدّل' : 'الإجمالي'}: {sectionTotal.toLocaleString('ar-SA')} ر.س
        </span>
      </div>
    </div>
  )
}

export default function ProjectEstimateEditor({
  projectId,
  frameworkItems,
  onSaved,
  readOnly = false,
  isRevision = false,
  revisionSnapshot = [],
  saveLabel = 'حفظ المقايسة',
  tenantId,
  projectName,
  clientName,
  planning,
  onPlanningSaved,
}: {
  projectId: number
  frameworkItems: FrameworkBoqRow[]
  onSaved?: () => void
  readOnly?: boolean
  isRevision?: boolean
  revisionSnapshot?: BoqRevisionSnapshotLine[]
  saveLabel?: string
  tenantId?: string
  projectName?: string
  clientName?: string
  planning?: ProjectPlanning | null
  onPlanningSaved?: () => void
}) {
  const { tenant, currentUser } = useStore()
  const [lines, setLines] = useState<LineRow[]>([emptyLine('MATERIAL'), emptyLine('WORK')])
  const [versionId, setVersionId] = useState<number | null>(null)
  const reservationRef = useRef<MaterialsReservationHandle>(null)
  const [loadingBoq, setLoadingBoq] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importKind, setImportKind] = useState<BoqImportKind>('excel')
  const [importTarget, setImportTarget] = useState<BoqLineCategory>('WORK')
  const materialExcelRef = useRef<HTMLInputElement>(null)
  const [totalOverride, setTotalOverride] = useState<string>('')
  const [totalNote, setTotalNote] = useState('')
  const [useOverride, setUseOverride] = useState(false)
  const [materialCatalog, setMaterialCatalog] = useState<MaterialCatalogRow[]>([])

  const frameworkMap = useMemo(() => buildFrameworkMap(frameworkItems), [frameworkItems])

  const snapshotByKey = useMemo(() => {
    const map = new Map<string, BoqRevisionSnapshotLine>()
    for (const row of revisionSnapshot) {
      const cat = row.line_category || 'WORK'
      map.set(`${cat}:${row.description}:${row.line_no || 0}`, row)
    }
    return map
  }, [revisionSnapshot])

  useEffect(() => {
    if (!tenant) return
    supabase.from('materials')
      .select('id, name, unit, catalog_no, sec_number')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setMaterialCatalog((data || []) as MaterialCatalogRow[]))
  }, [tenant?.id])

  useEffect(() => {
    if (!planning) return
    const ov = (planning as { estimate_total_override?: number | null }).estimate_total_override
    const note = (planning as { estimate_total_note?: string | null }).estimate_total_note
    if (ov != null && Number(ov) > 0) {
      setUseOverride(true)
      setTotalOverride(String(ov))
      setTotalNote(note || '')
    } else {
      setUseOverride(false)
      setTotalOverride('')
      setTotalNote('')
    }
  }, [planning?.id, planning?.updated_at])

  useEffect(() => {
    if (!tenant || !projectId) return
    loadBoq()
  }, [tenant?.id, projectId, frameworkMap, isRevision, snapshotByKey])

  function mapDbLine(l: ProjectBoqLine & { line_category?: string | null }, snap?: BoqRevisionSnapshotLine): LineRow {
    const cat = resolveCategory(l)
    const code = l.catalog_no || ''
    const fw = code ? lookupSecCodeMap(frameworkMap, code) : undefined
    const isNew = isNewLineFromNotes(l.notes)
    const row: LineRow = {
      item_code: code,
      description: l.description,
      unit: l.unit,
      qty: Number(l.qty_planned),
      qty_previous: snap ? Number(snap.qty) : (isRevision && !isNew ? (parsePrevQty(l.notes) ?? Number(l.qty_planned)) : undefined),
      unit_price: fw ? Number(fw.unit_price) : 0,
      source: 'manual' as BoqLineSource,
      matchStatus: inferMatchStatus(code, frameworkMap),
      line_category: cat,
      is_new: isNew || undefined,
      warehouse_material_id: l.material_id ?? null,
    }
    return cat === 'MATERIAL' ? enrichMaterialSecLookup(row, materialCatalog) : row
  }

  async function loadBoq() {
    if (!tenant) return
    setLoadingBoq(true)
    const { data } = await fetchBoqVersions(tenant.id, projectId)
    const active = (data || []).find(v => v.status === 'ACTIVE') || (data || []).find(v => v.version_type === 'INITIAL')

    let materialRows: LineRow[] = []
    let workRows: LineRow[] = []

    if (active) {
      setVersionId(active.id)
      if (active.lines?.length) {
        for (const l of active.lines) {
          const cat = resolveCategory(l)
          const snap = snapshotByKey.get(`${cat}:${l.description}:${l.line_no || 0}`)
          const row = mapDbLine(l, snap)
          if (cat === 'MATERIAL') materialRows.push(row)
          else workRows.push(row)
        }
      }
    } else {
      setVersionId(null)
    }

    if (!materialRows.length) {
      const { data: legacyMat } = await fetchPlanningMaterialLines(tenant.id, projectId)
      if (legacyMat?.length) {
        materialRows = legacyMat.filter(l => l.description.trim()).map(l => ({
          ...emptyLine('MATERIAL'),
          description: l.description,
          unit: l.unit || 'قطعة',
          qty: Number(l.qty_planned) || 0,
          item_code: l.catalog_no || '',
        }))
      }
    }

    if (isRevision && revisionSnapshot.length) {
      materialRows = mergeRevisionCategoryRows(materialRows, revisionSnapshot, 'MATERIAL')
      workRows = mergeRevisionCategoryRows(workRows, revisionSnapshot, 'WORK')
    }

    if (!materialRows.length) materialRows = [emptyLine('MATERIAL')]
    if (!workRows.length) workRows = [emptyLine('WORK')]

    setLines([...materialRows, ...workRows])
    setLoadingBoq(false)
  }

  const materialLines = lines.filter(l => l.line_category === 'MATERIAL')
  const workLines = lines.filter(l => l.line_category === 'WORK')
  const materialIndices = lines.map((l, i) => l.line_category === 'MATERIAL' ? i : -1).filter(i => i >= 0)
  const workIndices = lines.map((l, i) => l.line_category === 'WORK' ? i : -1).filter(i => i >= 0)

  function updateLine(idx: number, key: keyof LineRow, val: string | number) {
    setLines(prev => {
      const next = [...prev]
      const row = { ...next[idx], [key]: val }
      if (key === 'item_code' || key === 'description') row.matchStatus = inferMatchStatus(String(row.item_code), frameworkMap)
      next[idx] = row.line_category === 'MATERIAL' && key === 'item_code'
        ? enrichMaterialSecLookup(row, materialCatalog)
        : row
      return next
    })
  }

  function selectFramework(idx: number, itemCode: string) {
    let item = frameworkItems.find(f => f.item_code === itemCode)
    if (!item) {
      const fw = lookupSecCodeMap(frameworkMap, itemCode)
      if (fw) item = frameworkItems.find(f => f.item_code === fw.item_code)
    }
    if (!item) return
    setLines(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], item_code: item.item_code, description: item.description_ar || item.item_code, unit: item.unit, unit_price: item.unit_price, matchStatus: 'matched' }
      return next
    })
  }

  function applyMaterialSecLookup(idx: number, query: string) {
    const trimmed = query.trim()
    if (!trimmed) {
      updateLine(idx, 'item_code', '')
      return
    }
    const mat = findMaterialBySecCode(materialCatalog, trimmed)
    setLines(prev => {
      const next = [...prev]
      const base = { ...next[idx], item_code: trimmed }
      if (!mat) {
        next[idx] = base
        return next
      }
      next[idx] = {
        ...base,
        item_code: resolveSecDisplayCode(trimmed, mat),
        description: mat.name,
        unit: mat.unit || next[idx].unit,
        warehouse_material_id: mat.id,
      }
      return next
    })
  }

  function addLine(category: BoqLineCategory) {
    setLines(l => [...l, {
      ...emptyLine(category),
      is_new: isRevision || undefined,
      qty_previous: isRevision ? 0 : undefined,
    }])
  }

  function removeLine(idx: number) {
    const cat = lines[idx]?.line_category
    if (lines.filter(l => l.line_category === cat).length <= 1) return
    setLines(l => l.filter((_, i) => i !== idx))
  }

  function appendImportedRows(category: BoqLineCategory, imported: BoqImportLine[]) {
    const newRows = imported.filter(r => r.description.trim()).map(r => ({
      ...r,
      line_category: category,
      unit: r.unit || (category === 'MATERIAL' ? 'قطعة' : 'EA'),
      is_new: isRevision || undefined,
      qty_previous: isRevision ? 0 : undefined,
      warehouse_material_id: r.warehouse_material_id ?? null,
    })) as LineRow[]
    setLines(prev => {
      const mats = prev.filter(l => l.line_category === 'MATERIAL')
      const works = prev.filter(l => l.line_category === 'WORK')
      if (category === 'MATERIAL') {
        const kept = mats.filter(l => l.description.trim() || l.is_new)
        return [...(kept.length ? kept : isRevision ? [] : [emptyLine('MATERIAL')]), ...newRows, ...works]
      }
      const kept = works.filter(l => l.description.trim() || l.is_new)
      return [...mats, ...(kept.length ? kept : isRevision ? [] : [emptyLine('WORK')]), ...newRows]
    })
  }

  function handleImportApply(imported: BoqImportLine[]) {
    if (isRevision) {
      toast.success(`تمت إضافة ${imported.length} بند ${importTarget === 'MATERIAL' ? 'مواد' : 'أعمال'}`)
      appendImportedRows(importTarget, imported)
      setImportModalOpen(false)
      return
    }
    setLines(prev => {
      const mats = prev.filter(l => l.line_category === 'MATERIAL')
      const works = prev.filter(l => l.line_category === 'WORK')
      if (importTarget === 'MATERIAL') {
        const newMats = imported.length
          ? imported.map(r => ({ ...r, line_category: 'MATERIAL' as const, unit: r.unit || 'قطعة' })) as LineRow[]
          : [emptyLine('MATERIAL')]
        toast.success(`تم استيراد ${newMats.length} بند مواد`)
        return [...newMats, ...works]
      }
      const newWorks = imported.length
        ? imported.map(r => ({ ...r, line_category: 'WORK' as const }))
        : [emptyLine('WORK')]
      return [...mats, ...newWorks]
    })
    setImportModalOpen(false)
  }

  function openImport(category: BoqLineCategory, kind: BoqImportKind) {
    setImportTarget(category)
    if (category === 'MATERIAL' && kind === 'excel') {
      materialExcelRef.current?.click()
      return
    }
    setImportKind(kind)
    setImportModalOpen(true)
  }

  async function handleMaterialExcelPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const rows = await parseMaterialsSpreadsheet(file)
      let imported = rows.filter(r => r.description.trim()).map(r => ({
        ...emptyLine('MATERIAL'),
        description: r.description,
        unit: r.unit || 'قطعة',
        qty: Number(r.qty_planned) || 0,
        item_code: r.catalog_no || '',
      })) as LineRow[]
      if (isRevision) {
        appendImportedRows('MATERIAL', imported)
        toast.success(`تم استيراد ${imported.length} بند مواد`)
        return
      }
      setLines(prev => {
        const works = prev.filter(l => l.line_category === 'WORK')
        return [...(imported.length ? imported : [emptyLine('MATERIAL')]), ...works]
      })
      toast.success(`تم استيراد ${imported.length} بند مواد`)
    } catch {
      toast.error('تعذّر قراءة ملف Excel')
    }
  }

  const totalMaterials = materialLines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const totalWorks = workLines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const grandTotal = totalMaterials + totalWorks
  const overrideNum = useOverride && totalOverride.trim() ? parseFloat(totalOverride) : null
  const effectiveTotal = overrideNum != null && !Number.isNaN(overrideNum) ? overrideNum : grandTotal
  const totalDiffersFromLines = useOverride && overrideNum != null && Math.abs(overrideNum - grandTotal) > 0.01

  async function handleSave() {
    if (!tenant || readOnly) return
    const validMats = materialLines.filter(l => l.description.trim())
    const validWorks = workLines.filter(l => l.description.trim() && l.qty > 0)
    if (!validMats.some(l => l.qty > 0) && !validWorks.length) {
      toast.error('أضف مواد أو أعمال على الأقل')
      return
    }
    if (totalDiffersFromLines && !totalNote.trim()) {
      toast.error('أدخل ملاحظة عند تعديل الإجمالي ليتعارض مع مجموع البنود')
      return
    }

    setSaving(true)
    const ordered = [...validMats.filter(l => l.qty > 0 || l.description.trim()), ...validWorks]
    const boqLines = ordered.map((l, i) => ({
      line_no: i + 1,
      catalog_no: l.item_code || null,
      description: l.description.trim(),
      unit: l.unit,
      qty_planned: l.qty,
      material_id: l.line_category === 'MATERIAL' ? (l.warehouse_material_id ?? null) : null,
      notes: buildNotes(l.line_category, isRevision, l.qty_previous, l.is_new),
      line_category: l.line_category,
    }))

    try {
      const reservationDraft = reservationRef.current?.getDraft()
      let savedReservation = false
      if (reservationDraft?.material_reservation_number.trim()) {
        await reservationRef.current!.saveReservation()
        savedReservation = true
      }

      const { versionId: targetVersionId, nextVersionNo } = await resolveBoqVersionForSave(
        tenant.id,
        projectId,
        versionId,
      )

      if (targetVersionId) {
        const { error } = await replaceBoqVersionLines(tenant.id, targetVersionId, boqLines)
        if (error) throw error
        const { error: actErr } = await activateBoqVersion(tenant.id, targetVersionId, projectId)
        if (actErr) throw actErr
        setVersionId(targetVersionId)
      } else {
        const { data, error } = await createBoqVersion({
          tenant_id: tenant.id,
          project_id: projectId,
          version_type: 'INITIAL',
          version_no: nextVersionNo,
          notes: isRevision ? 'تعديل مقايسة' : 'مقايسة SEC',
          created_by: currentUser?.name,
          lines: boqLines,
        })
        if (error) throw error
        const created = (data || []).find(v => v.version_no === nextVersionNo)
          || (data || []).find(v => v.version_type === 'INITIAL')
        if (created?.id) {
          const { error: actErr } = await activateBoqVersion(tenant.id, created.id, projectId)
          if (actErr) throw actErr
          setVersionId(created.id)
        }
      }

      await updateProjectPlanning(tenant.id, projectId, {
        estimate_total_override: totalDiffersFromLines ? effectiveTotal : null,
        estimate_total_note: totalDiffersFromLines ? totalNote.trim() : null,
      })
      await supabase.from('projects').update({
        estimated_value: effectiveTotal,
        updated_at: new Date().toISOString(),
      }).eq('tenant_id', tenant.id).eq('id', projectId)

      toast.success(
        savedReservation
          ? 'تم حفظ المقايسة والحجز ✅'
          : (isRevision ? 'تم حفظ تعديل المقايسة ✅' : 'تم حفظ المقايسة ✅'),
      )
      await loadBoq()
      onSaved?.()
      onPlanningSaved?.()
    } catch (e: unknown) {
      toast.error(formatSupabaseError(e, 'فشل الحفظ'))
      await loadBoq()
    }
    setSaving(false)
  }

  if (loadingBoq) return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>جاري التحميل...</div>

  return (
    <>
      <input ref={materialExcelRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleMaterialExcelPick} />

      {materialCatalog.length > 0 && (
        <datalist id="sec-material-catalog">
          {materialCatalog.filter(m => m.sec_number || m.catalog_no).map(m => (
            <option key={m.id} value={m.sec_number || m.catalog_no || ''}>{m.name}</option>
          ))}
        </datalist>
      )}

      <EstimateSectionTable category="MATERIAL" title="المواد" icon={<Package style={{ width: '18px', height: '18px' }} />}
        lines={materialLines} lineIndices={materialIndices} frameworkItems={[]} frameworkMap={frameworkMap}
        readOnly={!!readOnly} isRevision={isRevision} onUpdate={updateLine} onSelectFramework={selectFramework}
        onRemove={removeLine} onAdd={() => addLine('MATERIAL')}
        onImport={readOnly ? undefined : kind => openImport('MATERIAL', kind)}
        onMaterialSecLookup={applyMaterialSecLookup}
        reservationSlot={tenantId && projectName ? (
          <MaterialsReservationBlock
            ref={reservationRef}
            embedded
            tenantId={tenantId}
            projectId={projectId}
            projectName={projectName}
            clientName={clientName}
            planning={planning ?? null}
            readOnly={readOnly}
            onSaved={onPlanningSaved}
          />
        ) : undefined} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
        <div style={{ flex: 1, height: '2px', background: 'linear-gradient(to left, #c7d2fe, #bfdbfe, #e5e7eb)' }} />
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af' }}>── الأعمال ──</span>
        <div style={{ flex: 1, height: '2px', background: 'linear-gradient(to right, #c7d2fe, #bfdbfe, #e5e7eb)' }} />
      </div>

      <EstimateSectionTable category="WORK" title="الأعمال" icon={<HardHat style={{ width: '18px', height: '18px' }} />}
        lines={workLines} lineIndices={workIndices} frameworkItems={frameworkItems} frameworkMap={frameworkMap}
        readOnly={!!readOnly} isRevision={isRevision} onUpdate={updateLine} onSelectFramework={selectFramework}
        onRemove={removeLine} onAdd={() => addLine('WORK')}
        onImport={readOnly ? undefined : kind => openImport('WORK', kind)} />

      <div style={{ marginTop: '16px', padding: '14px 18px', borderRadius: '12px', background: 'linear-gradient(135deg, #eef2ff, #eff6ff)', border: '2px solid #c7d2fe', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '0.82rem' }}>
            <span style={{ color: '#4338ca' }}>مواد: <strong>{totalMaterials.toLocaleString('ar-SA')}</strong> ر.س</span>
            <span style={{ color: '#1a56db' }}>أعمال: <strong>{totalWorks.toLocaleString('ar-SA')}</strong> ر.س</span>
            <span style={{ color: '#6b7280' }}>مجموع البنود: <strong>{grandTotal.toLocaleString('ar-SA')}</strong> ر.س</span>
          </div>
          <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>
            الإجمالي المعتمد للمستخلص: {effectiveTotal.toLocaleString('ar-SA')} ر.س
          </div>
          {!readOnly && (
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              <Save style={{ width: '16px', height: '16px' }} /> {saving ? 'جاري الحفظ...' : saveLabel}
            </button>
          )}
        </div>

        {!readOnly && (
          <div style={{ padding: '12px', borderRadius: '10px', background: 'white', border: '1px solid #c7d2fe' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', marginBottom: useOverride ? '10px' : 0 }}>
              <input
                type="checkbox"
                checked={useOverride}
                onChange={e => {
                  setUseOverride(e.target.checked)
                  if (e.target.checked && !totalOverride) setTotalOverride(String(grandTotal))
                }}
              />
              تعديل الإجمالي يدوياً (يُحدّث القيمة التقديرية والمستخلص)
            </label>
            {useOverride && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px' }}>المبلغ الإجمالي (ر.س)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalOverride}
                    onChange={e => setTotalOverride(e.target.value)}
                    className="input"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: totalDiffersFromLines ? '#c81e1e' : '#6b7280', display: 'block', marginBottom: '4px' }}>
                    ملاحظة {totalDiffersFromLines ? '(مطلوبة — يختلف عن مجموع البنود)' : '(اختياري)'}
                  </label>
                  <input
                    value={totalNote}
                    onChange={e => setTotalNote(e.target.value)}
                    className="input"
                    placeholder="سبب تعديل الإجمالي..."
                  />
                </div>
              </div>
            )}
            <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#6b7280' }}>
              الإجمالي المعتمد (تلقائي من البنود أو معدّل يدوياً) هو أساس المستخلص والقيمة التقديرية في مرحلة البدء
            </p>
          </div>
        )}

        {!readOnly && !useOverride && (
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#4338ca' }}>
            الإجمالي المعتمد للمستخلص = مجموع البنود ({grandTotal.toLocaleString('ar-SA')} ر.س)
          </p>
        )}

        {readOnly && totalDiffersFromLines && totalNote && (
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#92400e', background: '#fffbeb', padding: '8px 10px', borderRadius: '8px' }}>
            ملاحظة الإجمالي: {totalNote}
          </p>
        )}
      </div>

      {importModalOpen && (
        <ImportQuantitiesModal importKind={importKind} frameworkItems={frameworkItems}
          existingLines={importTarget === 'MATERIAL' ? materialLines : workLines}
          lineCategory={importTarget}
          onClose={() => setImportModalOpen(false)} onApply={handleImportApply} />
      )}
    </>
  )
}
