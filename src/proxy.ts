import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'

// ── خريطة الصفحات والصلاحيات المطلوبة ──
const PAGE_PERMISSIONS: Record<string, string[]> = {
  '/visits':               ['visits', 'visits_quality', 'visits_safety', 'visits_electrical', 'visits_field'],
  '/qhse':                 ['qhse'],
  '/inventory':            ['inventory'],
  '/purchases':            ['purchases'],
  '/hr':                   ['hr', 'employees'],
  '/my-hr':                ['hr_self', 'hr', 'employees'],
  '/finance':              ['finance'],
  '/reports':              ['reports'],
  '/pmo':                  ['pmo'],
  '/projects':             ['projects_view', 'projects_edit'],
  '/settings/permissions': ['مدير عام'],
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // تجاهل الـ API routes والملفات الثابتة
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/screenshots') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/offline' ||
    pathname === '/login' ||
    pathname === '/unauthorized' ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Never authorize from the client-writable wathiq_user cookie.
  const signed = request.cookies.get('wathiq_access')?.value
  const secret = process.env.WATHIQ_SESSION_SECRET
  if (!signed || !secret || Buffer.byteLength(secret, 'utf8') < 32) return NextResponse.redirect(new URL('/login', request.url))
  const separator = signed.lastIndexOf('.')
  if (separator < 1) return NextResponse.redirect(new URL('/login', request.url))
  const payload = signed.slice(0, separator)
  const signature = signed.slice(separator + 1)
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  const actualBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  let user: { employeeId: number | string; tenantId: string; role: string; permissions: string[]; exp: number }
  try {
    user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (!user || !user.employeeId || typeof user.tenantId !== 'string' || !user.tenantId ||
      typeof user.role !== 'string' || !Number.isFinite(user.exp) ||
      user.exp <= Date.now() || user.exp > Date.now() + 8 * 60 * 60 * 1000 ||
      !Array.isArray(user.permissions) || !user.permissions.every(p => typeof p === 'string')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // مدير عام يمر دائماً
  if (user.role === 'مدير عام') return NextResponse.next()

  const userPerms = user.permissions || []

  // التحقق من الصلاحيات
  for (const [route, required] of Object.entries(PAGE_PERMISSIONS)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      const hasAccess = required.some(p => userPerms.includes(p))
      if (!hasAccess) {
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
      break
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|screenshots|manifest.json|sw.js).*)',
  ],
}
