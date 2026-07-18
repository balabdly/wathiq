'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { parseSecBoqCsv } from '@/lib/sec-boq-csv'
import {
  ensureDefaultSecContract, countFrameworkBoqItems, fetchFrameworkBoqItems,
  fetchFrameworkContracts, importFrameworkBoqItems,
} from '@/lib/sec-workflow-service'
import type { FrameworkBoqItem, FrameworkContract } from '@/lib/sec-workflow-service'
import { DEFAULT_SEC_CONTRACT } from '@/lib/sec-workflow'
import { Search, Upload, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'

export default function FrameworkCatalogPage() {
  const { tenant } = useStore()
  const [contracts, setContracts] = useState<FrameworkContract[]>([])
  const [items, setItems] = useState<FrameworkBoqItem[]>([])
  const [count, setCount] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)

  useEffect(() => { if (tenant) load() }, [tenant?.id, search])

  async function load() {
    if (!tenant) return
    setLoading(true)
    const contractId = await ensureDefaultSecContract(tenant.id, DEFAULT_SEC_CONTRACT)
    const [cRes, cntRes] = await Promise.all([
      fetchFrameworkContracts(tenant.id),
      countFrameworkBoqItems(tenant.id, contractId),
    ])
    setContracts(cRes.data || [])
    setCount(cntRes.count || 0)
    if ((cntRes.count || 0) > 0) {
      const { data } = await fetchFrameworkBoqItems(tenant.id, contractId, search)
      setItems(data || [])
    } else {
      setItems([])
    }
    setLoading(false)
  }

  async function importBoq() {
    if (!tenant) return
    setImporting(true)
    try {
      const contractId = await ensureDefaultSecContract(tenant.id, DEFAULT_SEC_CONTRACT)
      const res = await fetch('/data/sec-contract-items.csv')
      const text = await res.text()
      const items = parseSecBoqCsv(text)

      const { error } = await importFrameworkBoqItems(tenant.id, contractId, items)
      if (error) throw error
      toast.success(`تم استيراد ${items.length} بند من العقد ${DEFAULT_SEC_CONTRACT}`)
      load()
    } catch (e: any) {
      toast.error(e.message || 'فشل الاستيراد')
    }
    setImporting(false)
  }

  const contract = contracts.find(c => c.contract_no === DEFAULT_SEC_CONTRACT)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen style={{ width: '22px', height: '22px', color: '#1a56db' }} />
            العقد الإطاري — بنود Unit Rate
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text3)' }}>
            العقد {DEFAULT_SEC_CONTRACT} — الشركة السعودية للكهرباء
          </p>
        </div>
        <button onClick={importBoq} disabled={importing} className="btn btn-primary">
          <Upload style={{ width: '16px', height: '16px' }} />
          {importing ? 'جاري الاستيراد...' : count > 0 ? 'تحديث البنود' : 'استيراد 297 بند'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
        {[
          { label: 'رقم العقد', value: contract?.contract_no || DEFAULT_SEC_CONTRACT, color: '#1a56db', bg: '#eff6ff' },
          { label: 'عدد البنود', value: count, color: '#0ea77b', bg: '#ecfdf5' },
          { label: 'العميل', value: contract?.client_name?.slice(0, 12) || 'SEC', color: '#6b7280', bg: '#f9fafb' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px', background: s.bg }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {count > 0 && (
        <div style={{ position: 'relative', width: 'fit-content' }}>
          <Search style={{ width: '14px', height: '14px', color: 'var(--text3)', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ paddingRight: '32px', width: '240px' }} placeholder="بحث برقم أو وصف البند..." />
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>جاري التحميل...</div>
      ) : count === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text3)', marginBottom: '16px' }}>لم تُستورد بنود العقد بعد</p>
          <button onClick={importBoq} disabled={importing} className="btn btn-primary">استيراد من العقد الموحد</button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'auto', maxHeight: '70vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                {['رقم البند', 'الوصف', 'الوحدة', 'سعر الوحدة'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, borderBottom: '2px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }} dir="ltr">{it.item_code}</td>
                  <td style={{ padding: '8px 12px', maxWidth: '400px' }}>{it.description_ar || it.description_en || '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{it.unit}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0ea77b' }}>{Number(it.unit_price).toLocaleString('ar-SA')} ر.س</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
