'use client'

// Die Sperrseite für Mitglieder ohne Zugang zum Betrieb (Teamfunktion 2026-09-17).
//
// Zwei Fälle, beide mit demselben Bild: der Nutzer ist angemeldet, aber sein Login
// gehört keinem Betrieb mehr, in dem er arbeiten darf.
//   ruhend   — der Inhaber hat den Plan verkleinert; das Mitglied liegt ausserhalb
//              des Nutzer-Deckels (die ältesten Annahmen bleiben aktiv).
//   entfernt — der Inhaber hat das Mitglied entfernt.
//
// WARUM ES DIESE SEITE GIBT: Ohne sie sähe ein gesperrtes Mitglied eine leere App
// (kontoIdFuer gibt ihm seine EIGENE, leere Konto-ID) oder die Paywall — und in
// beiden Fällen keinen Grund. Eine Ablehnung ohne Grund ist ein stiller Fehler
// (Lehre „KI-Werkzeuge: stille Fehler"). Die Texte stehen in TEAM_TEXTE.

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { C } from '@/lib/types'
import { akzentTon } from '@/lib/theme'
import { TEAM_TEXTE } from '@/lib/team'
import { usePlan } from '@/hooks/usePlan'
import { LogoMark } from '@/components/AppHeader'

export default function GesperrtSeite() {
  const { zustand, betriebName, loading } = usePlan()
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')

  // Wer wieder Zugang hat (der Inhaber hat aufgeräumt oder den Plan vergrössert),
  // soll hier nicht festsitzen. Der Wechsel passiert erst nach dem Laden — sonst
  // würde der Startwert 'inhaber' jeden sofort wieder hinauswerfen.
  useEffect(() => {
    if (!loading && (zustand === 'inhaber' || zustand === 'mitarbeiter')) {
      window.location.href = '/'
    }
  }, [loading, zustand])

  async function eigenenBetriebAnlegen() {
    setLaeuft(true)
    setFehler('')
    try {
      const res = await fetch('/api/team/verlassen', { method: 'POST' })
      const json = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        // Den Grund wörtlich zeigen, nicht umschreiben: die Route weiss, warum.
        setFehler(json.error ?? `Das hat nicht funktioniert (${res.status}).`)
        setLaeuft(false)
        return
      }
      window.location.href = '/settings'
    } catch (e) {
      setFehler(`Verbindungsfehler: ${e instanceof Error ? e.message : e}`)
      setLaeuft(false)
    }
  }

  async function abmelden() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const text = zustand === 'entfernt' ? TEAM_TEXTE.entfernt : TEAM_TEXTE.ruhend

  return (
    <div style={{
      background: C.black, minHeight: '100vh', color: C.white,
      fontFamily: 'Helvetica Neue,sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
    }}>
      <div style={{
        width: '100%', maxWidth: 460, background: C.gray1,
        border: `1px solid ${C.border}`, borderRadius: 12, padding: '28px 26px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <LogoMark size={34} />
          <div style={{ color: C.copper, fontSize: 15, fontWeight: 800, letterSpacing: 3 }}>CRAFTFLOW</div>
        </div>

        <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px', color: C.white }}>
          Kein Zugang zu diesem Betrieb
        </h1>

        {loading ? (
          <p style={{ fontSize: 13, color: C.textMid, margin: 0 }}>Lädt …</p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6, margin: '0 0 6px' }}>{text}</p>
            {betriebName && (
              <p style={{ fontSize: 12, color: C.textMid, margin: '0 0 18px' }}>
                Betrieb: <strong style={{ color: C.white }}>{betriebName}</strong>
              </p>
            )}

            <div style={{
              background: akzentTon('11'), border: `1px solid ${akzentTon('44')}`,
              borderRadius: 8, padding: '12px 14px', marginBottom: 20,
              fontSize: 12, color: C.textMid, lineHeight: 1.6,
            }}>
              Du kannst warten, bis der Inhaber dir wieder einen Platz freigibt — oder
              mit diesem Login einen <strong style={{ color: C.white }}>eigenen Betrieb</strong> anlegen.
              Deine Testphase startet dann regulär.
            </div>

            {fehler && (
              <div style={{ fontSize: 12, color: C.err, marginBottom: 14, lineHeight: 1.5 }}>{fehler}</div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button
                onClick={eigenenBetriebAnlegen}
                disabled={laeuft}
                style={{
                  background: C.copper, color: C.onAccent, border: 'none', borderRadius: 6,
                  padding: '10px 18px', fontSize: 13, fontWeight: 700,
                  cursor: laeuft ? 'not-allowed' : 'pointer',
                  fontFamily: 'Helvetica Neue,sans-serif', opacity: laeuft ? 0.6 : 1,
                }}
              >{laeuft ? '…' : 'Eigenen Betrieb anlegen'}</button>
              <button
                onClick={abmelden}
                style={{
                  background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`,
                  borderRadius: 6, padding: '10px 18px', fontSize: 13,
                  cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif',
                }}
              >Abmelden</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
