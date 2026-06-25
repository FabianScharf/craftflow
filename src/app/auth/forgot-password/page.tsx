'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

const C = { black: '#0D0D0D', dark: '#141414', copper: '#C8885A', white: '#F5F2EE', gray: '#8A8A8A', border: '#2E2E2E', err: '#E05A5A' }

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://craftflow-sable.vercel.app/auth/reset-password',
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  return (
    <div style={{ background: C.black, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Helvetica Neue,sans-serif', padding: 16 }}>

      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ color: C.copper, fontSize: 22, fontWeight: 800, letterSpacing: 4 }}>CRAFTFLOW</div>
        <div style={{ color: C.gray, fontSize: 10, letterSpacing: 2, marginTop: 2 }}>FS CRAFTED</div>
      </div>

      <div style={{ background: C.dark, border: `1px solid ${C.border}`, borderRadius: 12, padding: '32px 28px', width: '100%', maxWidth: 380 }}>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>✉️</div>
            <h2 style={{ color: C.white, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>E-Mail unterwegs</h2>
            <p style={{ color: C.gray, fontSize: 13, lineHeight: 1.65 }}>
              Wenn <strong style={{ color: C.white }}>{email}</strong> bei uns registriert ist,
              bekommst du in Kürze einen Link zum Zurücksetzen deines Passworts.
            </p>
            <a href="/login" style={{ display: 'inline-block', marginTop: 20, color: C.copper, fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
              ← Zurück zur Anmeldung
            </a>
          </div>
        ) : (
          <>
            <h1 style={{ color: C.white, fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: -0.3 }}>Passwort zurücksetzen</h1>
            <p style={{ color: C.gray, fontSize: 13, marginBottom: 24, lineHeight: 1.55 }}>
              Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link zum Zurücksetzen.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                {loading ? 'Wird gesendet …' : 'Link zusenden'}
              </button>
            </form>
          </>
        )}
      </div>

      <p style={{ color: C.gray, fontSize: 13, marginTop: 20 }}>
        <a href="/login" style={{ color: C.copper, textDecoration: 'none', fontWeight: 600 }}>
          ← Zurück zur Anmeldung
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
