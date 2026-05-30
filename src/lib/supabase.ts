import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Auth helpers ──
export async function signIn(username: string, password: string) {
  // نستخدم email = username@tenant.wathiq.app
  // لأن Supabase يتطلب email
  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${username}@wathiq.internal`,
    password,
  })
  return { data, error }
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  return supabase.auth.getSession()
}
