import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
  const response = NextResponse.json({ ok: true })
  response.cookies.set('wathiq_access', '', { httpOnly: true, path: '/', maxAge: 0 })
  return response
}
