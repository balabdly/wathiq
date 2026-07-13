'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { resolveHrEmployeeId } from '@/lib/hrSelfService'
import toast from 'react-hot-toast'
import { CheckCircle, AlertTriangle, XCircle, Save, ClipboardCheck } from 'lucide-react'
import {
  DVIR_TEMPLATES, DVIR_RESULTS, WORK_TYPES, FleetCategory,
  createQhseDraftFromDvir, nextWorkOrderNo, fmt,
} from '@/lib/fleet-types'

type Assignment = {
  id: number; unit_id: number; project_id?: number
  unit: { id: number; fleet_no: string; name: string; category: string; hour_meter: number; km_reading: number; operational_status: string }
  project?: { name: string }
}

type CheckResponse = { id: string; ok: boolean; note?: string }

export default function FleetOperatorPage() {
  const { tenant, currentUser, activeBranch } = useStore()
  const [hrId, setHrId] = useState<number | null>(null)
  const [operatorName, setOperatorName] = useState('')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selAssignId, setSelAssignId] = useState('')
  const [step, setStep] = useState<'dvir' | 'log'>('dvir')
  const [saving, setSaving] = useState(false)
  const [dvirDone, setDvirDone] = useState(false)
  const [dvirResult, setDvirResult] = useState<string>('')

  const [checklist, setChecklist] = useState<CheckResponse[]>([])
  const [hourMeter, setHourMeter] = useState('')
  const [kmReading, setKmReading] = useState('')
  const [dvirNotes, setDvirNotes] = useState('')

  const [workType, setWorkType] = useState('حفر')
  const [endHour, setEndHour] = useState('')
  const [endKm, setEndKm] = useState('')
  const [fuelLiters, setFuelLiters] = useState('')
  const [logNotes, setLogNotes] = useState('')

  const assignment = assignments.find(a => a.id === Number(selAssignId))
  const unit = assignment?.unit
  const category = (unit?.category || 'معدات ثقيلة') as FleetCategory
  const template = DVIR_TEMPLATES[category]

  useEffect(() => {
    if (!currentUser || !tenant) return
    supabase.from('hr_employees')
      .select('id, name, employee_id')
      .eq('tenant_id', tenant.id)
      .or(`employee_id.eq.${currentUser.id},id.eq.${(currentUser as { hr_employee_id?: number }).hr_employee_id || 0}`)
      .maybeSingle()
      .then(({ data }) => {
        if (data) { setHrId(data.id); setOperatorName(data.name || '') }
        else setHrId(resolveHrEmployeeId(currentUser, []))
      })
  }, [currentUser, tenant?.id])

  useEffect(() => {
    if (tenant && hrId) loadAssignments()
  }, [tenant?.id, hrId])

  useEffect(() => {
    if (unit) {
      setChecklist(template.checklist.map(c => ({ id: c.id, ok: true })))
      setHourMeter(String(unit.hour_meter))
      setKmReading(String(unit.km_reading))
      setEndHour(String(unit.hour_meter))
      setEndKm(String(unit.km_reading))
    }
  }, [unit?.id])

  async function loadAssignments() {
    if (!tenant || !hrId) return
    const { data } = await supabase.from('fleet_assignments')
      .select('id, unit_id, project_id, unit:fleet_units(id,fleet_no,name,category,hour_meter,km_reading,operational_status), project:projects(name)')
      .eq('tenant_id', tenant.id).eq('operator_id', hrId).eq('status', 'نشط')
    const list = (data || []) as Assignment[]
    setAssignments(list)
    if (list.length === 1) setSelAssignId(String(list[0].id))
  }

  function toggleCheck(id: string) {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, ok: !c.ok } : c))
  }

  function computeDvirResult(): string {
    const failedCritical = checklist.some(c => {
      const item = template.checklist.find(t => t.id === c.id)
      return !c.ok && item?.critical
    })
    const anyFailed = checklist.some(c => !c.ok)
    if (failedCritical) return 'موقوف'
    if (anyFailed) return 'ملاحظة'
    return 'سليم'
  }

  async function submitDvir() {
    if (!tenant || !unit || !hrId || !assignment) return
    setSaving(true)
    const result = computeDvirResult()

    try {
      const { data: dvirRow, error } = await supabase.from('fleet_dvir_logs').insert({
        tenant_id: tenant.id,
        unit_id: unit.id,
        assignment_id: assignment.id,
        operator_id: hrId,
        check_date: new Date().toISOString().split('T')[0],
        result,
        checklist_responses: checklist,
        hour_meter: Number(hourMeter) || null,
        km_reading: Number(kmReading) || null,
        notes: dvirNotes || null,
      }).select('id').single()
      if (error) throw error

      await supabase.from('fleet_meter_readings').insert({
        tenant_id: tenant.id, unit_id: unit.id,
        hour_meter: Number(hourMeter) || null, km_reading: Number(kmReading) || null,
        source: 'DVIR',
      })

      let qhseId: number | null = null
      if (result === 'موقوف') {
        qhseId = await createQhseDraftFromDvir({
          tenantId: tenant.id,
          branchId: activeBranch?.id,
          unitName: unit.name,
          fleetNo: unit.fleet_no,
          operatorName,
          projectId: assignment.project_id,
          notes: dvirNotes,
        })
        if (qhseId) await supabase.from('fleet_dvir_logs').update({ qhse_incident_id: qhseId }).eq('id', dvirRow.id)

        const woNo = await nextWorkOrderNo(tenant.id)
        await supabase.from('fleet_work_orders').insert({
          tenant_id: tenant.id, wo_no: woNo, unit_id: unit.id,
          wo_type: 'CM', source: 'داخلي', status: 'مفتوح', priority: 'عاجل',
          description: `عطل من فحص DVIR — ${unit.name}`,
          hour_meter_at_open: Number(hourMeter) || null,
          reporter_id: hrId, dvir_log_id: dvirRow.id,
          project_id: assignment.project_id || null,
        })
        await supabase.from('fleet_units').update({ operational_status: 'معطل' }).eq('id', unit.id)
        toast.error('⛔ المعدة موقوفة — أُنشئ أمر صيانة ومسودة QHSE', { duration: 8000 })
      } else if (result === 'ملاحظة') {
        const woNo = await nextWorkOrderNo(tenant.id)
        await supabase.from('fleet_work_orders').insert({
          tenant_id: tenant.id, wo_no: woNo, unit_id: unit.id,
          wo_type: 'PM', source: 'داخلي', status: 'مفتوح',
          description: `ملاحظة فحص يومي — ${unit.name}`,
          reporter_id: hrId, dvir_log_id: dvirRow.id,
        })
        toast('⚠️ ملاحظة — أُنشئ أمر صيانة خفيف', { icon: '⚠️' })
      } else {
        toast.success('✅ فحص سليم — يمكن التشغيل')
      }

      setDvirDone(true)
      setDvirResult(result)
      if (result !== 'موقوف') setStep('log')
    } catch (err: unknown) {
      toast.error('خطأ: ' + (err as Error).message)
    } finally { setSaving(false) }
  }

  async function submitDailyLog() {
    if (!tenant || !unit || !hrId || !assignment) return
    if (dvirResult === 'موقوف') { toast.error('المعدة موقوفة — لا يمكن تسجيل يومية'); return }
    setSaving(true)

    const startH = Number(hourMeter) || 0
    const endH = Number(endHour) || startH
    const startK = Number(kmReading) || 0
    const endK = Number(endKm) || startK

    try {
      const logDate = new Date().toISOString().split('T')[0]
      const logPayload = {
        tenant_id: tenant.id,
        unit_id: unit.id,
        assignment_id: assignment.id,
        operator_id: hrId,
        log_date: logDate,
        work_type: workType,
        start_hour_meter: startH, end_hour_meter: endH,
        start_km: startK, end_km: endK,
        hours_worked: Math.max(0, endH - startH),
        km_driven: Math.max(0, endK - startK),
        fuel_liters: Number(fuelLiters) || 0,
        notes: logNotes || null,
      }

      const { data: existing } = await supabase.from('fleet_daily_logs')
        .select('id').eq('tenant_id', tenant.id).eq('unit_id', unit.id).eq('log_date', logDate).maybeSingle()

      const { error } = existing?.id
        ? await supabase.from('fleet_daily_logs').update(logPayload).eq('id', existing.id)
        : await supabase.from('fleet_daily_logs').insert(logPayload)
      if (error) throw error

      await supabase.from('fleet_units').update({
        hour_meter: endH, km_reading: endK,
      }).eq('id', unit.id)

      await supabase.from('fleet_meter_readings').insert({
        tenant_id: tenant.id, unit_id: unit.id,
        hour_meter: endH, km_reading: endK, source: 'يومية',
      })

      if (Number(fuelLiters) > 0) {
        await supabase.from('fleet_fuel_logs').insert({
          tenant_id: tenant.id, unit_id: unit.id, operator_id: hrId,
          project_id: assignment.project_id || null,
          fill_date: new Date().toISOString().split('T')[0],
          liters: Number(fuelLiters), hour_meter: endH, km_reading: endK,
        })
      }

      toast.success('✅ تم حفظ اليومية')
      setStep('dvir')
      setDvirDone(false)
      loadAssignments()
    } catch (err: unknown) {
      toast.error('خطأ: ' + (err as Error).message)
    } finally { setSaving(false) }
  }

  if (!hrId) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <AlertTriangle style={{ width: '40px', height: '40px', color: '#e6820a', margin: '0 auto 12px' }} />
        <p style={{ fontWeight: 600 }}>حسابك غير مربوط بملف موظف HR</p>
        <p style={{ fontSize: '0.82rem', color: '#9ca3af', marginTop: '8px' }}>اطلب من الموارد البشرية ربط حسابك بـ hr_employees لتسجيل الفحص واليوميات</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '560px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {(['dvir', 'log'] as const).map(s => (
          <button key={s} type="button" onClick={() => s === 'log' && dvirDone && dvirResult !== 'موقوف' && setStep(s)}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid',
              borderColor: step === s ? '#0d9488' : 'var(--border)',
              background: step === s ? '#f0fdfa' : 'white',
              fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
              opacity: s === 'log' && (!dvirDone || dvirResult === 'موقوف') ? 0.5 : 1,
            }}>
            {s === 'dvir' ? '① فحص ما قبل التشغيل' : '② يومية التشغيل'}
          </button>
        ))}
      </div>

      <div>
        <label style={{ fontWeight: 600, fontSize: '0.875rem', display: 'block', marginBottom: '6px' }}>معدتي اليوم</label>
        <select value={selAssignId} onChange={e => { setSelAssignId(e.target.value); setDvirDone(false); setStep('dvir') }} className="select">
          <option value="">— اختر التخصيص —</option>
          {assignments.map(a => (
            <option key={a.id} value={a.id}>{a.unit.fleet_no} — {a.unit.name} {a.project ? `(${a.project.name})` : ''}</option>
          ))}
        </select>
        {assignments.length === 0 && (
          <p style={{ fontSize: '0.78rem', color: '#e6820a', marginTop: '6px' }}>لا يوجد تخصيص نشط لك — تواصل مع مشرف الأسطول</p>
        )}
      </div>

      {!unit && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>اختر معدة للبدء</p>}

      {unit && step === 'dvir' && (
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <ClipboardCheck style={{ width: '20px', color: '#0d9488' }} />
            <span style={{ fontWeight: 700 }}>{template.name}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {template.checklist.map(item => {
              const resp = checklist.find(c => c.id === item.id)
              const ok = resp?.ok ?? true
              return (
                <button key={item.id} type="button" onClick={() => toggleCheck(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px',
                    borderRadius: '10px', border: `2px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
                    background: ok ? '#f0fdf4' : '#fef2f2', cursor: 'pointer', textAlign: 'right', width: '100%',
                  }}>
                  {ok ? <CheckCircle style={{ width: '20px', color: '#0ea77b', flexShrink: 0 }} />
                    : <XCircle style={{ width: '20px', color: '#c81e1e', flexShrink: 0 }} />}
                  <span style={{ flex: 1, fontWeight: 600, fontSize: '0.88rem' }}>{item.label}</span>
                  {item.critical && <span style={{ fontSize: '0.65rem', color: '#c81e1e', fontWeight: 700 }}>حرج</span>}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>ساعات العداد</label>
              <input type="number" value={hourMeter} onChange={e => setHourMeter(e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>كيلومتر</label>
              <input type="number" value={kmReading} onChange={e => setKmReading(e.target.value)} className="input" dir="ltr" />
            </div>
          </div>
          <input value={dvirNotes} onChange={e => setDvirNotes(e.target.value)} className="input" placeholder="ملاحظات (اختياري)" style={{ marginBottom: '12px' }} />

          <button onClick={submitDvir} disabled={saving} className="btn btn-primary" style={{ width: '100%', background: '#0d9488', padding: '14px' }}>
            {saving ? 'جاري الحفظ...' : 'تسجيل الفحص'}
          </button>
        </div>
      )}

      {unit && step === 'log' && dvirDone && dvirResult !== 'موقوف' && (
        <div className="card" style={{ padding: '16px' }}>
          <p style={{ fontWeight: 700, marginBottom: '12px' }}>يومية — {unit.name}</p>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>نوع العمل</label>
            <select value={workType} onChange={e => setWorkType(e.target.value)} className="select">
              {WORK_TYPES.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div><label style={{ fontSize: '0.78rem', fontWeight: 600 }}>ساعات نهاية</label>
              <input type="number" value={endHour} onChange={e => setEndHour(e.target.value)} className="input" dir="ltr" /></div>
            <div><label style={{ fontSize: '0.78rem', fontWeight: 600 }}>كم نهاية</label>
              <input type="number" value={endKm} onChange={e => setEndKm(e.target.value)} className="input" dir="ltr" /></div>
          </div>
          {Number(endHour) > Number(hourMeter) && (
            <p style={{ fontSize: '0.78rem', color: '#0d9488', marginBottom: '10px' }}>
              ساعات العمل: {fmt(Number(endHour) - Number(hourMeter))} | كم: {fmt(Math.max(0, Number(endKm) - Number(kmReading)))}
            </p>
          )}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>وقود (لتر)</label>
            <input type="number" value={fuelLiters} onChange={e => setFuelLiters(e.target.value)} className="input" dir="ltr" placeholder="0" />
          </div>
          <input value={logNotes} onChange={e => setLogNotes(e.target.value)} className="input" placeholder="ملاحظات" style={{ marginBottom: '12px' }} />
          <button onClick={submitDailyLog} disabled={saving} className="btn btn-primary" style={{ width: '100%', background: '#0d9488', padding: '14px' }}>
            <Save style={{ width: '16px', height: '16px' }} /> حفظ اليومية
          </button>
        </div>
      )}
    </div>
  )
}
