'use client'

import { useEffect, useState } from 'react'
import { C } from '@/lib/types'

// Einstellungen → Textbausteine.
//
// Fabian am 2026-09-08: "Ein Textbaustein ist für mich die Widerrufsbelehrung, aber
// wäre es nicht gut, wenn sich Kunden eigene Textbausteine bauen können?"
//
// Die festen Bausteine (Anrede, Einleitung, Abschluss, Zahlungskondition, Widerruf,
// Massivholzhinweis) liegen unter Briefpapier → Texte. Hier stehen die eigenen:
// beliebig viele, mit Titel und Text.

type Baustein = {
  id: string
  titel: string
  inhalt: string
  immer: boolean
  reihenfolge: number
  aktiv: boolean
}

// Startpunkte, damit niemand vor einem leeren Feld sitzt. Alles aus der Praxis eines
// Schreiners — nicht erfunden, sondern das, was in Angeboten üblicherweise fehlt.
const VORSCHLAEGE: Array<{ titel: string; inhalt: string }> = [
  {
    titel: 'Ausführungszeitraum',
    inhalt: 'Die Ausführung erfolgt nach Absprache, voraussichtlich 6–8 Wochen nach Auftragserteilung und erfolgtem Aufmaß.',
  },
  {
    titel: 'Materialpreisvorbehalt',
    inhalt: 'Die genannten Preise beruhen auf den Materialkosten zum Zeitpunkt der Angebotserstellung. Bei Preissteigerungen von mehr als 5 % zwischen Angebot und Ausführung behalten wir uns eine entsprechende Anpassung vor.',
  },
  {
    titel: 'Aufmaß',
    inhalt: 'Das Angebot beruht auf den uns genannten Maßen. Verbindlich wird die Kalkulation nach dem Aufmaß vor Ort.',
  },
  {
    titel: 'Bauseitige Leistungen',
    inhalt: 'Bauseits zu stellen sind: Strom- und Wasseranschlüsse am Aufstellort, freier Zugang zum Montageort sowie eine ausreichend tragfähige und ebene Wand bzw. Boden.',
  },
  {
    titel: 'Entsorgung',
    inhalt: 'Die Entsorgung von Altmöbeln und Verpackungsmaterial ist im Angebot nicht enthalten und wird nach Aufwand berechnet.',
  },
  {
    titel: 'Steuerermäßigung § 35a EStG',
    inhalt: 'Für Privatkunden: Der in diesem Angebot enthaltene Lohnanteil ist nach § 35a EStG steuerlich absetzbar. Auf der Rechnung weisen wir ihn gesondert aus.',
  },
]

