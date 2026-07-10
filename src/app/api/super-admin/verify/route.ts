import { NextResponse } from 'next/server'

// كلمة مرور super-admin تُقرأ من متغير بيئة على الخادم فقط — لا تُشحن أبداً لحزمة المتصفح
// أضِف بإعدادات Vercel: SUPER_ADMIN_PASSWORD=<كلمة سر قوية جديدة>
export async function POST(request: Request) {
  try {
    const { password } = await request.json()
    const expected = process.env.SUPER_ADMIN_PASSWORD

    if (!expected) {
      return NextResponse.json({ ok: false, error: 'SUPER_ADMIN_PASSWORD غير مضبوطة بإعدادات الخادم' }, { status: 500 })
    }
    if (!password || password !== expected) {
      return NextResponse.json({ ok: false, error: 'كلمة المرور غير صحيحة' }, { status: 401 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 })
  }
}
