/**
 * Preflight only: assess existing Wathiq invoice data without implying approval
 * or producing an official invoice. Signing, certification and ZATCA calls
 * deliberately remain disabled until a server-side EGS is implemented.
 */
export type InvoiceDataForPreflight = {
  invoiceNumber?: string
  invoiceDate?: string
  vatRate?: number
  subtotal?: number
  vatAmount?: number
  totalAmount?: number
  seller: { name?: string; vatNumber?: string; street?: string; district?: string; city?: string; postalCode?: string }
  buyer: { name?: string; vatNumber?: string; street?: string; district?: string; city?: string; postalCode?: string }
  items: { description?: string; quantity?: number; unitPrice?: number; total?: number }[]
}
export type PreflightIssue = {field:string;message:string}
export function assessInvoiceForPhase2(data: InvoiceDataForPreflight): {
  dataComplete: boolean
  issues: PreflightIssue[]
  productionReady: false
} {
  const issues: PreflightIssue[] = []
  const add = (field:string,message:string) => issues.push({field,message})
  if (!data.invoiceNumber?.trim()) add('invoiceNumber','رقم الفاتورة غير موجود')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.invoiceDate || '')) add('invoiceDate','تاريخ الإصدار غير مكتمل')
  for(const side of ['seller','buyer'] as const) {
    const party = data[side]
    const title = side === 'seller' ? 'المنشأة' : 'العميل'
    if (!party.name?.trim()) add(side + '.name','اسم ' + title + ' مطلوب')
    if (!/^3\d{13}3$/.test(party.vatNumber || '')) {
      add(side + '.vatNumber','الرقم الضريبي لـ' + title + ' مطلوب لفاتورة B2B القياسية')
    }
    for(const key of ['street','district','city','postalCode'] as const) {
      if (!party[key]?.trim()) add(side + '.' + key,'العنوان الوطني لـ' + title + ' غير مكتمل')
    }
  }
  if (data.vatRate !== 15) add('vatRate','النسخة الأولية تدعم فقط فواتير B2B بنسبة 15%')
  if (!data.items?.length) add('items','أضف بندًا واحدًا على الأقل')
  else data.items.forEach((item,i) => {
    if (!item.description?.trim()) add('items.' + i + '.description','وصف البند مطلوب')
    if (!Number.isFinite(item.quantity) || Number(item.quantity) <= 0) add('items.' + i + '.quantity','الكمية غير صالحة')
    if (!Number.isFinite(item.unitPrice) || Number(item.unitPrice) < 0) add('items.' + i + '.unitPrice','سعر الوحدة غير صالح')
    if (!Number.isFinite(item.total) || Math.abs(Number(item.quantity) * Number(item.unitPrice) - Number(item.total)) > .01)
      add('items.' + i + '.total','قيمة البند لا تطابق الكمية والسعر')
  })
  if (![data.subtotal,data.vatAmount,data.totalAmount].every(n => Number.isFinite(n) && Number(n) >= 0) ||
      Math.abs(Number(data.subtotal) * .15 - Number(data.vatAmount)) > .01 ||
      Math.abs(Number(data.subtotal) + Number(data.vatAmount) - Number(data.totalAmount)) > .01) {
    add('totals','إجماليات الفاتورة لا تتطابق')
  }
  // Even a complete input is NOT ready for legal issuance without
  // UUID, ICV/PIH, certified EGS signature, compliant QR and clearance.
  return {dataComplete:issues.length===0,issues,productionReady:false}
}
