// src/components/inventory/MaterialSearchInput.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import type { InventoryMaterial } from './types'

export default function MaterialSearchInput({ materials, value, onChange }: {
  materials: InventoryMaterial[]
  value: string
  onChange: (name: string, unit: string, matId?: number) => void
}) {
  const [query, setQuery] = useState(value)
  const [open, setOpen]   = useState(false)
  const ref               = useRef<HTMLDivElement>(null)

  const results = query.length >= 1
    ? materials.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.catalog_no.toLowerCase().includes(query.toLowerCase()) ||
        (m.sec_number || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange('', '') }}
        onFocus={() => setOpen(true)}
        className="input text-sm"
        placeholder="ابحث بالاسم أو الكود أو SEC..."
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {results.map(m => (
            <button key={m.id} type="button"
              onClick={() => { onChange(m.name, m.unit, m.id); setQuery(m.name); setOpen(false) }}
              className="w-full text-right px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-gray-800">{m.name}</div>
                <div className="text-xs text-gray-400">
                  {m.catalog_no}
                  {m.sec_number && <span className="text-blue-500 mr-2">SEC: {m.sec_number}</span>}
                </div>
              </div>
              <div className="text-xs font-bold text-gray-700 flex-shrink-0">{m.qty} {m.unit}</div>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm text-gray-400 text-center">
          لا توجد مادة — يجب تعريفها أولاً
        </div>
      )}
    </div>
  )
}
