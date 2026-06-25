'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const C = { black: '#0D0D0D', dark: '#141414', copper: '#C8885A', white: '#F5F2EE', gray: '#8A8A8A', border: '#2E2E2E', err: '#E05A5A' }

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-Mail oder Passwort falsch.')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div style={{ background: C.black, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Helvetica Neue,sans-serif', padding: 16 }}>

      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ color: C.copper, fontSize: 22, fontWeight: 800, letterSpacing: 4 }}>CRAFTFLOW</div>
        <div style={{ color: C.gray, fontSize: 10, letterSpacing: 2, marginTop: 2 }}>FS CRAFTED</div>
      </div>

      {/* Card */}
      <div style={{ background: C.dark, border: `1px solid ${C.border}`, borderRadius: 12, padding: '32px 28px', width: '100%', maxWidth: 380 }}>
        <h1 style={{ color: C.white, fontSize: 18, fontWeight: 700, marginBottom: 24, letterSpacing: -0.3 }}>Anmelden</h1>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: C.gray, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>E-MAIL</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ background: C.black, border: `1px solid ${C.border}`, borderRadius: 7, padding: '11px 13px', color: C.white, fontSize: 14, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: C.gray, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>PASSWORT</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ background: C.black, border: `1px solid ${C.border}`, borderRadius: 7, padding: '11px 13px', color: C.white, fontSize: 14, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none' }}
            />
          </div>

          <div style={{ textAlign: 'right', marginTop: -6 }}>
            <a href="/auth/forgot-password" style={{ color: C.gray, fontSize: 12, textDecoration: 'none' }}>
              Passwort vergessen?
            </a>
          </div>

          {error && (
            <div style={{ color: C.err, fontSize: 13, background: 'rgba(224,90,90,0.08)', border: `1px solid rgba(224,90,90,0.2)`, borderRadius: 6, padding: '9px 12px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ background: loading ? '#7a5535' : C.copper, color: C.black, border: 'none', borderRadius: 8, padding: '13px', fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Helvetica Neue,sans-serif', letterSpacing: 0.3, marginTop: 4 }}
          >
            {loading ? 'Wird angemeldet …' : 'Anmelden'}
          </button>
        </form>
      </div>

      <p style={{ color: C.gray, fontSize: 13, marginTop: 20 }}>
        Noch kein Konto?{' '}
        <a href="/register" style={{ color: C.copper, textDecoration: 'none', fontWeight: 600 }}>
          Kostenlos registrieren
        </a>
      </p>

      <div style={{ marginTop: 40, display: 'flex', gap: 20 }}>
        <a href="/impressum"   style={{ color: '#4A4A4A', fontSize: 11, textDecoration: 'none' }}>Impressum</a>
        <a href="/datenschutz" style={{ color: '#4A4A4A', fontSize: 11, textDecoration: 'none' }}>Datenschutz</a>
        <a href="/agb"         style={{ color: '#4A4A4A', fontSize: 11, textDecoration: 'none' }}>AGB</a>
      </div>
    </div>
  )
}
