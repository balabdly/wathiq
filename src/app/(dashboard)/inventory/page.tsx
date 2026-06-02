// ══════════════════════════════════════════════════════════
// ملف التعديلات المطلوبة على: src/app/(dashboard)/inventory/page.tsx
// ══════════════════════════════════════════════════════════

// ── 1. أضف ReturnModal قبل InventoryCheckModal مباشرة ──────────────

function ReturnModal({ materials, projects, onClose, onSave }: {
  materials: Material[]
  projects: { id: number; name: string }[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [returnType, setReturnType] = useState<'إرجاع للكهرباء'|'تحويل لمشروع'>('إرجاع للكهرباء')
  const [fromProject, setFromProject] = useState<number|''>('')
  const [toProject, setToProject] = useState<number|''>('')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<{ id: number; mat: Material|null; qty: number }[]>([{ id: 1, mat: null, qty: 1 }])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fromProject) { toast.error('يجب تحديد المشروع المصدر'); return }
    if (returnType === 'تحويل لمشروع' && !toProject) { toast.error('يجب تحديد المشروع المستقبل'); return }
    if (fromProject === toProject) { toast.error('لا يمكن التحويل لنفس المشروع'); return }
    const valid = rows.filter(r => r.mat && r.qty > 0)
    if (valid.length === 0) { toast.error('أضف مادة واحدة على الأقل'); return }
    setSaving(true)
    const fromProjectName = projects.find(p => p.id === Number(fromProject))?.name || ''
    const toProjectName   = projects.find(p => p.id === Number(toProject))?.name || ''
    await onSave({ returnType, fromProjectName, toProjectName, returnDate, referenceNo, notes, rows: valid })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>↩️</span> إرجاع مواد فائضة
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">إرجاع للكهرباء أو تحويل لمشروع آخر</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            {/* نوع الإرجاع */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الإرجاع</label>
              <div className="grid grid-cols-2 gap-3">
                {(['إرجاع للكهرباء','تحويل لمشروع'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setReturnType(t)}
                    style={{
                      padding: '10px', borderRadius: '10px', border: '2px solid', cursor: 'pointer',
                      fontWeight: 600, fontSize: '0.875rem',
                      borderColor: returnType === t ? (t === 'إرجاع للكهرباء' ? '#1a56db' : '#0ea77b') : 'var(--border)',
                      background: returnType === t ? (t === 'إرجاع للكهرباء' ? '#eff6ff' : '#ecfdf5') : 'white',
                      color: returnType === t ? (t === 'إرجاع للكهرباء' ? '#1a56db' : '#0ea77b') : 'var(--text3)',
                    }}>
                    {t === 'إرجاع للكهرباء' ? '⚡ إرجاع للكهرباء' : '🔄 تحويل لمشروع'}
                  </button>
                ))}
              </div>
            </div>

            {/* المشاريع */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  من مشروع <span className="text-red-500">*</span>
                </label>
                <select value={fromProject} onChange={e => setFromProject(e.target.value ? Number(e.target.value) : '')} className="select" required>
                  <option value="">— اختر المشروع —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {returnType === 'تحويل لمشروع' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    إلى مشروع <span className="text-red-500">*</span>
                  </label>
                  <select value={toProject} onChange={e => setToProject(e.target.value ? Number(e.target.value) : '')} className="select" required>
                    <option value="">— اختر المشروع —</option>
                    {projects.filter(p => p.id !== Number(fromProject)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* التاريخ والمرجع */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الإرجاع</label>
                <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم محضر الإرجاع</label>
                <input value={referenceNo} onChange={e => setReferenceNo(e.target.value)} className="input" dir="ltr" placeholder="RET-2024-001" />
              </div>
            </div>

            {/* المواد */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">المواد المرجعة</label>
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={row.id} className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-6 h-9 flex items-center justify-center text-xs text-gray-400">{i + 1}</div>
                    <div className="flex-1">
                      <MaterialSearchInput
                        materials={materials}
                        value={row.mat?.name || ''}
                        onChange={(name, unit, matId) => {
                          const m = materials.find(x => x.id === matId)
                          setRows(r => r.map(x => x.id === row.id ? { ...x, mat: m || null } : x))
                        }} />
                    </div>
                    <input type="number" value={row.qty} min="1"
                      onChange={e => setRows(r => r.map(x => x.id === row.id ? { ...x, qty: Number(e.target.value) } : x))}
                      className="w-20 input text-sm text-center flex-shrink-0" />
                    {row.mat && <span className="h-9 flex items-center text-xs text-gray-500 flex-shrink-0">{row.mat.unit}</span>}
                    {rows.length > 1 && (
                      <button type="button" onClick={() => setRows(r => r.filter(x => x.id !== row.id))}
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button"
                onClick={() => setRows(r => [...r, { id: Date.now(), mat: null, qty: 1 }])}
                className="mt-2 btn btn-ghost btn-sm w-full border border-dashed border-gray-300">
                <Plus className="w-3.5 h-3.5" /> إضافة مادة
              </button>
            </div>

            {/* ملاحظات */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="اختياري" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary"
              style={{ background: returnType === 'إرجاع للكهرباء' ? '#1a56db' : '#0ea77b' }}>
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {returnType === 'إرجاع للكهرباء' ? '⚡ تأكيد الإرجاع' : '🔄 تأكيد التحويل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// التعديلات على InventoryPage function
// ══════════════════════════════════════════════════════════

/*
── 2. أضف هذه الـ states بعد [showCheckModal, setCheckModal] ──

  const [showReturn, setReturn]       = useState(false)
  const [returns, setReturns]         = useState<any[]>([])
  const [loadingReturns, setLoadingReturns] = useState(false)


── 3. أضف handleReturn بعد handleInventoryCheck ──

  async function handleReturn(data: any) {
    if (!tenant || !activeBranch) return
    for (const row of data.rows) {
      if (!row.mat) continue
      const newQty = row.mat.qty - row.qty
      if (newQty < 0) { toast.error('رصيد "' + row.mat.name + '" غير كافٍ'); return }
      const wh = warehouses.find(w => w.id === row.mat.warehouse_id)
      await ledgerApi.insert({
        tenant_id: tenant.id, branch_id: activeBranch.id,
        type: data.returnType === 'إرجاع للكهرباء' ? 'إرجاع للكهرباء' : 'تحويل لمشروع',
        mat_name: row.mat.name, unit: row.mat.unit,
        qty: row.qty, qty_before: row.mat.qty, qty_after: newQty,
        wh_name: wh?.name || '',
        project_name: data.fromProjectName,
        dispatch_note: data.returnType === 'تحويل لمشروع'
          ? 'تحويل إلى مشروع: ' + data.toProjectName
          : 'إرجاع للكهرباء — محضر: ' + (data.referenceNo || '—'),
        doc_code: data.referenceNo || undefined,
      })
      await materialsApi.upsert({ ...row.mat, qty: newQty })
      if (data.returnType === 'تحويل لمشروع') {
        await ledgerApi.insert({
          tenant_id: tenant.id, branch_id: activeBranch.id,
          type: 'توريد', mat_name: row.mat.name, unit: row.mat.unit,
          qty: row.qty, qty_before: 0, qty_after: row.qty,
          wh_name: wh?.name || '',
          project_name: data.toProjectName,
          dispatch_note: 'تحويل من مشروع: ' + data.fromProjectName,
        })
      }
    }
    await supabase.from('stock_returns').insert({
      tenant_id: tenant.id,
      return_type: data.returnType,
      from_project: data.fromProjectName,
      to_project: data.toProjectName || null,
      return_date: data.returnDate,
      reference_no: data.referenceNo || null,
      notes: data.notes || null,
      mat_name: data.rows.map((r: any) => r.mat?.name).filter(Boolean).join('، '),
      qty: data.rows.reduce((s: number, r: any) => s + r.qty, 0),
      unit: data.rows[0]?.mat?.unit || '',
      status: 'مكتمل',
    })
    await loadData(); setReturn(false); await loadLedger(true)
    toast.success('✅ تم ' + data.returnType + ' بنجاح')
  }


── 4. أضف loadReturns بعد handleReturn ──

  async function loadReturns() {
    if (!tenant) return
    setLoadingReturns(true)
    const { data } = await supabase.from('stock_returns')
      .select('*').eq('tenant_id', tenant.id)
      .order('return_date', { ascending: false })
    setReturns(data || [])
    setLoadingReturns(false)
  }


── 5. عدّل activeTab type ──
OLD: useState<'warehouses'|'ledger'|'byproject'>('warehouses')
NEW: useState<'warehouses'|'ledger'|'byproject'|'returns'>('warehouses')


── 6. أضف زر الإرجاع في grid الأزرار بعد زر الجرد ──
  { id:'returns', icon:<ArrowDownToLine className="w-6 h-6" style={{transform:'scaleX(-1)'}}/>, label:'إرجاع مواد', sub:'للكهرباء أو مشروع', color:'bg-teal-500 hover:bg-teal-600', onClick:()=>setReturn(true) },


── 7. أضف تاب الإرجاع في قائمة التابات ──
OLD: { id:'byproject', label:'📊 مواد المشاريع', onSelect: () => loadLedger() },
NEW:
  { id:'byproject', label:'📊 مواد المشاريع', onSelect: () => loadLedger() },
  { id:'returns',   label:'↩️ الإرجاع',       onSelect: () => loadReturns() },
*/

// ── 8. محتوى تاب الإرجاع — أضفه بعد نهاية تاب byproject ──

// {activeTab === 'returns' && (
function ReturnsTabRender({ returns, loadingReturns }: { returns: any[], loadingReturns: boolean }) {
  return (
    <div className="space-y-4">
      {loadingReturns ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : returns.length === 0 ? (
        <div className="card p-16 text-center">
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>↩️</div>
          <p className="text-gray-400">لا توجد إرجاعات بعد</p>
          <p className="text-xs text-gray-400 mt-1">استخدم زر "إرجاع مواد" لتسجيل إرجاع جديد</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  {['النوع','من مشروع','إلى','المواد','الكمية','التاريخ','رقم المحضر','الحالة'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returns.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--bg2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge ${r.return_type === 'إرجاع للكهرباء' ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: '0.72rem' }}>
                        {r.return_type === 'إرجاع للكهرباء' ? '⚡ للكهرباء' : '🔄 لمشروع'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: '0.875rem' }}>{r.from_project}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text3)', fontSize: '0.875rem' }}>{r.to_project || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: 'var(--text3)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.mat_name}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>{r.qty} {r.unit}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.875rem' }}>{r.return_date}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text3)' }}>{r.reference_no || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>✅ مكتمل</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700, fontSize: '0.82rem' }}>
                  <td style={{ padding: '10px 14px' }} colSpan={8}>الإجمالي: {returns.length} عملية إرجاع</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 9. أضف في نهاية الـ modals ──
// {showReturn && <ReturnModal materials={materials} projects={projectsList} onClose={() => setReturn(false)} onSave={handleReturn} />}
