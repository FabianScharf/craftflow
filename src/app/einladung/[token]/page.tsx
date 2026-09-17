'use client'

// Die Seite hinter dem Einladungslink aus der Mail. ÖFFENTLICH (PUBLIC_PATHS in
// src/middleware.ts) — wer hier landet, hat meistens noch kein CraftFlow-Konto.
//
// Drei Zustände, und jeder nennt seinen Grund:
//   · nicht angemeldet → „Anmelden" / „Registrieren", beide mit `?next=` zurück
//     auf genau diese Seite (der Token bleibt dabei in der Adresse).
//   · angemeldet       → „Einladung annehmen"
//   · Fehler           → sichtbar, mit dem Satz, den die Route geliefert hat.
//     Der häufigste ist „Die Einladung gilt für eine andere E-Mail-Adresse."
//
// Gestaltung wie /login (dunkler Grund, Kupfer-Akzent) — der Empfänger soll
// sehen, dass er auf derselben Seite ist wie im nächsten Schritt.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const C = { black: '#0D0D0D', dark: '#141414', copper: '#C8885A', white: '#F5F2EE', gray: '#8A8A8A', border: '#2E2E2E', err: '#E05A5A', ok: '#5ABE6A' }

type Einladung = { betriebName: string | null; email: string; status: string }

const knopf = (aktiv: boolean) => ({
  background: aktiv ? C.copper : '#7a5535',
  color: C.black,
  border: 'none',
  borderRadius: 8,
  padding: '13px',
  fontSize: 14,
  fontWeight: 800,
  cursor: aktiv ? 'pointer' : 'not-allowed',
  fontFamily: 'Helvetica Neue,sans-serif',
  letterSpacing: 0.3,
  textAlign: 'center' as const,
  textDecoration: 'none',
  display: 'block',
})

