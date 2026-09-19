'use client'
import { useState } from 'react'
import { C } from '@/lib/types'
import { KOMMENTAR_MAX } from '@/lib/kommentare'

// Das Gespräch unter einem Wunsch. Sitzt in der Wunschliste unter
// Einstellungen → Wünsche.
//
// WICHTIG FÜR DIE ANZEIGE: Was hier geschrieben wird, steht ohne Freigabeschritt
// auf www.getcraftflow.de (Fabian, 19.09.). Deshalb sagt der Knopf das auch —
// niemand soll hinterher überrascht sein, wo sein Satz gelandet ist.

export type Kommentar = {
  id: string
  wunschId: string
  autor: string
  text: string
  datum: string
  vomEntwickler: boolean
  vonMir?: boolean
}

function wannGeschrieben(iso: string): string {
  const d = new Date(iso)
  const minuten = Math.floor((Date.now() - d.getTime()) / 60000)
  if (minuten < 1) return 'gerade eben'
  if (minuten < 60) return `vor ${minuten} min`
  const stunden = Math.floor(minuten / 60)
  if (stunden < 24) return `vor ${stunden} h`
  const tage = Math.floor(stunden / 24)
  if (tage === 1) return 'gestern'
  if (tage < 14) return `vor ${tage} Tagen`
  return d.toLocaleDateString('de-DE')
}

export default function WunschKommentare({
  wunschId, kommentare, istAdmin, anzeigeName, onNeu, onWeg,
}: {
  wunschId: string
  kommentare: Kommentar[]
  istAdmin: boolean
  /** Der Name, unter dem der eigene Kommentar erscheinen wird. */
  anzeigeName: string
  onNeu: (k: Kommentar) => void
  onWeg: (id: string) => void
}) {
  const [offen, setOffen] = useState(false)
  const [text, setText] = useState('')
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState('')
  const [alsCraftFlow, setAlsCraftFlow] = useState(istAdmin)

  const sichtbar = offen || kommentare.length > 0

  async function senden() {
    setFehler(''); setSendet(true)
    const res = await fetch('/api/wuensche/kommentare', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wunschId, text, alsCraftFlow: istAdmin && alsCraftFlow }),
    })
    const j = await res.json().catch(() => ({})) as { kommentar?: Kommentar; error?: string }
    setSendet(false)
    // Supabase wirft nicht — der echte Grund gehoert auf den Bildschirm.
    if (!res.ok || !j.kommentar) { setFehler(j.error ?? `Senden fehlgeschlagen (${res.status})`); return }
    onNeu(j.kommentar)
    setText('')
  }

  async function loeschen(id: string) {
    const res = await fetch(`/api/wuensche/kommentare?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { error?: string }
      setFehler(j.error ?? 'Löschen fehlgeschlagen'); return
    }
    onWeg(id)
  }

  if (!sichtbar) {
    return (
      <button onClick={() => setOffen(true)} style={{
        background: 'transparent', border: 'none', color: C.copper, fontSize: 12,
        cursor: 'pointer', padding: 0, marginTop: 8, textDecoration: 'underline' }}>
        Etwas dazu sagen
      </button>
    )
  }

  return (
    <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
      {kommentare.map(k => (
        <div key={k.id} style={{
          marginBottom: 8, paddingLeft: k.vomEntwickler ? 10 : 0,
          borderLeft: k.vomEntwickler ? `2px solid ${C.copper}` : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: k.vomEntwickler ? C.copper : C.white }}>
              {k.autor}
            </span>
            <span style={{ fontSize: 11, color: C.textMid }}>{wannGeschrieben(k.datum)}</span>
            {(k.vonMir || istAdmin) && (
              <button onClick={() => void loeschen(k.id)} title="Kommentar löschen"
                style={{ background: 'transparent', border: 'none', color: C.textMid,
                  fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                löschen
              </button>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: C.textMid, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 2 }}>
            {k.text}
          </div>
        </div>
      ))}

      <textarea value={text} maxLength={KOMMENTAR_MAX} rows={2}
        placeholder="Geht dir das auch so? Schreib, wie du es machst."
        onChange={e => { setFehler(''); setText(e.target.value) }}
        style={{ width: '100%', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 6,
          color: C.white, padding: '8px 10px', fontSize: 12.5, boxSizing: 'border-box',
          fontFamily: 'Helvetica Neue,sans-serif', resize: 'vertical', marginTop: 4 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
        <button onClick={() => void senden()} disabled={!text.trim() || sendet} style={{
          background: text.trim() ? C.copper : 'transparent',
          border: text.trim() ? 'none' : `1px solid ${C.border}`, borderRadius: 6,
          color: text.trim() ? C.onAccent : C.textMid, fontWeight: text.trim() ? 700 : 400,
          padding: '7px 14px', fontSize: 12, cursor: text.trim() ? 'pointer' : 'default',
          opacity: sendet ? 0.6 : 1 }}>
          {sendet ? 'Sendet …' : 'Senden'}
        </button>

        {istAdmin && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5,
            color: alsCraftFlow ? C.copper : C.textMid, cursor: 'pointer' }}>
            <input type="checkbox" checked={alsCraftFlow} onChange={e => setAlsCraftFlow(e.target.checked)} />
            als Antwort von CraftFlow
          </label>
        )}

        {/* Ohne Freigabeschritt muss der Hinweis VOR dem Klick stehen, nicht danach. */}
        <span style={{ fontSize: 11, color: C.textMid }}>
          {istAdmin && alsCraftFlow
            ? 'Erscheint öffentlich als Antwort von CraftFlow.'
            : <>Erscheint öffentlich als <b style={{ color: C.copper }}>{anzeigeName}</b>.</>}
        </span>

        {fehler && <span style={{ fontSize: 12, color: C.err }}>{fehler}</span>}
      </div>
    </div>
  )
}
