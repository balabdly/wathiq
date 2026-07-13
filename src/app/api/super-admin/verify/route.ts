import { NextResponse } from 'next/server'
import {
  createSuperAdminSessionToken,
  setSuperAdminCookie,
  verifySuperAdminPassword,
} from '@/lib/super-admin-auth'

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    if (!process.env.SUPER_ADMIN_PASSWORD) {
      return NextResponse.json(
        { ok: false, error: 'SUPER_ADMIN_PASSWORD غير مضبوطة بإعدادات الخادم' },
        { status: 500 },
      )
    }
    if (!verifySuperAdminPassword(password)) {
      return NextResponse.json({ ok: false, error: 'كلمة المرور غير صحيحة' }, { status: 401 })
    }

    const { token, maxAge } = createSuperAdminSessionToken()
    setSuperAdminCookie(token, maxAge)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 })
  }
}
