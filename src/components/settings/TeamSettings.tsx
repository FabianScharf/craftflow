'use client'

// Einstellungen → Team (Teamfunktion 2026-09-17).
//
// ANLASS (Fabian, 17.09.): Die Plan-Matrix bewirbt „1 / 1 / 3 / unbegrenzt Nutzer",
// aber jedes Konto war genau ein Login. Hier lädt der Inhaber Mitarbeiter ein.
//
// ZWEI SICHTEN, EINE LISTE:
//   Inhaber     — einladen, erneut senden, entfernen, Plätze im Blick.
//   Mitarbeiter — dieselbe Liste, nur lesend, plus „Betrieb verlassen".
// Der Server prüft das ohnehin selbst (403 „Nur der Inhaber des Betriebs kann das.");
// diese Datei versteckt nur, was ohnehin abgelehnt würde. Der Browser ist nie die
// Instanz.
//
// JEDE ABLEHNUNG NENNT IHREN GRUND: Die Routen antworten mit `{ error }`, und dieser
// Text wird WÖRTLICH gezeigt — nicht durch ein eigenes „Fehler" ersetzt (Lehre
// „KI-Werkzeuge: stille Fehler").

import { useEffect, useState } from 'react'
import { akzentTon, ton } from '@/lib/theme'
import { C } from '@/lib/types'
import { TEAM_TEXTE } from '@/lib/team'

type Mitglied = {
  id: string
  email: string
  status: 'eingeladen' | 'aktiv' | 'entfernt'
  angenommen_am: string | null
  eingeladen_am: string
  /** aktiv, liegt aber ausserhalb des Nutzer-Deckels → sieht die Sperrseite. */
  ruhend: boolean
}

type TeamAntwort = {
  inhaber: { email: string }
  mitglieder: Mitglied[]
  /** deckel/frei = null heisst unbegrenzt (Enterprise), nicht 0. */
  plaetze: { deckel: number | null; belegt: number; frei: number | null }
}

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: '100%', boxSizing: 'border-box', padding: '9px 11px',
  background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 4,
  fontSize: 13, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none',
  ...extra,
})

const kupferKnopf = (aus: boolean): React.CSSProperties => ({
  background: C.copper, color: C.onAccent, border: 'none', borderRadius: 4,
  padding: '9px 16px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
  cursor: aus ? 'not-allowed' : 'pointer', opacity: aus ? 0.6 : 1,
  fontFamily: 'Helvetica Neue,sans-serif',
})

/**
 * Der rote Knopf trägt die Schrift in C.err auf durchsichtigem Grund, NICHT weiss
 * oder C.black auf rotem Grund. Grund (Fehler vom 16.09.): C.black ist die
 * Primärfarbe des Nutzers und nicht garantiert dunkel — auf rotem Grund war die
 * Beschriftung praktisch unsichtbar. C.err dagegen ist in leitePaletteAb() gegen die
 * dunkelste Fläche kontrastgeprüft (≥ 4,5) und damit als Schrift immer lesbar.
 */
const rotKnopf = (aus?: boolean): React.CSSProperties => ({
  background: ton(C.err, '14'), color: C.err, border: `1px solid ${C.err}`,
  borderRadius: 4, padding: '7px 12px', fontSize: 12, fontWeight: 700,
  whiteSpace: 'nowrap', cursor: aus ? 'not-allowed' : 'pointer', opacity: aus ? 0.6 : 1,
  fontFamily: 'Helvetica Neue,sans-serif',
})

