'use client'
import { Leaf } from 'lucide-react'

export default function EnvironmentPage() {
  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Leaf style={{ width: '22px', height: '22px', color: '#0ea77b' }} />
          الإدارة البيئية (ENV)
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>إدارة النفايات والانبعاثات والامتثال البيئي</p>
      </div>
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <Leaf style={{ width: '48px', height: '48px', color: '#6ee7b7', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text3)', marginBottom: '16px', fontSize: '0.875rem' }}>قسم البيئة قيد التطوير</p>
        <p style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>سيتضمن: إدارة النفايات · الانبعاثات · المواد الخطرة · الامتثال البيئي</p>
      </div>
    </div>
  )
}
