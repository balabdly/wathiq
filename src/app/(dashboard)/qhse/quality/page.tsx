'use client'
import { CheckCircle } from 'lucide-react'

export default function QualityPage() {
  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle style={{ width: '22px', height: '22px', color: '#1a56db' }} />
          ضبط الجودة (QC)
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>إدارة عدم المطابقة والإجراءات التصحيحية</p>
      </div>
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <CheckCircle style={{ width: '48px', height: '48px', color: '#93c5fd', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text3)', marginBottom: '16px', fontSize: '0.875rem' }}>قسم الجودة قيد التطوير</p>
        <p style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>سيتضمن: عدم المطابقة · الإجراءات التصحيحية · شهادات الجودة · المراجعات الدورية</p>
      </div>
    </div>
  )
}