const stillerKnopf: React.CSSProperties = {
  background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`,
  borderRadius: 4, padding: '7px 12px', fontSize: 12, whiteSpace: 'nowrap',
  cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif',
}

/** „17.09.2026" — ohne Uhrzeit, die hilft bei einer Einladung niemandem. */
function datum(wert: string | null): string {
  if (!wert) return '—'
  const d = new Date(wert)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function statusText(m: Mitglied): { label: string; farbe: string } {
  if (m.status === 'entfernt') return { label: 'Entfernt', farbe: C.textMid }
  if (m.status === 'eingeladen') return { label: 'Eingeladen', farbe: C.warn }
  if (m.ruhend) return { label: 'Ruhend', farbe: C.err }
  return { label: 'Aktiv', farbe: C.ok }
}

export default function TeamSettings({ istInhaber, aufPlan }: {
  istInhaber: boolean
  /** Wechselt in den Bereich „Mein Plan" — der Weg zu mehr Nutzerplätzen. */
  aufPlan?: () => void
}) {
  const [daten, setDaten] = useState<TeamAntwort | null>(null)
  const [laedt, setLaedt] = useState(true)
  const [listenFehler, setListenFehler] = useState('')

  const [neueEmail, setNeueEmail] = useState('')
  const [einladenLaeuft, setEinladenLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null)
  /** Welche Zeile wartet gerade auf eine Antwort — sperrt nur diese Knöpfe. */
  const [zeileLaeuft, setZeileLaeuft] = useState<string | null>(null)
  const [verlassenLaeuft, setVerlassenLaeuft] = useState(false)

  // Beim Aufbau einmal laden — dasselbe Muster wie in BauweiseSettings und
  // WuenscheSettings (freie async-Funktion, kein useCallback: sonst meldet
  // react-hooks/set-state-in-effect den Aufruf im Effekt als Fehler).
  useEffect(() => { void laden() }, [])

  async function laden() {
    try {
      const res = await fetch('/api/team')
      const json = await res.json().catch(() => ({})) as TeamAntwort & { error?: string }
      if (!res.ok) {
        setListenFehler(json.error ?? `Das Team konnte nicht geladen werden (${res.status}).`)
        setDaten(null)
      } else {
        setListenFehler('')
        setDaten(json)
      }
    } catch (e) {
      setListenFehler(`Verbindungsfehler: ${e instanceof Error ? e.message : e}`)
      setDaten(null)
    }
    setLaedt(false)
  }

  async function einladen() {
    const email = neueEmail.trim()
    if (!email) return
    setEinladenLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/team/einladen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setMeldung({ ok: false, text: json.error ?? `Die Einladung ist nicht rausgegangen (${res.status}).` })
      } else {
        setNeueEmail('')
        setMeldung({ ok: true, text: `Einladung an ${email} verschickt.` })
        await laden()
      }
    } catch (e) {
      setMeldung({ ok: false, text: `Verbindungsfehler: ${e instanceof Error ? e.message : e}` })
    }
    setEinladenLaeuft(false)
  }

  async function erneutSenden(m: Mitglied) {
    setZeileLaeuft(m.id)
    setMeldung(null)
    try {
      const res = await fetch(`/api/team/${m.id}`, { method: 'POST' })
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      setMeldung(res.ok
        ? { ok: true, text: `Einladung an ${m.email} erneut verschickt.` }
        : { ok: false, text: json.error ?? `Erneut senden hat nicht geklappt (${res.status}).` })
    } catch (e) {
      setMeldung({ ok: false, text: `Verbindungsfehler: ${e instanceof Error ? e.message : e}` })
    }
    setZeileLaeuft(null)
  }

  async function entfernen(m: Mitglied) {
    // Rückfrage, weil der Griff nicht rückgängig zu machen ist, ohne neu einzuladen.
    // Der Datensatz bleibt (status = 'entfernt') — gelöscht wird nichts (Spec §4).
    const frage = m.status === 'eingeladen'
      ? `Einladung an ${m.email} löschen?`
      : `${m.email} aus dem Betrieb entfernen? Der Zugang endet sofort.`
    if (!window.confirm(frage)) return
    setZeileLaeuft(m.id)
    setMeldung(null)
    try {
      const res = await fetch(`/api/team/${m.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setMeldung({ ok: false, text: json.error ?? `Entfernen hat nicht geklappt (${res.status}).` })
      } else {
        setMeldung({ ok: true, text: m.status === 'eingeladen' ? 'Einladung gelöscht.' : `${m.email} wurde entfernt.` })
        await laden()
      }
    } catch (e) {
      setMeldung({ ok: false, text: `Verbindungsfehler: ${e instanceof Error ? e.message : e}` })
    }
    setZeileLaeuft(null)
  }

  async function verlassen() {
    if (!window.confirm('Diesen Betrieb verlassen? Du siehst die Projekte des Betriebs danach nicht mehr.')) return
    setVerlassenLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/team/verlassen', { method: 'POST' })
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setMeldung({ ok: false, text: json.error ?? `Verlassen hat nicht geklappt (${res.status}).` })
        setVerlassenLaeuft(false)
        return
      }
      // Vollständiger Seitenwechsel, kein Zustandswechsel: Konto-ID, Plan, Kopfzeile
      // und alle geladenen Daten gehören ab jetzt einem anderen Betrieb.
      window.location.href = '/settings'
    } catch (e) {
      setMeldung({ ok: false, text: `Verbindungsfehler: ${e instanceof Error ? e.message : e}` })
      setVerlassenLaeuft(false)
    }
  }

  const plaetze = daten?.plaetze
  const voll = plaetze ? (plaetze.frei !== null && plaetze.frei <= 0) : false
  const mitglieder = daten?.mitglieder ?? []
  const offeneZeilen = mitglieder.filter(m => m.status !== 'entfernt')
  const alteZeilen = mitglieder.filter(m => m.status === 'entfernt')

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: C.white }}>Team</h2>
      <p style={{ fontSize: 12, color: C.textMid, marginBottom: 18, lineHeight: 1.6 }}>
        {istInhaber
          ? 'Mitarbeiter arbeiten auf den Daten deines Betriebs — Projekte, Kunden, Kalkulation, Einstellungen. Plan und Abo sowie dieses Team bleiben bei dir.'
          : 'Du arbeitest auf den Daten dieses Betriebs. Plan, Abo und das Team verwaltet der Inhaber.'}
      </p>

      {/* ── Plätze ─────────────────────────────────────── */}
      {plaetze && (
        <div style={{
          background: voll ? ton(C.err, '12') : akzentTon('11'),
          border: `1px solid ${voll ? ton(C.err, '55') : akzentTon('44')}`,
          borderRadius: 8, padding: '12px 14px', marginBottom: 18,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, color: C.white, fontWeight: 700 }}>
            {plaetze.deckel === null
              ? `${plaetze.belegt} Nutzer — unbegrenzt viele Plätze`
              : plaetze.belegt > plaetze.deckel
                // Gesamtprüfung M9 (17.09.): „2 von 1 Plätzen belegt“ las sich wie ein Rechenfehler.
                ? `${plaetze.deckel} ${plaetze.deckel === 1 ? 'Platz' : 'Plätze'} im Plan, ${plaetze.belegt} Nutzer — ${plaetze.belegt - plaetze.deckel} ${plaetze.belegt - plaetze.deckel === 1 ? 'ruht' : 'ruhen'}`
                : `${plaetze.belegt} von ${plaetze.deckel} Plätzen belegt`}
          </span>
          <span style={{ fontSize: 11, color: C.textMid }}>
            Der Inhaber belegt Platz 1. Offene Einladungen zählen mit.
          </span>
          {voll && (
            <button
              onClick={aufPlan}
              style={{ ...stillerKnopf, color: C.copper, borderColor: akzentTon('66'), marginLeft: 'auto' }}
            >Mehr Plätze → Mein Plan</button>
          )}
        </div>
      )}

      {/* ── Einladen (nur Inhaber) ─────────────────────── */}
      {istInhaber && (
        <div style={{ marginBottom: 22 }}>
          <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.textMid, marginBottom: 4, display: 'block' }}>
            Mitarbeiter einladen
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              placeholder="name@betrieb.de"
              value={neueEmail}
              onChange={e => setNeueEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void einladen() }}
              disabled={einladenLaeuft}
              style={inp({ flex: 1 })}
            />
            <button
              onClick={() => void einladen()}
              disabled={einladenLaeuft || !neueEmail.trim()}
              style={kupferKnopf(einladenLaeuft || !neueEmail.trim())}
            >{einladenLaeuft ? '…' : 'Einladen'}</button>
          </div>
          <div style={{ fontSize: 11, color: C.textMid, marginTop: 6, lineHeight: 1.5 }}>
            Der Eingeladene bekommt eine E-Mail mit einem Link und meldet sich damit an
            oder registriert sich neu.
          </div>
        </div>
      )}

      {meldung && (
        <div style={{
          marginBottom: 16, padding: '10px 12px', borderRadius: 6, fontSize: 12, lineHeight: 1.5,
          background: meldung.ok ? ton(C.ok, '14') : ton(C.err, '14'),
          border: `1px solid ${meldung.ok ? ton(C.ok, '55') : ton(C.err, '55')}`,
          color: meldung.ok ? C.ok : C.err,
        }}>{meldung.text}</div>
      )}

      {/* ── Liste ──────────────────────────────────────── */}
      {laedt ? (
        <div style={{ fontSize: 13, color: C.textMid }}>Lädt …</div>
      ) : listenFehler ? (
        <div style={{
          background: ton(C.err, '14'), border: `1px solid ${ton(C.err, '55')}`,
          borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.err, lineHeight: 1.5,
        }}>{listenFehler}</div>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {/* Der Inhaber steht mit in der Liste — sonst wirkt „1 von 3 belegt" bei
              leerem Team wie ein Fehler. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '12px 14px', background: C.gray1, borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{ fontSize: 13, color: C.white, flex: 1, minWidth: 160, wordBreak: 'break-all' }}>
              {daten?.inhaber?.email ?? '—'}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.copper, letterSpacing: 0.5 }}>Inhaber</span>
          </div>

          {offeneZeilen.length === 0 && (
            <div style={{ padding: '18px 14px', fontSize: 13, color: C.textMid, lineHeight: 1.6 }}>
              {istInhaber
                ? 'Noch niemand eingeladen. Trage oben eine E-Mail-Adresse ein.'
                : 'Ausser dir und dem Inhaber ist niemand im Betrieb.'}
            </div>
          )}

          {offeneZeilen.map(m => {
            const st = statusText(m)
            const wartet = zeileLaeuft === m.id
            return (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '12px 14px', borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, color: C.white, wordBreak: 'break-all' }}>{m.email}</div>
                  <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>
                    {m.status === 'eingeladen'
                      ? `eingeladen am ${datum(m.eingeladen_am)}`
                      : `dabei seit ${datum(m.angenommen_am)}`}
                  </div>
                  {m.ruhend && m.status === 'aktiv' && (
                    <div style={{ fontSize: 11, color: C.err, marginTop: 4, lineHeight: 1.5 }}>
                      {TEAM_TEXTE.ruhend}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.farbe, letterSpacing: 0.5 }}>{st.label}</span>
                {istInhaber && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {m.status === 'eingeladen' && (
                      <button onClick={() => void erneutSenden(m)} disabled={wartet}
                        style={{ ...stillerKnopf, cursor: wartet ? 'not-allowed' : 'pointer', opacity: wartet ? 0.6 : 1 }}
                      >{wartet ? '…' : 'Erneut senden'}</button>
                    )}
                    <button onClick={() => void entfernen(m)} disabled={wartet} style={rotKnopf(wartet)}>
                      {m.status === 'eingeladen' ? 'Löschen' : 'Entfernen'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Entfernte bleiben als Historie sichtbar — nichts wird gelöscht (Spec §4). */}
          {alteZeilen.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '10px 14px', borderBottom: `1px solid ${C.border}`, opacity: 0.55,
            }}>
              <div style={{ flex: 1, minWidth: 160, fontSize: 12, color: C.textMid, wordBreak: 'break-all' }}>
                {m.email}
              </div>
              <span style={{ fontSize: 11, color: C.textMid, letterSpacing: 0.5 }}>Entfernt</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Betrieb verlassen (nur Mitarbeiter) ────────── */}
      {!istInhaber && (
        <div style={{ marginTop: 24, borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
          <div style={{ fontSize: 12, color: C.textMid, marginBottom: 10, lineHeight: 1.6 }}>
            Wenn du diesen Betrieb verlässt, siehst du seine Projekte und Einstellungen
            nicht mehr. Dein Login bleibt bestehen und du kannst einen eigenen Betrieb
            anlegen.
          </div>
          <button onClick={() => void verlassen()} disabled={verlassenLaeuft} style={rotKnopf(verlassenLaeuft)}>
            {verlassenLaeuft ? '…' : 'Betrieb verlassen'}
          </button>
        </div>
      )}
    </div>
  )
}
