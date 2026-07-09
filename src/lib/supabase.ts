import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' })
  return supabase.auth.signOut()
}

export async function getSession() {
  return supabase.auth.getSession()
}
