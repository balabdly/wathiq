/**
 * ZATCA Phase 2: deliberately UNSIGNED UBL 2.1 XML groundwork.
 *
 * DO NOT send, issue, archive as an official invoice, or treat this document as
 * ZATCA-compliant. A server-side EGS still must add its signed XAdES extension,
 * PIH/ICV state, hash, compliant QR, cryptographic stamp, validate via SDK,
 * and obtain clearance/reporting with the correct CSID.
 *
 * Initial slice intentionally supports only standard B2B invoices at 15% VAT,
 * with no allowances/charges/prepayments or special tax treatments.
 */
export type PostalAddress = {
  street: string
  district: string
  city: string
  postalCode: string
  countryCode: 'SA'
}
export type InvoiceParty = {
  name: string
  vatNumber: string
  address: PostalAddress
  commercialRegistration?: string
}
export type StandardInvoiceLine = {
  description: string
  quantity: number
  unitCode: string
  unitPrice: number
  lineNetAmount: number
  vatRate: 15
}
export type UnsignedStandardInvoiceInput = {
  invoiceNumber: string
  uuid: string
  issueDate: string
  issueTime: string
  currency: 'SAR'
  icv: number
  previousInvoiceHash: string
  seller: InvoiceParty
  buyer: InvoiceParty
  lines: StandardInvoiceLine[]
  netAmount: number
  vatAmount: number
  totalAmount: number
}
export type ZatcaIssue = { field: string; message: string }

const money = (value: number): string => value.toFixed(2)
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100
const safeXml = (value: string | number): string => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

export function validateUnsignedStandardInvoice(invoice: UnsignedStandardInvoiceInput): ZatcaIssue[] {
  const issues: ZatcaIssue[] = []
  const missing = (field: string, value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) issues.push({field, message: 'حقل إلزامي غير مكتمل'})
  }
  const checkParty = (name: 'seller' | 'buyer', party: InvoiceParty) => {
    if (!party || !party.address) {
      issues.push({ field: name, message: 'بيانات الطرف وعنوانه غير مكتملة' })
      return
    }
    missing(name + '.name', party.name)
    if (!/^3\d{13}3$/.test(party.vatNumber || '')) {
      issues.push({field:name + '.vatNumber',message:'الرقم الضريبي يجب أن يتكون من 15 رقمًا ويبدأ وينتهي بالرقم 3'})
    }
    for (const key of ['street','district','city','postalCode'] as const) {
      missing(name + '.address.' + key, party.address[key])
    }
    if (party.address.countryCode !== 'SA') {
      issues.push({field:name + '.address.countryCode',message:'الإصدار الأول يدعم العناوين السعودية فقط'})
    }
    if (!/^\d{5}$/.test(party.address.postalCode || '')) {
      issues.push({field:name + '.address.postalCode',message:'الرمز البريدي السعودي يجب أن يتكون من خمسة أرقام'})
    }
  }
  missing('invoiceNumber', invoice.invoiceNumber)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invoice.uuid || '')) {
    issues.push({field:'uuid',message:'UUID غير صالح؛ يجب توليده وحفظه لكل فاتورة مرة واحدة'})
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice.issueDate || '') ||
    Number.isNaN(new Date(invoice.issueDate + 'T00:00:00Z').getTime())) {
    issues.push({field:'issueDate',message:'تاريخ الإصدار غير صالح'})
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(invoice.issueTime || '')) {
    issues.push({field:'issueTime',message:'وقت الإصدار إلزامي بنمط HH:mm:ss'})
  }
  if (invoice.currency !== 'SAR') issues.push({field:'currency',message:'النموذج الأول يدعم الريال السعودي فقط'})
  if (!Number.isSafeInteger(invoice.icv) || invoice.icv < 1) {
    issues.push({field:'icv',message:'يجب تخصيص عداد متسلسل موجب بواسطة قاعدة البيانات'})
  }
  if (!/^[A-Za-z0-9+/]{43}=$/.test(invoice.previousInvoiceHash || '')) {
    issues.push({field:'previousInvoiceHash',message:'بصمة الفاتورة السابقة Base64/32 bytes مطلوبة من سجل التوقيع'})
  }
  checkParty('seller',invoice.seller)
  checkParty('buyer',invoice.buyer)
  if (!Array.isArray(invoice.lines) || invoice.lines.length === 0) {
    issues.push({field:'lines',message:'الفاتورة يجب أن تحتوي على بند واحد على الأقل'})
  } else {
    invoice.lines.forEach((line,index) => {
      if (!line.description?.trim()) issues.push({field:'lines.' + index + '.description',message:'وصف البند مطلوب'})
      if (!line.unitCode?.trim()) issues.push({field:'lines.' + index + '.unitCode',message:'رمز الوحدة UBL مطلوب'})
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) issues.push({field:'lines.' + index + '.quantity',message:'الكمية غير صالحة'})
      if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) issues.push({field:'lines.' + index + '.unitPrice',message:'سعر الوحدة غير صالح'})
      if (line.vatRate !== 15) issues.push({field:'lines.' + index + '.vatRate',message:'هذه النسخة تدعم الضريبة القياسية 15% فقط'})
      if (!Number.isFinite(line.lineNetAmount) || line.lineNetAmount < 0 ||
          Math.abs(roundMoney(line.quantity * line.unitPrice) - line.lineNetAmount) > 0.01) {
        issues.push({field:'lines.' + index + '.lineNetAmount',message:'إجمالي البند لا يطابق الكمية × السعر'})
      }
    })
  }
  const net = (invoice.lines || []).reduce((sum,line) => sum + (Number(line.lineNetAmount) || 0), 0)
  if (![invoice.netAmount,invoice.vatAmount,invoice.totalAmount].every(v=>Number.isFinite(v) && v >= 0) ||
      Math.abs(roundMoney(net) - invoice.netAmount) > 0.01 ||
      Math.abs(roundMoney(invoice.netAmount * 0.15) - invoice.vatAmount) > 0.01 ||
      Math.abs(roundMoney(invoice.netAmount + invoice.vatAmount) - invoice.totalAmount) > 0.01) {
    issues.push({field:'totals',message:'إجماليات البنود والضريبة والمبلغ المستحق لا تتطابق'})
  }
  return issues
}

