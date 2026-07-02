import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAuthCookieToken } from '@/lib/auth-cookie'

// ── خريطة الصفحات والصلاحيات المطلوبة ──
const PAGE_PERMISSIONS: Record<string, string[]> = {
  '/visits':               ['visits', 'visits_quality', 'visits_safety', 'visits_electrical', 'visits_field'],
  '/qhse':                 ['qhse'],
  '/inventory':            ['inventory'],
  '/purchases':            ['purchases'],
  '/hr':                   ['hr', 'employees'],
  '/finance':              ['finance'],
  '/reports':              ['reports'],
  '/pmo':                  ['pmo'],
  '/projects':             ['projects_view', 'projects_edit'],
  '/settings/permissions': ['مدير عام'],
}

const AUTH_COOKIE_NAME = 'wathiq_user'
const PUBLIC_ROUTES = ['/login', '/super-admin', '/careers', '/offline', '/unauthorized']

export async function middleware(request: NextRequest) {
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
    pathname === '/unauthorized' ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  if (PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next()
  }

  const userCookie = request.cookies.get(AUTH_COOKIE_NAME)
  if (!userCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const secret = process.env.AUTH_COOKIE_SECRET
  if (!secret) return NextResponse.next()

  const user = await verifyAuthCookieToken(userCookie.value, secret)
  if (!user) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: '',
      path: '/',
      maxAge: 0,
    })
    return response
  }

  // مدير عام يمر دائماً
  if (user.role === 'مدير عام') return NextResponse.next()

  const userPerms = user.permissions || []

  // التحقق من الصلاحيات
  for (const [route, required] of Object.entries(PAGE_PERMISSIONS)) {
    if (pathname.startsWith(route)) {
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
