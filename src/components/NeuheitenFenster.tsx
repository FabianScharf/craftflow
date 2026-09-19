'use client'

import { useEffect, useState } from 'react'
import { C } from '@/lib/types'
import { akzentTon } from '@/lib/theme'
import type { Anzeige, Fensterneuheit } from '@/lib/neuheitenfenster'

/**
 * „Neu in CraftFlow" beim Einloggen.
 *
 * Fabians Entscheidungen (19.09.2026):
 *  · „Ansehen" öffnet die Werkstatt-Seite in einem NEUEN Tab — die App bleibt stehen.
 *  · Das Fenster erscheint GENAU EINMAL. Der Merker wird gesetzt, sobald es zu sehen
 *    war, nicht erst beim Klicken: „sonst nervt es".
 *  · Kleine Neuerungen bekommen kein Fenster, sondern einen schmalen Streifen.
 *  · Nachgeschärft am 19.09. abends: Das Fenster hatte bis dahin genau ein Konto
 *    gesehen (Fabians eigenes), deshalb der Inhaltswechsel ohne Rücksicht auf
 *    Gewohnheiten. Es soll drei Dinge zeigen — die Werkstatt, die Wünsche und die
 *    Kommentare —, nicht nur eine Liste von Neuerungen: „Wer nie in die
 *    Einstellungen schaut, erfährt von den Wünschen nichts."
 *
 * Nichts hier darf den Start stören: Fehler beim Laden heißen „kein Fenster", nicht
 * „Fehlermeldung". Wer gerade arbeiten will, hat mit einem Hinweis auf Neuigkeiten
 * nichts zu gewinnen und mit einer roten Box alles zu verlieren.
 *
 * Es wird nur genannt, was es wirklich gibt: die Werkstatt unter
 * www.getcraftflow.de/werkstatt (je Funktion eine Seite, je Wunsch eine Seite mit
 * Kommentaren) und die Wünsche in der App unter Einstellungen → Wünsche
 * (vorschlagen, abstimmen, kommentieren; Anzeigename wählbar).
 */

const ZEICHEN: Record<string, string> = {
  Team: '👥', Kalkulation: '📐', 'Mein Betrieb': '📈', Wünsche: '🙋', Gestaltung: '🎨',
}

const WERKSTATT = 'https://www.getcraftflow.de/werkstatt'