export default function EinladungPage() {
  const params = useParams<{ token: string }>()
  const token = typeof params?.token === 'string' ? params.token : ''

  const [einladung, setEinladung] = useState<Einladung | null>(null)
  const [laedt, setLaedt] = useState(true)
  const [angemeldet, setAngemeldet] = useState<string | null>(null)
  const [fehler, setFehler] = useState('')
  const [nimmtAn, setNimmtAn] = useState(false)
  const [fertig, setFertig] = useState<string | null>(null)

  useEffect(() => {
    let abgebrochen = false
    const laden = async () => {
      try {
        // Erst die Einladung, dann die Sitzung: Ein toter Link soll seine Meldung
        // auch dann zeigen, wenn Supabase im Browser gerade nicht antwortet.
        const res = await fetch(`/api/team/einladung/${encodeURIComponent(token)}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({})) as Einladung & { error?: string }
        if (abgebrochen) return
        if (!res.ok) { setFehler(json.error || 'Diese Einladung gibt es nicht mehr.'); return }
        setEinladung(json)
        const { data } = await createClient().auth.getUser()
        if (abgebrochen) return
        setAngemeldet(data.user?.email ?? null)
      } catch {
        if (!abgebrochen) setFehler('Die Einladung konnte nicht geladen werden. Bitte später erneut versuchen.')
      } finally {
        if (!abgebrochen) setLaedt(false)
      }
    }
    void laden()
    return () => { abgebrochen = true }
  }, [token])

  async function annehmen() {
    setFehler('')
    setNimmtAn(true)
    try {
      const res = await fetch('/api/team/annehmen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = await res.json().catch(() => ({})) as { ok?: boolean; betriebName?: string | null; error?: string }
      if (!res.ok || !json.ok) {
        setFehler(json.error || 'Die Einladung konnte nicht angenommen werden.')
        return
      }
      setFertig(json.betriebName ?? einladung?.betriebName ?? null)
    } catch {
      setFehler('Die Einladung konnte nicht angenommen werden. Bitte später erneut versuchen.')
    } finally {
      setNimmtAn(false)
    }
  }

  const betrieb = einladung?.betriebName || 'Ein CraftFlow-Betrieb'
  const zurueck = `/einladung/${encodeURIComponent(token)}`

  return (
    <div style={{ background: C.black, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Helvetica Neue,sans-serif', padding: 16 }}>

      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ color: C.copper, fontSize: 22, fontWeight: 800, letterSpacing: 4 }}>CRAFTFLOW</div>
        <div style={{ color: C.gray, fontSize: 10, letterSpacing: 2, marginTop: 2 }}>FS CRAFTED</div>
      </div>

      <div style={{ background: C.dark, border: `1px solid ${C.border}`, borderRadius: 12, padding: '32px 28px', width: '100%', maxWidth: 420 }}>

        {laedt && <p style={{ color: C.gray, fontSize: 13, margin: 0 }}>Einladung wird geladen …</p>}

        {!laedt && fertig !== null && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>✓</div>
            <h1 style={{ color: C.white, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>
              Du gehörst jetzt zu {fertig || 'deinem Betrieb'}.
            </h1>
            <p style={{ color: C.gray, fontSize: 13, lineHeight: 1.65, margin: 0 }}>
              Du arbeitest ab jetzt auf den Projekten, Kunden und Einstellungen des Betriebs.
            </p>
            <Link href="/" style={{ display: 'inline-block', marginTop: 20, color: C.copper, fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
              Zu CraftFlow →
            </Link>
          </div>
        )}

        {!laedt && fertig === null && !einladung && (
          <>
            <h1 style={{ color: C.white, fontSize: 18, fontWeight: 700, marginBottom: 12, letterSpacing: -0.3 }}>Einladung nicht gültig</h1>
            <p style={{ color: C.gray, fontSize: 13, lineHeight: 1.65, marginTop: 0 }}>
              {fehler || 'Diese Einladung gibt es nicht mehr.'} Frag am besten den Inhaber, ob er sie erneut schickt.
            </p>
            <a href="/login" style={{ color: C.copper, fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>Zur Anmeldung →</a>
          </>
        )}

        {!laedt && fertig === null && einladung && (
          <>
            <h1 style={{ color: C.white, fontSize: 18, fontWeight: 700, marginBottom: 12, letterSpacing: -0.3 }}>
              {betrieb} lädt dich ein
            </h1>
            <p style={{ color: C.gray, fontSize: 13, lineHeight: 1.65, marginTop: 0 }}>
              Die Einladung gilt für <strong style={{ color: C.white }}>{einladung.email}</strong>. Als Mitarbeiter
              arbeitest du auf den Projekten, Kunden und Einstellungen des Betriebs — Plan und Abrechnung bleiben
              beim Inhaber.
            </p>

            {einladung.status !== 'eingeladen' && (
              <p style={{ color: C.ok, fontSize: 13, lineHeight: 1.65 }}>
                Diese Einladung wurde schon angenommen.
              </p>
            )}

            {fehler && (
              <div style={{ color: C.err, fontSize: 13, background: 'rgba(224,90,90,0.08)', border: '1px solid rgba(224,90,90,0.2)', borderRadius: 6, padding: '9px 12px', marginBottom: 14 }}>
                {fehler}
              </div>
            )}

            {angemeldet === null ? (
              <>
                <p style={{ color: C.gray, fontSize: 12, lineHeight: 1.6 }}>
                  Melde dich mit <strong style={{ color: C.white }}>genau dieser Adresse</strong> an — oder lege dir
                  damit ein Konto an.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                  <a href={`/login?next=${encodeURIComponent(zurueck)}`} style={knopf(true)}>Anmelden</a>
                  <a
                    href={`/register?next=${encodeURIComponent(zurueck)}`}
                    style={{ ...knopf(true), background: 'transparent', color: C.copper, border: `1px solid ${C.border}` }}
                  >
                    Registrieren
                  </a>
                </div>
              </>
            ) : (
              <>
                <p style={{ color: C.gray, fontSize: 12, lineHeight: 1.6 }}>
                  Angemeldet als <strong style={{ color: C.white }}>{angemeldet}</strong>.
                </p>
                <button
                  type="button"
                  onClick={annehmen}
                  disabled={nimmtAn || einladung.status !== 'eingeladen'}
                  style={{ ...knopf(!nimmtAn && einladung.status === 'eingeladen'), width: '100%', marginTop: 14 }}
                >
                  {nimmtAn ? 'Wird angenommen …' : 'Einladung annehmen'}
                </button>
                <p style={{ color: C.gray, fontSize: 11, lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>
                  Passt die Adresse nicht? Dann melde dich ab und mit der eingeladenen Adresse wieder an.
                </p>
              </>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: 40, display: 'flex', gap: 20 }}>
        <a href="/impressum" style={{ color: '#4A4A4A', fontSize: 11, textDecoration: 'none' }}>Impressum</a>
        <a href="/datenschutz" style={{ color: '#4A4A4A', fontSize: 11, textDecoration: 'none' }}>Datenschutz</a>
        <a href="/agb" style={{ color: '#4A4A4A', fontSize: 11, textDecoration: 'none' }}>AGB</a>
      </div>
    </div>
  )
}
