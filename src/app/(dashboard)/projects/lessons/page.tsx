'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { Plus, X, Save, Pencil, Trash2, Search, BookOpen, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Lesson = {
  id: number; tenant_id: string; project_id: number; title: string
  description: string; category: string; lesson_type: string
  phase?: string; impact: string; recommendation?: string
  recorded_by?: string; approved: boolean; created_at: string
  project?: { name: string; code?: string }
}
type Project = { id: number; name: string; code?: string }

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  'إيجابية':       { color: '#0ea77b', bg: '#ecfdf5', icon: '✅' },
  'سلبية':         { color: '#c81e1e', bg: '#fef2f2', icon: '❌' },
  'فرصة تحسين':   { color: '#1a56db', bg: '#eff6ff', icon: '💡' },
}

const IMPACT_COLOR: Record<string, string> = {
  'عالي':   '#c81e1e',
  'متوسط':  '#e6820a',
  'منخفض':  '#0ea77b',
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }

function LessonModal({ lesson, projects, tenantId, onClose, onSave }: {
  lesson: Lesson | null; projects: Project[]; tenantId: string
  onClose: () => void; onSave: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    project_id:     lesson?.project_id ? String(lesson.project_id) : '',
    title:          lesson?.title          || '',
    description:    lesson?.description    || '',
    category:       lesson?.category       || 'تقني',
    lesson_type:    lesson?.lesson_type    || 'إيجابية',
    phase:          lesson?.phase          || '',
    impact:         lesson?.impact         || 'متوسط',
    recommendation: lesson?.recommendation || '',
    recorded_by:    lesson?.recorded_by    || '',
    approved:       lesson?.approved       ?? false,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.title.trim())       { toast.error('عنوان الدرس مطلوب');  return }
    if (!form.description.trim()) { toast.error('وصف الدرس مطلوب');    return }
    if (!form.project_id)         { toast.error('يجب تحديد المشروع');  return }
    setSaving(true)
    const payload = {
      tenant_id: tenantId, project_id: Number(form.project_id),
      title: form.title.trim(), description: form.description.trim(),
      category: form.category, lesson_type: form.lesson_type,
      phase: form.phase || null, impact: form.impact,
      recommendation: form.recommendation || null,
      recorded_by: form.recorded_by || null, approved: form.approved,
    }
    if (lesson) await supabase.from('project_lessons').update(payload).eq('id', lesson.id)
    else        await supabase.from('project_lessons').insert(payload)
    toast.success(lesson ? 'تم التعديل ✅' : '✅ تم تسجيل الدرس')
    onSave(); setSaving(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>
            {lesson ? '✏️ تعديل الدرس' : '💡 تسجيل درس مستفاد'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>

          <div>
            <label style={lbl}>المشروع <span style={{ color: '#c81e1e' }}>*</span></label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className="select">
              <option value="">— اختر المشروع —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>عنوان الدرس <span style={{ color: '#c81e1e' }}>*</span></label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="ملخص مختصر للدرس المستفاد..." />
          </div>

          {/* نوع الدرس */}
          <div>
            <label style={lbl}>نوع الدرس</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('lesson_type', k)}
                  style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, textAlign: 'center',
                    borderColor: form.lesson_type === k ? v.color : 'var(--border)',
                    background:  form.lesson_type === k ? v.bg : 'white',
                    color:       form.lesson_type === k ? v.color : 'var(--text3)' }}>
                  {v.icon} {k}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>التصنيف</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="select">
                {['تقني', 'إداري', 'مالي', 'سلامة', 'جودة', 'تعاقدي'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>مرحلة المشروع</label>
              <select value={form.phase} onChange={e => set('phase', e.target.value)} className="select">
                <option value="">— اختر —</option>
                {['التخطيط', 'التصميم', 'التنفيذ', 'الاختبار', 'الإغلاق'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>الأثر</label>
              <select value={form.impact} onChange={e => set('impact', e.target.value)} className="select">
                {['عالي', 'متوسط', 'منخفض'].map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>الوصف التفصيلي <span style={{ color: '#c81e1e' }}>*</span></label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              className="input" style={{ minHeight: '90px', resize: 'none' }}
              placeholder="ما الذي حدث؟ ما هو السياق؟ ما هي النتائج؟" />
          </div>

          <div>
            <label style={lbl}>التوصية للمشاريع المستقبلية</label>
            <textarea value={form.recommendation} onChange={e => set('recommendation', e.target.value)}
              className="input" style={{ minHeight: '70px', resize: 'none' }}
              placeholder="كيف يمكن الاستفادة من هذا الدرس في المشاريع القادمة؟" />
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>سُجِّل بواسطة</label>
              <input value={form.recorded_by} onChange={e => set('recorded_by', e.target.value)} className="input" placeholder="اسم المهندس..." />
            </div>
            <div style={{ paddingTop: '28px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                <input type="checkbox" checked={form.approved} onChange={e => set('approved', e.target.checked)} />
                معتمد ✓
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: '14px', height: '14px' }} />}
            {lesson ? 'حفظ التعديل' : 'تسجيل الدرس'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectLessonsPage() {
  const { tenant, activeBranch, currentUser } = useStore()
  const [lessons,  setLessons]  = useState<Lesson[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterType,    setFilterType]    = useState('')
  const [filterCategory,setFilterCategory]= useState('')
  const [showModal, setShowModal]  = useState(false)
  const [editLesson,setEditLesson] = useState<Lesson | null>(null)

  const canEdit = currentUser?.role === 'مدير عام' || currentUser?.permissions?.includes('projects_edit')

  useEffect(() => { if (tenant && activeBranch) loadAll() }, [tenant?.id, activeBranch?.id])

  async function loadAll() {
    if (!tenant || !activeBranch) return
    setLoading(true)
    const pRes = await supabase.from('projects')
      .select('id, name, code')
      .eq('tenant_id', tenant.id)
      .eq('branch_id', activeBranch.id)
      .order('name')
    const projList = pRes.data || []
    const projectIds = projList.map(p => p.id)
    let lessonsData: Lesson[] = []
    if (projectIds.length > 0) {
      const lRes = await supabase.from('project_lessons')
        .select('*, project:projects(name, code)')
        .eq('tenant_id', tenant.id)
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
      lessonsData = lRes.data || []
    }
    setLessons(lessonsData)
    setProjects(projList)
    setLoading(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا الدرس؟')) return
    await supabase.from('project_lessons').delete().eq('id', id)
    setLessons(l => l.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  const filtered = lessons.filter(l => {
    if (filterProject  && String(l.project_id) !== filterProject) return false
    if (filterType     && l.lesson_type !== filterType)           return false
    if (filterCategory && l.category !== filterCategory)          return false
    if (search && !l.title.includes(search) && !(l.project?.name || '').includes(search)) return false
    return true
  })

  const stats = {
    total:    lessons.length,
    positive: lessons.filter(l => l.lesson_type === 'إيجابية').length,
    negative: lessons.filter(l => l.lesson_type === 'سلبية').length,
    improve:  lessons.filter(l => l.lesson_type === 'فرصة تحسين').length,
    approved: lessons.filter(l => l.approved).length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            💡 الدروس المستفادة
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '4px' }}>
            توثيق الخبرات والدروس من المشاريع لتحسين الأداء المستقبلي
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditLesson(null); setShowModal(true) }} className="btn btn-primary">
            <Plus style={{ width: '16px', height: '16px' }} /> تسجيل درس
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
        {[
          { label: 'إجمالي الدروس', value: stats.total,    color: '#1a56db', bg: '#eff6ff' },
          { label: 'إيجابية',       value: stats.positive, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'سلبية',         value: stats.negative, color: '#c81e1e', bg: '#fef2f2' },
          { label: 'فرص تحسين',     value: stats.improve,  color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'معتمدة',        value: stats.approved, color: '#0ea77b', bg: '#ecfdf5' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px', background: s.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{s.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px', width: '200px', fontSize: '0.82rem' }} placeholder="بحث..." />
        </div>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="select" style={{ fontSize: '0.82rem', width: 'auto' }}>
          <option value="">كل المشاريع</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="select" style={{ fontSize: '0.82rem', width: 'auto' }}>
          <option value="">كل الأنواع</option>
          {['إيجابية', 'سلبية', 'فرصة تحسين'].map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="select" style={{ fontSize: '0.82rem', width: 'auto' }}>
          <option value="">كل التصنيفات</option>
          {['تقني', 'إداري', 'مالي', 'سلامة', 'جودة', 'تعاقدي'].map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>💡</div>
          <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>لا توجد دروس مسجلة بعد</p>
          {canEdit && <button onClick={() => setShowModal(true)} className="btn btn-primary"><Plus style={{ width: '16px', height: '16px' }} /> تسجيل أول درس</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(lesson => {
            const t = TYPE_CONFIG[lesson.lesson_type]
            return (
              <div key={lesson.id} className="card" style={{ padding: '18px', borderRight: `4px solid ${t.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ background: t.bg, color: t.color, borderRadius: '6px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
                        {t.icon} {lesson.lesson_type}
                      </span>
                      <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem' }}>
                        {lesson.category}
                      </span>
                      {lesson.phase && (
                        <span style={{ background: '#eff6ff', color: '#1a56db', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem' }}>
                          📍 {lesson.phase}
                        </span>
                      )}
                      <span style={{ color: IMPACT_COLOR[lesson.impact], fontSize: '0.72rem', fontWeight: 600 }}>
                        أثر: {lesson.impact}
                      </span>
                      {lesson.approved && (
                        <span style={{ background: '#ecfdf5', color: '#0ea77b', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                          ✓ معتمد
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '6px' }}>{lesson.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                      📁 {lesson.project?.name}
                      {lesson.recorded_by && <span style={{ marginRight: '12px' }}>👤 {lesson.recorded_by}</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => { setEditLesson(lesson); setShowModal(true) }} className="btn btn-ghost btn-xs">
                        <Pencil style={{ width: '13px', height: '13px' }} />
                      </button>
                      <button onClick={() => handleDelete(lesson.id)} className="btn btn-ghost btn-xs" style={{ color: '#c81e1e' }}>
                        <Trash2 style={{ width: '13px', height: '13px' }} />
                      </button>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.7, marginBottom: lesson.recommendation ? '10px' : 0 }}>
                  {lesson.description}
                </p>
                {lesson.recommendation && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#92400e' }}>
                    <strong>💡 التوصية:</strong> {lesson.recommendation}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <LessonModal
          lesson={editLesson}
          projects={projects}
          tenantId={tenant!.id}
          onClose={() => { setShowModal(false); setEditLesson(null) }}
          onSave={() => { setShowModal(false); setEditLesson(null); loadAll() }}
        />
      )}
    </div>
  )
}
