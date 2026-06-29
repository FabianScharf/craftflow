'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const C = { black: '#0D0D0D', dark: '#141414', copper: '#C8885A', white: '#F5F2EE', gray: '#8A8A8A', border: '#2E2E2E', err: '#E05A5A', ok: '#5ABE6A' }

function checkPassword(pw: string) {
  return {
    length:  pw.length >= 8,
    upper:   /[A-Z]/.test(pw),
    lower:   /[a-z]/.test(pw),
    digit:   /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  }
}

const CRITERIA_LABELS = [
  { key: 'length',  label: 'Mindestens 8 Zeichen' },
  { key: 'upper',   label: 'Mindestens ein Großbuchstabe' },
  { key: 'lower',   label: 'Mindestens ein Kleinbuchstabe' },
  { key: 'digit',   label: 'Mindestens eine Zahl' },
  { key: 'special', label: 'Mindestens ein Sonderzeichen (!@#$%^&* …)' },
] as const

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady]         = useState(false)
  const [password, setPassword]   = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [done, setDone]           = useState(false)

  const criteria = checkPassword(password)
  const allValid = Object.values(criteria).every(Boolean)

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!allValid)              { setError('Das Passwort erfüllt nicht alle Anforderungen.'); return }
    if (password !== password2) { setError('Die Passwörter stimmen nicht überein.'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => router.push('/login'), 2500)
  }

  return (
    <div style={{ background: C.black, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Helvetica Neue,sans-serif', padding: 16 }}>

      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ color: C.copper, fontSize: 22, fontWeight: 800, letterSpacing: 4 }}>CRAFTFLOW</div>
        <div style={{ color: C.gray, fontSize: 10, letterSpacing: 2, marginTop: 2 }}>FS CRAFTED</div>
      </div>

      <div style={{ background: C.dark, border: `1px solid ${C.border}`, borderRadius: 12, padding: '32px 28px', width: '100%', maxWidth: 380 }}>

        {done ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>✓</div>
            <h2 style={{ color: C.ok, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Passwort geändert</h2>
            <p style={{ color: C.gray, fontSize: 13, lineHeight: 1.65 }}>
              Du wirst gleich zur Anmeldung weitergeleitet …
            </p>
          </div>
        ) : !ready ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ color: C.gray, fontSize: 13 }}>Link wird geprüft …</div>
          </div>
        ) : (
          <>
            <h1 style={{ color: C.white, fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: -0.3 }}>Neues Passwort setzen</h1>
            <p style={{ color: C.gray, fontSize: 13, marginBottom: 24, lineHeight: 1.55 }}>
              Wähle ein sicheres Passwort für dein CraftFlow-Konto.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ color: C.gray, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>NEUES PASSWORT</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ background: C.black, border: `1px solid ${C.border}`, borderRadius: 7, padding: '11px 13px', color: C.white, fontSize: 14, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none' }}
                />
                {password.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4, padding: '10px 12px', background: '#0D0D0D', borderRadius: 6, border: `1px solid ${C.border}` }}>
                    {CRITERIA_LABELS.map(({ key, label }) => {
                      const ok = criteria[key]
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, color: ok ? C.ok : C.err, lineHeight: 1, flexShrink: 0 }}>{ok ? '✓' : '○'}</span>
                          <span style={{ fontSize: 12, color: ok ? C.ok : C.gray }}>{label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ color: C.gray, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>PASSWORT BESTÄTIGEN</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
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
                {loading ? 'Wird gespeichert …' : 'Passwort speichern'}
              </button>
            </form>
          </>
        )}
      </div>

      <div style={{ marginTop: 40, display: 'flex', gap: 20 }}>
        <a href="/impressum"   style={{ color: '#4A4A4A', fontSize: 11, textDecoration: 'none' }}>Impressum</a>
        <a href="/datenschutz" style={{ color: '#4A4A4A', fontSize: 11, textDecoration: 'none' }}>Datenschutz</a>
        <a href="/agb"         style={{ color: '#4A4A4A', fontSize: 11, textDecoration: 'none' }}>AGB</a>
      </div>
    </div>
  )
}
