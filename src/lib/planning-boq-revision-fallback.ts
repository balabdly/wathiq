export type BoqRevisionSnapshotLine = {
  line_no?: number
  catalog_no?: string | null
  description: string
  unit: string
  qty: number
  unit_price?: number
  line_category?: 'MATERIAL' | 'WORK'
}

export function isMissingPlanningColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) return false
  const msg = error.message
  return error.code === 'PGRST204'
    || msg.includes('schema cache')
    || msg.includes('Could not find the')
}

export function embedBoqApprovalInNotes(
  notes: string | null | undefined,
  path: string,
  name: string,
): string {
  const cleaned = clearBoqApprovalFromNotes(notes)
  return `${cleaned} [boq_revision_approval_path:${path}] [boq_revision_approval_name:${name}]`.trim()
}

export function clearBoqApprovalFromNotes(notes: string | null | undefined): string {
  return (notes || '')
    .replace(/\[boq_revision_approval_path:[^\]]*\]/g, '')
    .replace(/\[boq_revision_approval_name:[^\]]*\]/g, '')
    .trim()
}

export function parseBoqApprovalFromNotes(notes?: string | null): { path?: string; name?: string } {
  const pathM = notes?.match(/\[boq_revision_approval_path:([^\]]+)\]/)
  const nameM = notes?.match(/\[boq_revision_approval_name:([^\]]+)\]/)
  return { path: pathM?.[1], name: nameM?.[1] }
}

export function clearEstimateFromNotes(notes: string | null | undefined): string {
  return (notes || '')
    .replace(/\[estimate_total_override:[^\]]*\]/g, '')
    .replace(/\[estimate_total_note:[^\]]*\]/g, '')
    .trim()
}

export function embedEstimateInNotes(
  notes: string | null | undefined,
  override: number | null | undefined,
  note: string | null | undefined,
): string {
  let cleaned = clearEstimateFromNotes(notes)
  if (override != null && Number(override) > 0) {
    cleaned = `${cleaned} [estimate_total_override:${override}]`.trim()
    if (note?.trim()) cleaned = `${cleaned} [estimate_total_note:${note.trim()}]`.trim()
  }
  return cleaned
}

export function parseEstimateFromNotes(notes?: string | null): { override?: number; note?: string } {
  const ovM = notes?.match(/\[estimate_total_override:([^\]]+)\]/)
  const noteM = notes?.match(/\[estimate_total_note:([^\]]+)\]/)
  const override = ovM?.[1] != null ? Number(ovM[1]) : undefined
  return {
    override: override != null && !Number.isNaN(override) ? override : undefined,
    note: noteM?.[1],
  }
}

function encodeSnapshot(snapshot: BoqRevisionSnapshotLine[]): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(snapshot))))
}

function decodeSnapshot(encoded: string): BoqRevisionSnapshotLine[] {
  try {
    const json = decodeURIComponent(escape(atob(encoded)))
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function embedSnapshotInReason(
  reason: string | null | undefined,
  snapshot: BoqRevisionSnapshotLine[],
): string {
  const cleaned = clearSnapshotFromReason(reason)
  return `${cleaned} [boq_revision_snapshot:${encodeSnapshot(snapshot)}]`.trim()
}

export function clearSnapshotFromReason(reason: string | null | undefined): string {
  return (reason || '').replace(/\[boq_revision_snapshot:[^\]]*\]/g, '').trim()
}

export function parseSnapshotFromReason(reason?: string | null): BoqRevisionSnapshotLine[] {
  const m = reason?.match(/\[boq_revision_snapshot:([^\]]+)\]/)
  if (!m?.[1]) return []
  return decodeSnapshot(m[1])
}

export type PlanningBoqRevisionPatch = {
  cost_plan_notes?: string | null
  timeline_revision_reason?: string | null
  boq_revision_approval_file_path?: string | null
  boq_revision_approval_file_name?: string | null
  boq_revision_snapshot?: BoqRevisionSnapshotLine[] | null
  estimate_total_override?: number | null
  estimate_total_note?: string | null
  [key: string]: unknown
}

/** يحوّل حقول التعديل إلى أعمدة موجودة (ملاحظات/سبب التعديل) عند غياب أعمدة migration */
export function applyBoqRevisionFallbackPatch(patch: PlanningBoqRevisionPatch): PlanningBoqRevisionPatch {
  const next: PlanningBoqRevisionPatch = { ...patch }

  if ('boq_revision_approval_file_path' in patch || 'boq_revision_approval_file_name' in patch) {
    let notes = next.cost_plan_notes
    notes = clearBoqApprovalFromNotes(notes ?? undefined)
    const path = patch.boq_revision_approval_file_path
    const name = patch.boq_revision_approval_file_name
    if (path && name) {
      notes = embedBoqApprovalInNotes(notes, path, name)
    }
    delete next.boq_revision_approval_file_path
    delete next.boq_revision_approval_file_name
    next.cost_plan_notes = notes || null
  }

  if ('boq_revision_snapshot' in patch) {
    let reason = next.timeline_revision_reason
    reason = clearSnapshotFromReason(reason ?? undefined)
    if (patch.boq_revision_snapshot?.length) {
      reason = embedSnapshotInReason(reason, patch.boq_revision_snapshot)
    }
    delete next.boq_revision_snapshot
    next.timeline_revision_reason = reason || null
  }

  if ('estimate_total_override' in patch || 'estimate_total_note' in patch) {
    let notes = next.cost_plan_notes
    notes = embedEstimateInNotes(notes, patch.estimate_total_override as number | null, patch.estimate_total_note as string | null)
    delete next.estimate_total_override
    delete next.estimate_total_note
    next.cost_plan_notes = notes || null
  }

  return next
}

export function enrichPlanningBoqRevision<T extends PlanningBoqRevisionPatch>(planning: T | null): T | null {
  if (!planning) return null
  const enriched = { ...planning }

  const fromNotes = parseBoqApprovalFromNotes(enriched.cost_plan_notes)
  if (!enriched.boq_revision_approval_file_path && fromNotes.path) {
    enriched.boq_revision_approval_file_path = fromNotes.path
    enriched.boq_revision_approval_file_name = fromNotes.name || null
  }

  const snapCol = enriched.boq_revision_snapshot as BoqRevisionSnapshotLine[] | null | undefined
  if (!snapCol?.length) {
    const fromReason = parseSnapshotFromReason(enriched.timeline_revision_reason)
    if (fromReason.length) enriched.boq_revision_snapshot = fromReason
  }

  const fromEstimate = parseEstimateFromNotes(enriched.cost_plan_notes)
  const enrichedPatch = enriched as PlanningBoqRevisionPatch
  if (enrichedPatch.estimate_total_override == null && fromEstimate.override != null) {
    enrichedPatch.estimate_total_override = fromEstimate.override
    enrichedPatch.estimate_total_note = fromEstimate.note || null
  }

  return enriched
}
