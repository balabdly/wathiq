// src/components/finance/purchases/shared.tsx
// مكوّنات مشتركة بين مودالات وحدة المشتريات — البنود، الإجماليات، وجهة التسليم
'use client'
import { Plus, Trash2 } from 'lucide-react'
import type { POItem, Project, Warehouse } from '@/lib/purchases-types'
import { PURCHASE_ASSET_OPTIONS } from '@/lib/account-codes'

export const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }

export function ItemsTable({ items, onChange }: { items: POItem[]; onChange: (items: POItem[]) => void }) {
  function update(idx: number, k: keyof POItem, v: any) {
    const next = [...items]
    next[idx] = { ...next[idx], [k]: v }
    if (k === 'quantity' || k === 'unit_price') next[idx].total = Number(next[idx].quantity) * Number(next[idx].unit_price)
    onChange(next)
  }
  function add()               { onChange([...items, { description: '', quantity: 1, unit: 'وحدة', unit_price: 0, total: 0 }]) }
  function remove(idx: number) { if (items.length > 1) onChange(items.filter((_, i) => i !== idx)) }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151' }}>البنود</label>
        <button type="button" onClick={add} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
          <Plus style={{ width: '13px', height: '13px' }} /> إضافة بند
        </button>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg2)' }}>
              {['الوصف', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي', ''].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text3)', fontSize: '0.72rem' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 8px', minWidth: '180px' }}>
                  <input value={item.description} onChange={e => update(idx, 'description', e.target.value)} onMouseDown={e => e.stopPropagation()}
                    style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }} placeholder="وصف المادة أو الخدمة" />
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <input type="number" value={item.quantity} onChange={e => update(idx, 'quantity', e.target.value)} onMouseDown={e => e.stopPropagation()}
                    style={{ width: '70px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" />
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <select value={item.unit} onChange={e => update(idx, 'unit', e.target.value)}
                    style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}>
                    {['وحدة', 'م²', 'م طولي', 'طن', 'كجم', 'لتر', 'يوم', 'ساعة', 'مقطوعة'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <input type="number" value={item.unit_price} onChange={e => update(idx, 'unit_price', e.target.value)} onMouseDown={e => e.stopPropagation()}
                    style={{ width: '100px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', direction: 'ltr' }} min="0" />
                </td>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{Number(item.total).toLocaleString()} ر.س</td>
                <td style={{ padding: '6px 8px' }}>
                  <button type="button" onClick={() => remove(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e' }}>
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function TotalsBox({ subtotal, vatRate, vatAmount, total }: { subtotal: number; vatRate: number; vatAmount: number; total: number }) {
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>المجموع قبل الضريبة</span>
          <span style={{ fontWeight: 600 }}>{subtotal.toLocaleString()} ر.س</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>ضريبة القيمة المضافة ({vatRate}%)</span>
          <span style={{ fontWeight: 600, color: '#e6820a' }}>{vatAmount.toLocaleString()} ر.س</span>
        </div>
        <div style={{ borderTop: '2px solid #fde68a', paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>الإجمالي</span>
          <span style={{ fontWeight: 700, fontSize: '1.3rem', color: '#e6820a' }}>{total.toLocaleString()} ر.س</span>
        </div>
      </div>
    </div>
  )
}

export function DeliveryField({ value, warehouseId, assetType, projects, warehouses, onChange, onAssetTypeChange }: {
  value: string; warehouseId?: string; assetType?: string; projects: Project[]; warehouses: Warehouse[]
  onChange: (delivery: string, warehouseId?: string) => void
  onAssetTypeChange?: (t: string) => void
}) {
  return (
    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px 14px' }}>
      <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0369a1', display: 'block', marginBottom: '10px' }}>📦 وجهة التسليم / تصنيف الشراء</label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {[{ val: 'مستودع', icon: '🏪', desc: 'يُضاف للمخزون' }, { val: 'موقع العمل', icon: '🏗️', desc: 'مباشرة للمشروع' }, { val: 'أصل ثابت', icon: '🏭', desc: 'سيارة / معدة / جهاز' }].map(opt => (
          <button key={opt.val} type="button" onClick={() => onChange(opt.val, undefined)}
            style={{ flex: 1, minWidth: '100px', padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, textAlign: 'center',
              borderColor: value === opt.val ? '#0369a1' : 'var(--border)', background: value === opt.val ? '#e0f2fe' : 'white', color: value === opt.val ? '#0369a1' : '#6b7280' }}>
            <div>{opt.icon}</div><div style={{ marginTop: '2px' }}>{opt.val}</div><div style={{ fontSize: '0.62rem', opacity: 0.7, marginTop: '1px' }}>{opt.desc}</div>
          </button>
        ))}
      </div>
      {value === 'مستودع' && (
        <select value={warehouseId || ''} onChange={e => onChange('مستودع', e.target.value)} className="select" style={{ marginTop: '4px' }}>
          <option value="">— اختر المستودع —</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      )}
      {value === 'أصل ثابت' && onAssetTypeChange && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          {PURCHASE_ASSET_OPTIONS.map(t => (
            <button key={t.val} type="button" onClick={() => onAssetTypeChange(t.val)}
              style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, textAlign: 'center',
                borderColor: assetType === t.val ? '#065f46' : 'var(--border)', background: assetType === t.val ? '#d1fae5' : 'white', color: assetType === t.val ? '#065f46' : 'var(--text3)' }}>
              <div>{t.icon}</div><div style={{ marginTop: '2px' }}>{t.val}</div><div style={{ fontSize: '0.62rem', opacity: 0.7, marginTop: '1px' }}>{t.account}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
