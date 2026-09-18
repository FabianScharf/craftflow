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
 *
 * Nichts hier darf den Start stören: Fehler beim Laden heißen „kein Fenster", nicht
 * „Fehlermeldung". Wer gerade arbeiten will, hat mit einem Hinweis auf Neuigkeiten
 * nichts zu gewinnen und mit einer roten Box alles zu verlieren.
 */

const ZEICHEN: Record<string, string> = {
  Team: '👥', Kalkulation: '📐', 'Mein Betrieb': '📈', Wünsche: '🙋', Gestaltung: '🎨',
}

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
        void fetch('/api/neuheiten', { method: 'POST' })
      } catch { /* kein Fenster ist besser als ein Fehler */ }
    })()
    return () => { abgebrochen = true }
  }, [])

  if (!offen || anzeige.art === 'nichts') return null

  const zu = () => setOffen(false)
  const werkstatt = (url?: string) => {
    window.open(url ?? 'https://www.getcraftflow.de/werkstatt#neu', '_blank', 'noopener')
    setOffen(false)
  }

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
        }}>Ansehen →</button>
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
            Seit deinem letzten Besuch
          </h2>
          <p style={{ fontSize: 13, color: C.textMid, margin: 0 }}>
            {neuheiten.length === 1 ? 'Eine Sache, die dir Arbeit spart.' : `${neuheiten.length} Dinge, die dir Arbeit sparen.`}
          </p>
        </div>

        <div style={{ padding: '20px 26px 6px' }}>
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
              und {weitere} {weitere === 1 ? 'weitere Neuerung' : 'weitere Neuerungen'}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '16px 26px 22px', borderTop: `1px solid ${C.border}`, marginTop: 8 }}>
          <button onClick={zu} style={{
            flex: 1, padding: '12px 0', borderRadius: 9, fontSize: 14, fontWeight: 600,
            background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Schließen</button>
          <button onClick={() => werkstatt()} style={{
            flex: 1, padding: '12px 0', borderRadius: 9, fontSize: 14, fontWeight: 600,
            background: C.copper, color: C.onAccent, border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Ansehen</button>
        </div>
      </div>
    </div>
  )
}
