import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ── خريطة الصفحات والصلاحيات المطلوبة ──
const PAGE_PERMISSIONS: Record<string, string[]> = {
  '/visits':    ['visits', 'visits_quality', 'visits_safety', 'visits_electrical', 'visits_field'],
  '/qhse':      ['qhse'],
  '/inventory': ['inventory'],
  '/purchases': ['purchases'],
  '/hr':        ['hr', 'employees'],
  '/finance':   ['finance'],
  '/reports':   ['reports'],
  '/pmo':       ['pmo'],
  '/projects':  ['projects_view', 'projects_edit'],
  '/settings/permissions': ['مدير عام'], // الأدمن فقط
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // تجاهل الـ API routes والملفات الثابتة
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // قراءة بيانات المستخدم من الـ cookie
  const userCookie = request.cookies.get('wathiq_user')
  if (!userCookie) {
    // لو مسجّل دخوله يُحوَّل لصفحة Login
    if (pathname !== '/login' && pathname !== '/') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  // لو في صفحة login وهو مسجّل → يُحوَّل للـ dashboard
  if (pathname === '/login' || pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // فك تشفير بيانات المستخدم
  let user: { role: string; permissions: string[] } | null = null
  try {
    user = JSON.parse(decodeURIComponent(userCookie.value))
  } catch {
    return NextResponse.next()
  }

  if (!user) return NextResponse.next()

  const userPerms = user.permissions || []

  // التحقق من الصلاحيات لكل صفحة
  for (const [route, required] of Object.entries(PAGE_PERMISSIONS)) {
    if (pathname.startsWith(route)) {
      // مدير عام يمر دائماً
      if (user.role === 'مدير عام') break

      // تحقق من الصلاحيات
      const hasAccess = required.some(p => userPerms.includes(p))
      if (!hasAccess) {
        // إعادة التوجيه لصفحة "غير مصرح"
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
      break
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
