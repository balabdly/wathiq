'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/hooks/useStore'
import { syncUserCookie } from '@/lib/authCookie'

export default function LoginPage() {
  const router = useRouter()
  const { setCurrentUser, setTenant, setBranches, setActiveBranch } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) return toast.error('يرجى إدخال بيانات الدخول')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'فشل تسجيل الدخول')
        return
      }

      if (data.session) {
        try {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          })
        } catch (sessionErr) {
          console.warn('setSession failed:', sessionErr)
        }
      }

      const emp = data.employee
      if (!emp) {
        toast.error('بيانات المستخدم غير مكتملة')
        return
      }
      setCurrentUser(emp)
      syncUserCookie(emp)
      setTenant(data.tenant)
      setBranches(data.branches || [])

      const userBranch = data.branches?.find((b: any) => b.id === emp.branch_id) || data.branches?.[0]
      if (userBranch) setActiveBranch(userBranch)

      toast.success(`أهلاً ${emp.name} 👋`)
      router.push('/dashboard')

    } catch (err) {
      console.error('login error:', err)
      toast.error('تعذّر الاتصال بالخادم — تأكد من إعدادات Vercel')
    }
    finally { setLoading(false) }
  }

  return (
    <div className="login-page">
      <div style={{ width: '100%', maxWidth: '420px' }} className="fade-in">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="login-logo">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 style={{ color: 'white', fontSize: '2rem', fontWeight: 700 }}>وثيق</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginTop: '4px' }}>
            نظام إدارة مقاولي الكهرباء
          </p>
        </div>

        {/* Card */}
        <div className="login-card">
          <h2 className="text-center mb-6" style={{ fontSize: '1.25rem' }}>تسجيل الدخول</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>اسم المستخدم</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  autoComplete="current-password"
                  style={{ paddingLeft: '40px' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', left: '10px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', padding: '4px', color: '#9ca3af',
                  }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPass ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              style={{ justifyContent: 'center', padding: '12px', fontSize: '1rem', marginTop: '8px' }}>
              {loading ? (
                <>
                  <span style={{
                    width: 18, height: 18,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white', borderRadius: '50%',
                  }} className="animate-spin" />
                  جاري الدخول...
                </>
              ) : 'دخول'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
          وثيق © {new Date().getFullYear()} — نظام إدارة مقاولي SEC
        </p>
      </div>
    </div>
  )
}
