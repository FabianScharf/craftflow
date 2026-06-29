'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

const C = { black: '#0D0D0D', dark: '#141414', copper: '#C8885A', white: '#F5F2EE', gray: '#8A8A8A', border: '#2E2E2E', err: '#E05A5A', ok: '#5ABE6A' }

const inputStyle = { background: C.black, border: `1px solid ${C.border}`, borderRadius: 7, padding: '11px 13px', color: C.white, fontSize: 14, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none' }

function checkPassword(pw: string) {
  return {
    length:    pw.length >= 8,
    upper:     /[A-Z]/.test(pw),
    lower:     /[a-z]/.test(pw),
    digit:     /[0-9]/.test(pw),
    special:   /[^A-Za-z0-9]/.test(pw),
  }
}

const CRITERIA_LABELS = [
  { key: 'length',  label: 'Mindestens 8 Zeichen' },
  { key: 'upper',   label: 'Mindestens ein Großbuchstabe' },
  { key: 'lower',   label: 'Mindestens ein Kleinbuchstabe' },
  { key: 'digit',   label: 'Mindestens eine Zahl' },
  { key: 'special', label: 'Mindestens ein Sonderzeichen (!@#$%^&* …)' },
] as const

export default function RegisterPage() {
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [password2, setPassword2] = useState('')
  const [agb, setAgb]             = useState(false)
  const [avv, setAvv]             = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)
  const [loading, setLoading]     = useState(false)

  const criteria = checkPassword(password)
  const allValid = Object.values(criteria).every(Boolean)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!allValid)              { setError('Das Passwort erfüllt nicht alle Anforderungen.'); return }
    if (password !== password2) { setError('Die Passwörter stimmen nicht überein.'); return }
    if (!agb)                   { setError('Bitte akzeptiere die Datenschutzerklärung und AGB.'); return }
    if (!avv)                   { setError('Bitte akzeptiere den Auftragsverarbeitungsvertrag (AVV).'); return }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: 'https://craftflow-sable.vercel.app' },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    // Zustimmungen protokollieren (fire & forget — Nutzer ist ggf. noch nicht eingeloggt,
    // daher kurz warten bis Session gesetzt ist)
    setTimeout(() => {
      fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consents: ['agb', 'datenschutz', 'avv'],
          versions: { agb: '2026-07', datenschutz: '2026-07', avv: '2026-07' },
        }),
      }).catch(() => {})
    }, 2000)
    fetch('/api/notify-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {})
    setSuccess(true)
    setLoading(false)
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

        {success ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>✉️</div>
            <h2 style={{ color: C.white, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Fast geschafft!</h2>
            <p style={{ color: C.gray, fontSize: 13, lineHeight: 1.65 }}>
              Wir haben dir eine Bestätigungs-E-Mail an <strong style={{ color: C.white }}>{email}</strong> geschickt.
              Bitte klicke auf den Link in der E-Mail, um dein Konto zu aktivieren.
            </p>
            <a href="/login" style={{ display: 'inline-block', marginTop: 20, color: C.copper, fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
              Zur Anmeldung →
            </a>
          </div>
        ) : (
          <>
            <h1 style={{ color: C.white, fontSize: 18, fontWeight: 700, marginBottom: 24, letterSpacing: -0.3 }}>Kostenlos registrieren</h1>

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ color: C.gray, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>E-MAIL</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ color: C.gray, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>PASSWORT</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={inputStyle}
                />
                {/* Live-Kriterien */}
                {password.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4, padding: '10px 12px', background: '#0D0D0D', borderRadius: 6, border: `1px solid ${C.border}` }}>
                    {CRITERIA_LABELS.map(({ key, label }) => {
                      const ok = criteria[key]
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, color: ok ? C.ok : C.err, lineHeight: 1, flexShrink: 0 }}>
                            {ok ? '✓' : '○'}
                          </span>
                          <span style={{ fontSize: 12, color: ok ? C.ok : C.gray }}>
                            {label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ color: C.gray, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>PASSWORT WIEDERHOLEN</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor: password2.length > 0
                      ? (password2 === password ? '#3a6a3a' : C.err)
                      : C.border,
                  }}
                />
                {password2.length > 0 && password2 !== password && (
                  <span style={{ fontSize: 12, color: C.err }}>Passwörter stimmen nicht überein.</span>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={agb}
                  onChange={e => setAgb(e.target.checked)}
                  style={{ marginTop: 2, accentColor: C.copper, width: 15, height: 15, flexShrink: 0 }}
                />
                <span style={{ color: C.gray, fontSize: 12, lineHeight: 1.55 }}>
                  Ich akzeptiere die{' '}
                  <a href="/agb" target="_blank" style={{ color: C.copper, textDecoration: 'none' }}>AGB</a>
                  {' '}und die{' '}
                  <a href="/datenschutz" target="_blank" style={{ color: C.copper, textDecoration: 'none' }}>Datenschutzerklärung</a>.
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={avv}
                  onChange={e => setAvv(e.target.checked)}
                  style={{ marginTop: 2, accentColor: C.copper, width: 15, height: 15, flexShrink: 0 }}
                />
                <span style={{ color: C.gray, fontSize: 12, lineHeight: 1.55 }}>
                  Ich stimme dem{' '}
                  <a href="/avv" target="_blank" style={{ color: C.copper, textDecoration: 'none' }}>Auftragsverarbeitungsvertrag (AVV)</a>
                  {' '}gemäß Art. 28 DSGVO zu. Als Nutzer von CraftFlow verarbeite ich
                  personenbezogene Daten meiner Kunden und benötige diesen Vertrag.
                </span>
              </label>

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
                {loading ? 'Wird registriert …' : 'Kostenlos registrieren'}
              </button>
            </form>
          </>
        )}
      </div>

      <p style={{ color: C.gray, fontSize: 13, marginTop: 20 }}>
        Bereits registriert?{' '}
        <a href="/login" style={{ color: C.copper, textDecoration: 'none', fontWeight: 600 }}>
          Anmelden
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