function partyXml(party: InvoiceParty, tag: 'AccountingSupplierParty'|'AccountingCustomerParty'): string {
  const address = party.address
  const registration = party.commercialRegistration
    ? '<cac:PartyIdentification><cbc:ID schemeID="CRN">' + safeXml(party.commercialRegistration) + '</cbc:ID></cac:PartyIdentification>'
    : ''
  return [
    '<cac:' + tag + '><cac:Party>',
    registration,
    '<cac:PostalAddress>',
    '<cbc:StreetName>' + safeXml(address.street) + '</cbc:StreetName>',
    '<cbc:CitySubdivisionName>' + safeXml(address.district) + '</cbc:CitySubdivisionName>',
    '<cbc:CityName>' + safeXml(address.city) + '</cbc:CityName>',
    '<cbc:PostalZone>' + safeXml(address.postalCode) + '</cbc:PostalZone>',
    '<cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>',
    '</cac:PostalAddress>',
    '<cac:PartyTaxScheme><cbc:CompanyID>' + safeXml(party.vatNumber) + '</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>',
    '<cac:PartyLegalEntity><cbc:RegistrationName>' + safeXml(party.name) + '</cbc:RegistrationName></cac:PartyLegalEntity>',
    '</cac:Party></cac:' + tag + '>',
  ].join('')
}

/**
 * XML structural starting point for tests. Explicitly NOT signed, not a valid
 * production e-invoice, and not to be exposed as a user-downloadable invoice.
 */
