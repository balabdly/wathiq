'use client'
import { useEffect, useState, useMemo } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { useInitiation } from '../InitiationContext'
import { fetchBoqVersions, createBoqVersion, activateBoqVersion } from '@/lib/pmc-service'
import type { ProjectBoqLine } from '@/lib/pmc-types'
import ImportQuantitiesModal, { BoqLineStatusBadge, type BoqImportKind } from '@/components/projects/ImportQuantitiesModal'
import {
  type BoqImportLine,
  type BoqLineSource,
  type BoqMatchStatus,
  buildFrameworkMap,
  boqImportSummary,
} from '@/lib/project-boq-import'
import { Plus, Save, Tag, Trash2, FileSpreadsheet, Image, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

type LineRow = BoqImportLine

function emptyLine(): LineRow {
  return { item_code: '', description: '', unit: 'EA', qty: 1, unit_price: 0, source: 'manual', matchStatus: 'manual' }
}

function inferMatchStatus(itemCode: string, frameworkMap: Map<string, { item_code: string }>): BoqMatchStatus {
  if (!itemCode.trim()) return 'manual'
  return frameworkMap.has(itemCode.replace(/\s+/g, '').toUpperCase()) ? 'matched' : 'review'
}

export default function InitiationQuantitiesPage() {
  const { tenant, currentUser } = useStore()
  const { projects, frameworkItems, reloadKpis } = useInitiation()
  const [projectId, setProjectId] = useState<number | ''>('')
  const [lines, setLines] = useState<LineRow[]>([emptyLine()])
  const [versionId, setVersionId] = useState<number | null>(null)
  const [loadingBoq, setLoadingBoq] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importKind, setImportKind] = useState<BoqImportKind>('excel')

  function openImport(kind: BoqImportKind) {
    setImportKind(kind)
    setShowImport(true)
  }

  const frameworkMap = useMemo(() => buildFrameworkMap(frameworkItems), [frameworkItems])
  const summary = useMemo(() => boqImportSummary(lines), [lines])

  useEffect(() => {
    if (!tenant || !projectId) {
      setLines([emptyLine()])
      setVersionId(null)
      return
    }
    loadBoq(Number(projectId))
  }, [tenant?.id, projectId, frameworkMap])

  async function loadBoq(pid: number) {
    if (!tenant) return
    setLoadingBoq(true)
    const { data } = await fetchBoqVersions(tenant.id, pid)
    const initial = (data || []).find(v => v.version_type === 'INITIAL')
    if (initial?.lines?.length) {
      setVersionId(initial.id)
      setLines(initial.lines.map(l => {
        const code = l.catalog_no || ''
        const fw = code ? frameworkMap.get(code.replace(/\s+/g, '').toUpperCase()) : undefined
        return {
          item_code: code,
          description: l.description,
          unit: l.unit,
          qty: Number(l.qty_planned),
          unit_price: fw ? Number(fw.unit_price) : 0,
          source: 'manual' as BoqLineSource,
          matchStatus: inferMatchStatus(code, frameworkMap),
        }
      }))
    } else {
      setVersionId(initial?.id || null)
      setLines([emptyLine()])
    }
    setLoadingBoq(false)
  }

  function updateLine(idx: number, key: keyof LineRow, val: string | number) {
    setLines(prev => {
      const next = [...prev]
      const row = { ...next[idx], [key]: val }
      if (key === 'item_code' || key === 'description') {
        row.matchStatus = inferMatchStatus(String(row.item_code), frameworkMap)
        if (key === 'item_code' && row.source !== 'excel' && row.source !== 'csv' && row.source !== 'pdf' && row.source !== 'image') {
          row.source = 'manual'
        }
      }
      if (key === 'description' || key === 'qty' || key === 'unit') {
        if (row.source !== 'excel' && row.source !== 'csv' && row.source !== 'pdf' && row.source !== 'image') {
          row.source = 'manual'
        }
      }
      next[idx] = row
      return next
    })
  }

  function selectFramework(idx: number, itemCode: string) {
    const item = frameworkItems.find(f => f.item_code === itemCode)
    if (!item) return
    setLines(prev => {
      const next = [...prev]
      next[idx] = {
        item_code: item.item_code,
        description: item.description_ar || item.item_code,
        unit: item.unit,
        qty: next[idx].qty || 1,
        unit_price: item.unit_price,
        source: next[idx].source === 'excel' || next[idx].source === 'csv' || next[idx].source === 'pdf' || next[idx].source === 'image'
          ? next[idx].source : 'manual',
        matchStatus: 'matched',
      }
      return next
    })
  }

  function addLine() {
    setLines(l => [...l, emptyLine()])
  }

  function removeLine(idx: number) {
    if (lines.length <= 1) return
    setLines(l => l.filter((_, i) => i !== idx))
  }

  function handleImportApply(imported: BoqImportLine[]) {
    setLines(imported.length ? imported : [emptyLine()])
    toast.success(`تم تطبيق ${imported.length} بند — راجع البنود البرتقالية`)
  }

  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)

  async function handleSave() {
    if (!tenant || !projectId) { toast.error('اختر المشروع'); return }
    const valid = lines.filter(l => l.description.trim() && l.qty > 0)
    if (valid.length === 0) { toast.error('أضف بنداً واحداً على الأقل'); return }
    setSaving(true)

    const boqLines: Omit<ProjectBoqLine, 'id' | 'tenant_id' | 'boq_version_id'>[] = valid.map((l, i) => ({
      line_no: i + 1,
      catalog_no: l.item_code || null,
      description: l.description.trim(),
      unit: l.unit,
      qty_planned: l.qty,
    }))

    try {
      if (versionId) {
        await supabase.from('project_boq_lines').delete().eq('boq_version_id', versionId)
        const rows = boqLines.map(l => ({
          tenant_id: tenant.id,
          boq_version_id: versionId,
          line_no: l.line_no,
          catalog_no: l.catalog_no,
          description: l.description,
          unit: l.unit,
          qty_planned: l.qty_planned,
        }))
        const { error } = await supabase.from('project_boq_lines').insert(rows)
        if (error) throw error
        await activateBoqVersion(tenant.id, versionId, Number(projectId))
      } else {
        const { data, error } = await createBoqVersion({
          tenant_id: tenant.id,
          project_id: Number(projectId),
          version_type: 'INITIAL',
          version_no: 1,
          notes: 'كميات ابتدائية — مرحلة البدء',
          created_by: currentUser?.name,
          lines: boqLines,
        })
        if (error) throw error
        const initial = (data || []).find(v => v.version_type === 'INITIAL')
        if (initial?.id) await activateBoqVersion(tenant.id, initial.id, Number(projectId))
      }
      toast.success('تم حفظ الكميات الابتدائية ✅')
      await loadBoq(Number(projectId))
      await reloadKpis()
    } catch (e: any) {
      toast.error(e.message || 'فشل الحفظ')
    }
    setSaving(false)
  }

  return (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>المشروع *</label>
        <select value={projectId} onChange={e => setProjectId(e.target.value ? Number(e.target.value) : '')} className="select" style={{ maxWidth: '420px' }}>
          <option value="">— اختر مشروعاً في مرحلة البدء —</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.code ? `${p.code} — ` : ''}{p.name}{p.client_name ? ` (${p.client_name})` : ''}
            </option>
          ))}
        </select>
      </div>

      {!projectId ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>اختر مشروعاً لإدخال الكميات الابتدائية</div>
      ) : loadingBoq ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>جاري التحميل...</div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <label style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tag style={{ width: '15px', height: '15px', color: 'var(--primary)' }} />
              بنود الكميات الابتدائية
              {frameworkItems.length > 0 && (
                <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 400 }}>— من العقد الإطاري SEC</span>
              )}
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => openImport('excel')} className="btn btn-ghost" style={{ fontSize: '0.78rem', border: '1px solid #bfdbfe', color: '#1a56db' }}>
                <FileSpreadsheet style={{ width: '13px', height: '13px' }} /> Excel / CSV
              </button>
              <button type="button" onClick={() => openImport('pdf')} className="btn btn-ghost" style={{ fontSize: '0.78rem', border: '1px solid #fecaca', color: '#c81e1e' }}>
                <FileText style={{ width: '13px', height: '13px' }} /> PDF
              </button>
              <button type="button" onClick={() => openImport('image')} className="btn btn-ghost" style={{ fontSize: '0.78rem', border: '1px solid #ddd6fe', color: '#7c3aed' }}>
                <Image style={{ width: '13px', height: '13px' }} /> صورة UDS
              </button>
              <button type="button" onClick={addLine} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>
                <Plus style={{ width: '13px', height: '13px' }} /> بند يدوي
              </button>
            </div>
          </div>

          {lines.some(l => l.item_code || l.description) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', fontSize: '0.72rem' }}>
              <span style={{ padding: '3px 10px', borderRadius: '16px', background: '#eff6ff', color: '#1a56db' }}>{summary.total} بند</span>
              <span style={{ padding: '3px 10px', borderRadius: '16px', background: '#ecfdf5', color: '#0ea77b' }}>{summary.matched} مطابق</span>
              <span style={{ padding: '3px 10px', borderRadius: '16px', background: '#fffbeb', color: '#e6820a' }}>{summary.review} للمراجعة</span>
              <span style={{ padding: '3px 10px', borderRadius: '16px', background: '#f3f4f6', color: '#6b7280' }}>{summary.manual} يدوي</span>
            </div>
          )}

          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>الحالة</th>
                  {frameworkItems.length > 0 && (
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>من العقد</th>
                  )}
                  {['الوصف', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid var(--border)', background: line.matchStatus === 'review' ? '#fffbeb22' : undefined }}>
                    <td style={{ padding: '6px 8px' }}>
                      <BoqLineStatusBadge status={line.matchStatus} />
                    </td>
                    {frameworkItems.length > 0 && (
                      <td style={{ padding: '6px 8px', minWidth: '160px' }}>
                        <select
                          value={line.item_code}
                          onChange={e => selectFramework(idx, e.target.value)}
                          style={{ width: '100%', padding: '5px 8px', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.78rem', background: '#eff6ff', color: '#1a56db' }}
                        >
                          <option value="">— بند —</option>
                          {frameworkItems.slice(0, 300).map(f => (
                            <option key={f.item_code} value={f.item_code}>{f.item_code} — {f.unit_price} ر.س</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td style={{ padding: '6px 8px', minWidth: '180px' }}>
                      <input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} className="input" style={{ fontSize: '0.82rem' }} placeholder="الوصف أو اختر من العقد" />
                    </td>
                    <td style={{ padding: '6px 8px', width: '80px' }}>
                      <input type="number" min="0" step="0.01" value={line.qty} onChange={e => updateLine(idx, 'qty', Number(e.target.value))} className="input" style={{ fontSize: '0.82rem' }} dir="ltr" />
                    </td>
                    <td style={{ padding: '6px 8px', width: '70px' }}>
                      <input value={line.unit} onChange={e => updateLine(idx, 'unit', e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
                    </td>
                    <td style={{ padding: '6px 8px', width: '90px' }}>
                      <input type="number" min="0" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', Number(e.target.value))} className="input" style={{ fontSize: '0.82rem' }} dir="ltr" readOnly={line.matchStatus === 'matched' && line.unit_price > 0} />
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0ea77b', whiteSpace: 'nowrap' }}>
                      {(line.qty * line.unit_price).toLocaleString('ar-SA')}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <button type="button" onClick={() => removeLine(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}>
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1a56db' }}>
              الإجمالي: {total.toLocaleString('ar-SA')} ر.س
            </div>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              <Save style={{ width: '16px', height: '16px' }} />
              {saving ? 'جاري الحفظ...' : 'حفظ الكميات الابتدائية'}
            </button>
          </div>
        </>
      )}

      {showImport && (
        <ImportQuantitiesModal
          importKind={importKind}
          frameworkItems={frameworkItems}
          existingLines={lines.filter(l => l.description.trim() || l.item_code)}
          onClose={() => setShowImport(false)}
          onApply={handleImportApply}
        />
      )}
    </div>
  )
}
