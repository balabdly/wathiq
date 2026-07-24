'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { fetchBoqVersions, createBoqVersion, activateBoqVersion } from '@/lib/pmc-service'
import type { ProjectBoqLine } from '@/lib/pmc-types'
import type { BoqRevisionSnapshotLine, ProjectPlanning } from '@/lib/project-planning-service'
import { fetchPlanningMaterialLines, parseMaterialsSpreadsheet } from '@/lib/planning-material-lines-service'
import ImportQuantitiesModal, { BoqLineStatusBadge, type BoqImportKind } from '@/components/projects/ImportQuantitiesModal'
import { MaterialsReservationBlock } from '@/components/projects/BoqReservationPanel'
import {
  type BoqImportLine,
  type BoqLineSource,
  type BoqMatchStatus,
  buildFrameworkMap,
} from '@/lib/project-boq-import'
import { Plus, Save, Trash2, FileSpreadsheet, FileText, Image, Package, HardHat } from 'lucide-react'
import toast from 'react-hot-toast'

export type BoqLineCategory = 'MATERIAL' | 'WORK'

type LineRow = BoqImportLine & { qty_previous?: number; line_category: BoqLineCategory }

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
  return frameworkMap.has(itemCode.replace(/\s+/g, '').toUpperCase()) ? 'matched' : 'review'
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

function buildNotes(category: BoqLineCategory, isRevision: boolean, qtyPrevious?: number): string | null {
  const parts: string[] = [`line_category:${category}`]
  if (isRevision && qtyPrevious != null) parts.push(`prev_qty:${qtyPrevious}`)
  return parts.join('|')
}