export function buildUnsignedStandardInvoiceXml(invoice: UnsignedStandardInvoiceInput): string {
  const issues = validateUnsignedStandardInvoice(invoice)
  if (issues.length) {
    throw new Error('Unsigned invoice is incomplete: ' + issues.map(issue => issue.field).join(', '))
  }
  const lines = invoice.lines.map((line,index) => {
    const lineVat = roundMoney(line.lineNetAmount * 0.15)
    return [
      '<cac:InvoiceLine>',
      '<cbc:ID>' + String(index + 1) + '</cbc:ID>',
      '<cbc:InvoicedQuantity unitCode="' + safeXml(line.unitCode) + '">' + String(line.quantity) + '</cbc:InvoicedQuantity>',
      '<cbc:LineExtensionAmount currencyID="SAR">' + money(line.lineNetAmount) + '</cbc:LineExtensionAmount>',
      '<cac:TaxTotal><cbc:TaxAmount currencyID="SAR">' + money(lineVat) + '</cbc:TaxAmount>',
      '<cbc:RoundingAmount currencyID="SAR">' + money(roundMoney(line.lineNetAmount + lineVat)) + '</cbc:RoundingAmount></cac:TaxTotal>',
      '<cac:Item><cbc:Name>' + safeXml(line.description) + '</cbc:Name>',
      '<cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>15.00</cbc:Percent>',
      '<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>',
      '<cac:Price><cbc:PriceAmount currencyID="SAR">' + money(line.unitPrice) + '</cbc:PriceAmount></cac:Price>',
      '</cac:InvoiceLine>',
    ].join('')
  }).join('')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- UNSIGNED XML STRUCTURE FOR DEVELOPMENT ONLY; NOT A ZATCA INVOICE -->',
    '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
    ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
    ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">',
    '<cbc:ProfileID>reporting:1.0</cbc:ProfileID>',
    '<cbc:ID>' + safeXml(invoice.invoiceNumber) + '</cbc:ID>',
    '<cbc:UUID>' + safeXml(invoice.uuid) + '</cbc:UUID>',
    '<cbc:IssueDate>' + safeXml(invoice.issueDate) + '</cbc:IssueDate>',
    '<cbc:IssueTime>' + safeXml(invoice.issueTime) + '</cbc:IssueTime>',
    '<cbc:InvoiceTypeCode name="0100000">388</cbc:InvoiceTypeCode>',
    '<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>',
    '<cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>',
    '<cac:AdditionalDocumentReference><cbc:ID>ICV</cbc:ID><cbc:UUID>' + String(invoice.icv) + '</cbc:UUID></cac:AdditionalDocumentReference>',
    '<cac:AdditionalDocumentReference><cbc:ID>PIH</cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">',
    safeXml(invoice.previousInvoiceHash),'</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>',
    partyXml(invoice.seller,'AccountingSupplierParty'),
    partyXml(invoice.buyer,'AccountingCustomerParty'),
    '<cac:TaxTotal><cbc:TaxAmount currencyID="SAR">' + money(invoice.vatAmount) + '</cbc:TaxAmount>',
    '<cac:TaxSubtotal><cbc:TaxableAmount currencyID="SAR">' + money(invoice.netAmount) + '</cbc:TaxableAmount>',
    '<cbc:TaxAmount currencyID="SAR">' + money(invoice.vatAmount) + '</cbc:TaxAmount>',
    '<cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>15.00</cbc:Percent>',
    '<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>',
    '<cac:LegalMonetaryTotal>',
    '<cbc:LineExtensionAmount currencyID="SAR">' + money(invoice.netAmount) + '</cbc:LineExtensionAmount>',
    '<cbc:TaxExclusiveAmount currencyID="SAR">' + money(invoice.netAmount) + '</cbc:TaxExclusiveAmount>',
    '<cbc:TaxInclusiveAmount currencyID="SAR">' + money(invoice.totalAmount) + '</cbc:TaxInclusiveAmount>',
    '<cbc:PayableAmount currencyID="SAR">' + money(invoice.totalAmount) + '</cbc:PayableAmount>',
    '</cac:LegalMonetaryTotal>',
    lines,
    '</Invoice>',
  ].join('')
}
