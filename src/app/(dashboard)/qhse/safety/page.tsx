'use client'
import { Shield, AlertTriangle, Plus } from 'lucide-react'

export default function SafetyPage() {
  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-800" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield style={{ width: '22px', height: '22px', color: '#c81e1e' }} />
          السلامة والصحة المهنية (HSE)
        </h1>
        <p className="text-gray-400 text-sm" style={{ marginTop: '2px' }}>إدارة حوادث السلامة، التفتيش، وتصاريح العمل</p>
      </div>
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <AlertTriangle style={{ width: '48px', height: '48px', color: '#fcd34d', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text3)', marginBottom: '16px', fontSize: '0.875rem' }}>قسم السلامة قيد التطوير</p>
        <p style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>سيتضمن: تقارير الحوادث · تصاريح العمل · قوائم التفتيش · معدات الوقاية</p>
      </div>
    </div>
  )
}