export default function TextbausteineSettings() {
  const [liste, setListe] = useState<Baustein[]>([])
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [neuTitel, setNeuTitel] = useState('')

  // Der Wachposten verhindert ein Setzen, nachdem die Ansicht schon gewechselt hat —
  // und haelt den Linter davon ab, ein synchrones setState im Effekt zu sehen.
  useEffect(() => {
    let aktiv = true
    void (async () => {
      const res = await fetch('/api/settings/textbausteine')
      const j = await res.json().catch(() => ({}))
      if (!aktiv) return
      if (!res.ok) setFehler(j.error ?? `Laden fehlgeschlagen (${res.status})`)
      else setListe(j.bausteine ?? [])
      setLaedt(false)
    })()
    return () => { aktiv = false }
  }, [])

  async function anlegen(titel: string, inhalt = '') {
    if (!titel.trim()) return
    setFehler('')
    const res = await fetch('/api/settings/textbausteine', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titel, inhalt }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setFehler(j.error ?? 'Anlegen fehlgeschlagen'); return }
    setListe(prev => [...prev, j])
    setNeuTitel('')
  }

  // Ohne Verzoegerung waere das ein Schreibvorgang pro Tastendruck.
  const [warten, setWarten] = useState<Record<string, ReturnType<typeof setTimeout>>>({})
  function aendern(id: string, feld: Partial<Baustein>, sofort = false) {
    setListe(prev => prev.map(b => b.id === id ? { ...b, ...feld } : b))
    clearTimeout(warten[id])
    const senden = async () => {
      const res = await fetch('/api/settings/textbausteine', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...feld }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setFehler(j.error ?? 'Speichern fehlgeschlagen')
      } else setFehler('')
    }
    if (sofort) void senden()
    else setWarten(w => ({ ...w, [id]: setTimeout(senden, 700) }))
  }

  async function loeschen(id: string) {
    const res = await fetch(`/api/settings/textbausteine?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setFehler(j.error ?? 'Löschen fehlgeschlagen')
      return
    }
    setListe(prev => prev.filter(b => b.id !== id))
  }

  const vorhandeneTitel = new Set(liste.map(b => b.titel.toLowerCase()))
  const offeneVorschlaege = VORSCHLAEGE.filter(v => !vorhandeneTitel.has(v.titel.toLowerCase()))

  if (laedt) return <div style={{ color: '#7A7A7A', fontSize: 13 }}>Lädt …</div>

  return (
    <div>
      <h2 style={{ color: C.white, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Textbausteine</h2>
      <p style={{ color: '#8A8A8A', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
        Eigene Absätze, die unter den Positionen im Angebot stehen — Ausführungszeitraum,
        Materialpreisvorbehalt, bauseitige Leistungen. Mit <b>&bdquo;immer&ldquo;</b> steht ein Baustein
        ohne Zutun in jedem neuen Angebot; sonst wählst du ihn im Angebot einzeln aus.
      </p>
      <p style={{ color: '#7A7A7A', fontSize: 12, lineHeight: 1.6, marginBottom: 22 }}>
        Anrede, Einleitung, Grußformel, Zahlungskondition, Widerrufsbelehrung und der
        Massivholz-Hinweis stehen unter <b>Briefpapier → Texte</b>.
      </p>

      {fehler && (
        <div style={{ background: '#3A1A1A', border: '1px solid #6A2A2A', borderRadius: 8,
          padding: '10px 14px', color: '#FFB0B0', fontSize: 13, marginBottom: 18 }}>{fehler}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 26 }}>
        {liste.map(b => (
          <div key={b.id} style={{ background: '#1A1A1A', border: `1px solid ${b.aktiv ? '#2E2E2E' : '#242424'}`,
            borderRadius: 8, padding: 14, opacity: b.aktiv ? 1 : 0.55 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <input
                value={b.titel}
                onChange={e => aendern(b.id, { titel: e.target.value })}
                placeholder="Titel, z.B. Ausführungszeitraum"
                style={{ flex: 1, minWidth: 0, background: '#222', border: '1px solid #2E2E2E',
                  borderRadius: 4, padding: '8px 10px', fontSize: 13, fontWeight: 700,
                  color: C.white, fontFamily: 'Helvetica Neue,sans-serif', outline: 'none' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                color: b.immer ? C.copper : '#8A8A8A', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={b.immer}
                  onChange={e => aendern(b.id, { immer: e.target.checked }, true)}
                  style={{ accentColor: C.copper, width: 15, height: 15 }} />
                immer
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                color: '#8A8A8A', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={b.aktiv}
                  onChange={e => aendern(b.id, { aktiv: e.target.checked }, true)}
                  style={{ accentColor: C.copper, width: 15, height: 15 }} />
                aktiv
              </label>
              <button onClick={() => void loeschen(b.id)}
                title="Baustein löschen"
                style={{ background: 'transparent', color: '#8A8A8A', border: '1px solid #2E2E2E',
                  borderRadius: 4, padding: '5px 9px', cursor: 'pointer', fontSize: 12 }}>✕</button>
            </div>
            <textarea
              value={b.inhalt}
              onChange={e => aendern(b.id, { inhalt: e.target.value })}
              placeholder="Text des Bausteins. Eine Leerzeile ergibt einen neuen Absatz."
              style={{ width: '100%', minHeight: 78, boxSizing: 'border-box', resize: 'vertical',
                background: '#222', border: '1px solid #2E2E2E', borderRadius: 4,
                padding: '9px 11px', fontSize: 12.5, lineHeight: 1.7, color: C.white,
                fontFamily: 'Helvetica Neue,sans-serif', outline: 'none' }}
            />
          </div>
        ))}
        {liste.length === 0 && (
          <div style={{ color: '#7A7A7A', fontSize: 13, padding: '14px 0' }}>
            Noch keine eigenen Bausteine. Unten stehen Vorschläge aus der Praxis — ein Klick
            legt sie an, den Text kannst du danach frei ändern.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 26 }}>
        <input
          value={neuTitel}
          onChange={e => setNeuTitel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void anlegen(neuTitel) }}
          placeholder="Neuer Baustein — Titel eingeben"
          style={{ flex: 1, background: '#222', border: '1px solid #2E2E2E', borderRadius: 6,
            padding: '10px 12px', fontSize: 13, color: C.white,
            fontFamily: 'Helvetica Neue,sans-serif', outline: 'none' }}
        />
        <button onClick={() => void anlegen(neuTitel)}
          style={{ background: C.copper, color: '#0D0D0D', border: 'none', borderRadius: 6,
            padding: '10px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            fontFamily: 'Helvetica Neue,sans-serif' }}>Anlegen</button>
      </div>

      {offeneVorschlaege.length > 0 && (
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            color: '#8A8A8A', marginBottom: 10 }}>Vorschläge aus der Praxis</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {offeneVorschlaege.map(v => (
              <button key={v.titel} onClick={() => void anlegen(v.titel, v.inhalt)}
                title={v.inhalt}
                style={{ background: '#1C1C1C', border: '1px solid #2E2E2E', borderRadius: 20,
                  padding: '7px 14px', fontSize: 12, color: '#B0B0B0', cursor: 'pointer',
                  fontFamily: 'Helvetica Neue,sans-serif' }}>
                + {v.titel}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#7A7A7A', marginTop: 10, lineHeight: 1.6 }}>
            Vorformuliert, aber nicht in Stein: Nach dem Anlegen kannst du jeden Text ändern.
            Prüfe ihn einmal auf deinen Betrieb — besonders Fristen und Prozentsätze.
          </div>
        </div>
      )}
    </div>
  )
}
