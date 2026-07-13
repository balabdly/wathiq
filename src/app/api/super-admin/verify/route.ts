import { NextResponse } from 'next/server'
import {
  createSuperAdminSessionToken,
  loadSuperAdminConfig,
  setSuperAdminCookie,
  verifySuperAdminPassword,
} from '@/lib/super-admin-auth'

export async function POST(request: Request) {
  try {
    const { password } = await request.json()
    const config = await loadSuperAdminConfig()

    if (!config?.password) {
      return NextResponse.json(
        { ok: false, error: 'كلمة مرور Super Admin غير مضبوطة — أضف SUPER_ADMIN_PASSWORD في Vercel أو platform_settings' },
        { status: 500 },
      )
    }
    if (!(await verifySuperAdminPassword(password))) {
      return NextResponse.json({ ok: false, error: 'كلمة المرور غير صحيحة' }, { status: 401 })
    }

    const { token, maxAge } = createSuperAdminSessionToken(config.secret)
    setSuperAdminCookie(token, maxAge)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 })
  }
}
