import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

export function middleware(request: NextRequest) {
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

  // قراءة بيانات المستخدم من الـ cookie
  const userCookie = request.cookies.get('wathiq_user')

  // لو مافيه cookie — نسمح بالمرور (الـ login page تتحكم)
  if (!userCookie) {
    return NextResponse.next()
  }

  // فك تشفير بيانات المستخدم
  let user: { role: string; permissions: string[] } | null = null
  try {
    user = JSON.parse(decodeURIComponent(userCookie.value))
  } catch {
    return NextResponse.next()
  }

  if (!user) return NextResponse.next()

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