type FrameworkBoqRow = {
  id: number
  item_code: string
  description_ar?: string
  unit: string
  unit_price: number
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
  showImport,
  onImport,
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
  showImport: boolean
  onImport: (kind: BoqImportKind) => void
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
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {showImport && (
              <>
                <button type="button" onClick={() => onImport('excel')} className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '4px 8px' }}><FileSpreadsheet style={{ width: '12px', height: '12px' }} /> Excel</button>
                <button type="button" onClick={() => onImport('pdf')} className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '4px 8px' }}><FileText style={{ width: '12px', height: '12px' }} /> PDF</button>
                <button type="button" onClick={() => onImport('image')} className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '4px 8px' }}><Image style={{ width: '12px', height: '12px' }} /> صورة</button>
              </>
            )}
            <button type="button" onClick={onAdd} className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '4px 10px', color: style.titleColor, border: `1px solid ${style.headerBorder}` }}>
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
              {!isRevision && category === 'WORK' && frameworkItems.length > 0 && (
                <th style={{ padding: '8px', fontSize: '0.72rem', color: style.titleColor, textAlign: 'right' }}>من العقد</th>
              )}
              {!isRevision && category === 'WORK' && (
                <th style={{ padding: '8px', fontSize: '0.72rem', color: style.titleColor, textAlign: 'right' }}>الحالة</th>
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
              return (
                <tr key={globalIdx} style={{ borderTop: `1px solid ${style.headerBorder}`, background: qtyChanged ? '#fffbeb55' : undefined }}>
                  {!isRevision && category === 'WORK' && frameworkItems.length > 0 && (
                    <td style={{ padding: '6px 8px', minWidth: '140px' }}>
                      <select value={line.item_code} onChange={e => onSelectFramework(globalIdx, e.target.value)} disabled={readOnly}
                        style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                        <option value="">—</option>
                        {frameworkItems.slice(0, 200).map(f => (
                          <option key={f.item_code} value={f.item_code}>{f.item_code}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {!isRevision && category === 'WORK' && (
                    <td style={{ padding: '6px 8px' }}><BoqLineStatusBadge status={line.matchStatus} /></td>
                  )}
                  <td style={{ padding: '6px 8px', minWidth: '160px' }}>
                    <input value={line.description} onChange={e => onUpdate(globalIdx, 'description', e.target.value)} className="input" style={{ fontSize: '0.8rem' }} readOnly={readOnly || isRevision} placeholder={category === 'MATERIAL' ? 'المادة' : 'البند'} />
                  </td>
                  {isRevision && (
                    <td style={{ padding: '6px 8px', width: '80px' }}>
                      <div style={{ padding: '5px', borderRadius: '6px', background: '#f3f4f6', fontWeight: 700, textAlign: 'center', fontSize: '0.8rem', color: '#6b7280' }} dir="ltr">
                        {(line.qty_previous ?? 0).toLocaleString('ar-SA')}
                      </div>
                    </td>
                  )}
                  <td style={{ padding: '6px 8px', width: '80px' }}>
                    <input type="number" min="0" step="0.01" value={line.qty} onChange={e => onUpdate(globalIdx, 'qty', Number(e.target.value))} className="input" style={{ fontSize: '0.8rem', borderColor: qtyChanged ? '#fcd34d' : undefined, fontWeight: qtyChanged ? 700 : 400 }} dir="ltr" readOnly={readOnly} />
                  </td>
                  <td style={{ padding: '6px 8px', width: '64px' }}>
                    <input value={line.unit} onChange={e => onUpdate(globalIdx, 'unit', e.target.value)} className="input" style={{ fontSize: '0.8rem' }} readOnly={readOnly || isRevision} />
                  </td>
                  <td style={{ padding: '6px 8px', width: '80px' }}>
                    <input type="number" min="0" value={line.unit_price} onChange={e => onUpdate(globalIdx, 'unit_price', Number(e.target.value))} className="input" style={{ fontSize: '0.8rem' }} dir="ltr"
                      readOnly={readOnly || isRevision || (category === 'WORK' && line.matchStatus === 'matched' && line.unit_price > 0)} />
                  </td>
                  <td style={{ padding: '6px 8px', fontWeight: 700, color: qtyChanged ? '#e6820a' : '#0ea77b', whiteSpace: 'nowrap' }}>
                    {(line.qty * line.unit_price).toLocaleString('ar-SA')}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {!readOnly && !isRevision && (
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
  const [loadingBoq, setLoadingBoq] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importKind, setImportKind] = useState<BoqImportKind>('excel')
  const [importTarget, setImportTarget] = useState<BoqLineCategory>('WORK')
  const materialExcelRef = useRef<HTMLInputElement>(null)

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
    if (!tenant || !projectId) return
    loadBoq()
  }, [tenant?.id, projectId, frameworkMap, isRevision, snapshotByKey])

  function mapDbLine(l: ProjectBoqLine & { line_category?: string | null }, snap?: BoqRevisionSnapshotLine): LineRow {
    const cat = resolveCategory(l)
    const code = l.catalog_no || ''
    const fw = code ? frameworkMap.get(code.replace(/\s+/g, '').toUpperCase()) : undefined
    return {
      item_code: code,
      description: l.description,
      unit: l.unit,
      qty: Number(l.qty_planned),
      qty_previous: snap ? Number(snap.qty) : (isRevision ? (parsePrevQty(l.notes) ?? Number(l.qty_planned)) : undefined),
      unit_price: fw ? Number(fw.unit_price) : 0,
      source: 'manual' as BoqLineSource,
      matchStatus: inferMatchStatus(code, frameworkMap),
      line_category: cat,
    }
  }

  async function loadBoq() {
    if (!tenant) return
    setLoadingBoq(true)
    const { data } = await fetchBoqVersions(tenant.id, projectId)
    const active = (data || []).find(v => v.status === 'ACTIVE') || (data || []).find(v => v.version_type === 'INITIAL')

    let materialRows: LineRow[] = []
    let workRows: LineRow[] = []

    if (active?.lines?.length) {
      setVersionId(active.id)
      for (const l of active.lines) {
        const cat = resolveCategory(l)
        const snap = snapshotByKey.get(`${cat}:${l.description}:${l.line_no || 0}`)
        const row = mapDbLine(l, snap)
        if (cat === 'MATERIAL') materialRows.push(row)
        else workRows.push(row)
      }
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
      const snapMats = revisionSnapshot.filter(s => s.line_category === 'MATERIAL')
      const snapWorks = revisionSnapshot.filter(s => s.line_category !== 'MATERIAL')
      materialRows = materialRows.map(r => {
        const snap = snapMats.find(s => s.description === r.description)
        return snap ? { ...r, qty_previous: Number(snap.qty) } : r
      })
      workRows = workRows.map(r => {
        const snap = snapWorks.find(s => s.description === r.description)
        return snap ? { ...r, qty_previous: Number(snap.qty) } : r
      })
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
      next[idx] = row
      return next
    })
  }

  function selectFramework(idx: number, itemCode: string) {
    const item = frameworkItems.find(f => f.item_code === itemCode)
    if (!item) return
    setLines(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], item_code: item.item_code, description: item.description_ar || item.item_code, unit: item.unit, unit_price: item.unit_price, matchStatus: 'matched' }
      return next
    })
  }

  function addLine(category: BoqLineCategory) { setLines(l => [...l, emptyLine(category)]) }

  function removeLine(idx: number) {
    const cat = lines[idx]?.line_category
    if (lines.filter(l => l.line_category === cat).length <= 1) return
    setLines(l => l.filter((_, i) => i !== idx))
  }

  function handleImportApply(imported: BoqImportLine[]) {
    setLines(prev => {
      const mats = prev.filter(l => l.line_category === 'MATERIAL')
      const works = prev.filter(l => l.line_category === 'WORK')
      if (importTarget === 'MATERIAL') {
        const newMats = imported.length
          ? imported.map(r => ({ ...r, line_category: 'MATERIAL' as const, unit: r.unit || 'قطعة' }))
          : [emptyLine('MATERIAL')]
        return [...newMats, ...works]
      }
      const newWorks = imported.length
        ? imported.map(r => ({ ...r, line_category: 'WORK' as const }))
        : [emptyLine('WORK')]
      return [...mats, ...newWorks]
    })
    setShowImport(false)
    toast.success(`تم استيراد ${imported.length} ${importTarget === 'MATERIAL' ? 'مادة' : 'بند أعمال'}`)
  }

  function openImport(category: BoqLineCategory, kind: BoqImportKind) {
    setImportTarget(category)
    if (category === 'MATERIAL' && kind === 'excel') {
      materialExcelRef.current?.click()
      return
    }
    setImportKind(kind)
    setShowImport(true)
  }

  async function handleMaterialExcelPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const rows = await parseMaterialsSpreadsheet(file)
      const imported = rows.filter(r => r.description.trim()).map(r => ({
        ...emptyLine('MATERIAL'),
        description: r.description,
        unit: r.unit || 'قطعة',
        qty: Number(r.qty_planned) || 0,
        item_code: r.catalog_no || '',
      }))
      setLines(prev => {
        const works = prev.filter(l => l.line_category === 'WORK')
        return [...(imported.length ? imported : [emptyLine('MATERIAL')]), ...works]
      })
      toast.success(`تم استيراد ${imported.length} مادة من Excel`)
    } catch {
      toast.error('تعذّر قراءة ملف Excel')
    }
  }

  const totalMaterials = materialLines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const totalWorks = workLines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const grandTotal = totalMaterials + totalWorks

  async function handleSave() {
    if (!tenant || readOnly) return
    const validMats = materialLines.filter(l => l.description.trim())
    const validWorks = workLines.filter(l => l.description.trim() && l.qty > 0)
    if (!validMats.some(l => l.qty > 0) && !validWorks.length) {
      toast.error('أضف مواد أو أعمال على الأقل')
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
      notes: buildNotes(l.line_category, isRevision, l.qty_previous),
      line_category: l.line_category,
    }))

    try {
      if (versionId) {
        await supabase.from('project_boq_lines').delete().eq('boq_version_id', versionId)
        const { error } = await supabase.from('project_boq_lines').insert(boqLines.map(l => ({
          tenant_id: tenant.id,
          boq_version_id: versionId,
          ...l,
        })))
        if (error) throw error
        await activateBoqVersion(tenant.id, versionId, projectId)
      } else {
        const { data, error } = await createBoqVersion({
          tenant_id: tenant.id,
          project_id: projectId,
          version_type: 'INITIAL',
          version_no: 1,
          notes: isRevision ? 'تعديل مقايسة' : 'مقايسة SEC',
          created_by: currentUser?.name,
          lines: boqLines,
        })
        if (error) throw error
        const initial = (data || []).find(v => v.version_type === 'INITIAL')
        if (initial?.id) await activateBoqVersion(tenant.id, initial.id, projectId)
      }
      toast.success(isRevision ? 'تم حفظ تعديل المقايسة ✅' : 'تم حفظ المقايسة ✅')
      await loadBoq()
      onSaved?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
    }
    setSaving(false)
  }

  if (loadingBoq) return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>جاري التحميل...</div>

  return (
    <>
      <input ref={materialExcelRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleMaterialExcelPick} />

      <EstimateSectionTable category="MATERIAL" title="المواد" icon={<Package style={{ width: '18px', height: '18px' }} />}
        lines={materialLines} lineIndices={materialIndices} frameworkItems={[]} frameworkMap={frameworkMap}
        readOnly={!!readOnly} isRevision={isRevision} onUpdate={updateLine} onSelectFramework={selectFramework}
        onRemove={removeLine} onAdd={() => addLine('MATERIAL')} showImport={!isRevision && !readOnly}
        onImport={k => openImport('MATERIAL', k)}
        reservationSlot={tenantId && projectName ? (
          <MaterialsReservationBlock
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
        onRemove={removeLine} onAdd={() => addLine('WORK')} showImport={!isRevision && !readOnly}
        onImport={k => openImport('WORK', k)} />

      <div style={{ marginTop: '16px', padding: '14px 18px', borderRadius: '12px', background: 'linear-gradient(135deg, #eef2ff, #eff6ff)', border: '2px solid #c7d2fe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '0.82rem' }}>
          <span style={{ color: '#4338ca' }}>مواد: <strong>{totalMaterials.toLocaleString('ar-SA')}</strong> ر.س</span>
          <span style={{ color: '#1a56db' }}>أعمال: <strong>{totalWorks.toLocaleString('ar-SA')}</strong> ر.س</span>
        </div>
        <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>الإجمالي: {grandTotal.toLocaleString('ar-SA')} ر.س</div>
        {!readOnly && (
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            <Save style={{ width: '16px', height: '16px' }} /> {saving ? 'جاري الحفظ...' : saveLabel}
          </button>
        )}
      </div>

      {showImport && (
        <ImportQuantitiesModal importKind={importKind} frameworkItems={frameworkItems}
          existingLines={importTarget === 'MATERIAL' ? materialLines : workLines}
          onClose={() => setShowImport(false)} onApply={handleImportApply} />
      )}
    </>
  )
}
