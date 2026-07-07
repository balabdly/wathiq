// src/app/(dashboard)/inventory/materials/page.tsx
// إعادة توجيه لأول تبويب — الوحدة صارت تبويبات مستقلة (items/receive/issue/returns/transfer)
import { redirect } from 'next/navigation'

export default function MaterialsIndexPage() {
  redirect('/inventory/materials/items')
}