export function NeuheitenFenster() {
  const [anzeige, setAnzeige] = useState<Anzeige>({ art: 'nichts' })
  const [offen, setOffen] = useState(false)

  useEffect(() => {
    let abgebrochen = false
    ;(async () => {
      try {
        const res = await fetch('/api/neuheiten')
        if (!res.ok) return
        const a = await res.json() as Anzeige
        if (abgebrochen || a.art === 'nichts') return
        setAnzeige(a)
        setOffen(true)
        // Gesehen ist gesehen — auch wer wegklickt, bekommt es nicht wieder.
        //
        // MITGESCHICKT WIRD DAS DATUM DER NEUESTEN GEZEIGTEN NEUERUNG, nicht „jetzt"
        // (19.09.2026): Der Merker wurde vorher auf den Aufrufzeitpunkt gesetzt —
        // wer sich am Veröffentlichungstag schon einmal eingeloggt hatte, bekam
        // alles, was an dem Tag noch kam, nie zu sehen. Ohne Datum schreibt die
        // Route gar nichts; lieber ein Fenster zweimal als eine Neuerung nie.
        const neueste = a.art === 'fenster'
          ? a.neuheiten.map(n => n.datum).sort().at(-1)
          : undefined
        if (neueste) {
          void fetch('/api/neuheiten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bis: neueste }),
          })
        }
      } catch { /* kein Fenster ist besser als ein Fehler */ }
    })()
    return () => { abgebrochen = true }
  }, [])

  if (!offen || anzeige.art === 'nichts') return null

  const zu = () => setOffen(false)
  // Neuer Tab: Wer sich gerade eingeloggt hat, will kalkulieren — die App darf ihm
  // nicht weggehen.
  const werkstatt = (url?: string) => {
    window.open(url ?? `${WERKSTATT}#neu`, '_blank', 'noopener')
    setOffen(false)
  }
  // Die Wünsche liegen IN der App. Voller Seitenwechsel statt Router-Push, damit die
  // Einstellungen den Anker `#wuensche` beim Laden auswerten und gleich im richtigen
  // Bereich aufgehen.
  const wuensche = () => { window.location.href = '/settings#wuensche' }

  /* ── Streifen: nur kleine Neuerungen ─────────────── */
  if (anzeige.art === 'streifen') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 16px',
        padding: '11px 16px', borderRadius: 10,
        border: `1px solid ${akzentTon('4d')}`, background: akzentTon('11'),
      }}>
        <span style={{ fontSize: 17 }}>✨</span>
        <span style={{ flex: 1, fontSize: 14, color: C.white }}>
          <strong>{anzeige.anzahl} {anzeige.anzahl === 1 ? 'Neuerung' : 'Neuerungen'}</strong> seit deinem letzten Besuch
        </span>
        <button onClick={() => werkstatt()} style={{
          background: 'none', border: 'none', color: C.copper, fontSize: 13,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>Zur Werkstatt →</button>
        <button onClick={zu} aria-label="Schließen" style={{
          background: 'none', border: 'none', color: C.textMid, fontSize: 18, cursor: 'pointer', lineHeight: 1,
        }}>×</button>
      </div>
    )
  }

  /* ── Fenster: etwas Großes ist dabei ─────────────── */
  const { neuheiten, weitere } = anzeige
  return (
    <div
      onClick={zu}
      style={{
        position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(5,5,5,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, background: C.black,
          border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.7)', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ padding: '22px 26px 0' }}>
          <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: C.copper, marginBottom: 6 }}>
            Neu in CraftFlow
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px', color: C.white, letterSpacing: -0.3 }}>
            Die Werkstatt ist offen
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: C.textMid, margin: 0 }}>
            Dort steht zu jeder Funktion eine eigene Seite — und daneben, was als Nächstes
            gebaut wird. Was das ist, entscheidest du mit.
          </p>
        </div>

        <div style={{ padding: '18px 26px 4px' }}>
          <div style={{ fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: C.textMid, marginBottom: 2 }}>
            Neu seit deinem letzten Besuch
          </div>
          {neuheiten.map((n: Fensterneuheit, i: number) => (
            <div
              key={n.slug}
              onClick={() => werkstatt(n.url)}
              style={{
                display: 'flex', gap: 14, padding: '14px 0', cursor: 'pointer',
                borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
              }}
            >
              <div style={{
                flexShrink: 0, width: 46, height: 46, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                background: C.gray2, border: `1px solid ${akzentTon('44')}`,
              }}>{ZEICHEN[n.bereich] ?? '🪚'}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: C.copper }}>
                  {n.bereich}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, margin: '2px 0 3px', color: C.white }}>{n.titel}</div>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: C.textMid, margin: 0 }}>{n.kurz}</p>
              </div>
            </div>
          ))}
          {weitere > 0 && (
            <div style={{ fontSize: 12, color: C.textMid, padding: '4px 0 8px' }}>
              und {weitere} {weitere === 1 ? 'weitere Neuerung' : 'weitere Neuerungen'} in der Werkstatt
            </div>
          )}
        </div>

        {/* Der Grund für das Fenster: Wer nie in die Einstellungen schaut, erfährt von
            den Wünschen nichts. Deshalb steht der Kasten abgesetzt und mit eigenem Knopf. */}
        <div style={{ padding: '10px 26px 0' }}>
          <div style={{
            borderRadius: 12, padding: '16px 18px',
            border: `1px solid ${akzentTon('4d')}`, background: akzentTon('11'),
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, lineHeight: 1.2 }}>🙋</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.white, marginBottom: 4 }}>
                  Wünsche: du sagst, was gebaut wird
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: C.textMid, margin: 0 }}>
                  Schlag vor, was dir fehlt, und gib deine Stimme dem, was dir am meisten
                  bringt. Die Liste ist öffentlich — jeder Wunsch hat in der Werkstatt
                  seine eigene Seite.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 12 }}>
              <span style={{ fontSize: 20, lineHeight: 1.2 }}>💬</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.white, marginBottom: 4 }}>
                  Kommentare: misch dich ein
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: C.textMid, margin: 0 }}>
                  Unter jedem Wunsch kannst du schreiben, wie du es aus deiner Werkstatt
                  kennst. Wie dein Name dabei erscheint, wählst du selbst: Betriebsname,
                  Vorname oder nur deine Region.
                </p>
              </div>
            </div>
            <button onClick={wuensche} style={{
              marginTop: 14, width: '100%', padding: '11px 0', borderRadius: 9,
              fontSize: 14, fontWeight: 600, background: C.copper, color: C.onAccent,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>Wünsche öffnen</button>
            <div style={{ fontSize: 11, color: C.textMid, textAlign: 'center', marginTop: 7 }}>
              Du findest sie jederzeit unter Einstellungen → Wünsche.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '16px 26px 22px', marginTop: 14, borderTop: `1px solid ${C.border}` }}>
          <button onClick={zu} style={{
            flex: 1, padding: '12px 0', borderRadius: 9, fontSize: 14, fontWeight: 600,
            background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Schließen</button>
          <button onClick={() => werkstatt()} style={{
            flex: 1, padding: '12px 0', borderRadius: 9, fontSize: 14, fontWeight: 600,
            background: 'transparent', color: C.white, border: `1px solid ${akzentTon('66')}`,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Zur Werkstatt</button>
        </div>
      </div>
    </div>
  )
}
