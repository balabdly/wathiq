/** اسم آمن لمسار Supabase Storage (ASCII فقط) */
export function sanitizeStorageFileName(originalName: string): string {
  const trimmed = originalName.trim() || 'file'
  const dot = trimmed.lastIndexOf('.')
  const rawExt = dot > 0 ? trimmed.slice(dot + 1) : ''
  const rawBase = dot > 0 ? trimmed.slice(0, dot) : trimmed

  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'bin'
  const base = rawBase
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80)

  return `${base || 'file'}.${ext}`
}

export function buildTenantStoragePath(
  tenantId: string,
  parts: string[],
  prefix: string,
  file: File,
): { path: string; name: string } {
  const safeName = sanitizeStorageFileName(file.name)
  const path = [tenantId, ...parts, `${prefix}_${Date.now()}_${safeName}`].join('/')
  return { path, name: file.name }
}
