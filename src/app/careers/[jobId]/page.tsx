import { createClient } from '@supabase/supabase-js'
import CareerForm from './CareerForm'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function CareersPage({ params }: { params: { jobId: string } }) {
  const { data: job } = await supabase
    .from('hr_jobs')
    .select('*, tenant:tenants(name, logo_url)')
    .eq('id', params.jobId)
    .single()

  if (!job) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: 'IBM Plex Sans Arabic, sans-serif', direction: 'rtl' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>😕</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>الوظيفة غير موجودة</h2>
          <p style={{ color: '#6b7280' }}>ربما تم إغلاق هذا الإعلان أو انتهت صلاحيته</p>
        </div>
      </div>
    )
  }

  if (job.status === 'مغلق') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: 'IBM Plex Sans Arabic, sans-serif', direction: 'rtl' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>انتهى التقديم على هذه الوظيفة</h2>
          <p style={{ color: '#6b7280' }}>شكراً لاهتمامك، يرجى متابعة إعلاناتنا القادمة</p>
        </div>
      </div>
    )
  }

  return <CareerForm job={job} />
}
