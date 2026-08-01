'use client'
import { useEffect, useState } from 'react'
import { C } from '@/lib/types'
import { BEREICHE, WARNUNG_AB_REGELN, MAX_REGELN_IM_PROMPT, istGleicheRegel } from '@/lib/learn'

type Regel = {
  id: string
  bereich: string
  wenn: string
  dann: string
  herkunft: string
  quelle_text: string
  beleg: string
  aktiv: boolean
  gesendet_zahl: number
  zuletzt_gesendet: string | null
  konflikt_hinweis: boolean
  created_at: string
}

export default function BauweiseSettings() {
  const [regeln, setRegeln] = useState<Regel[]>([])
  const [laedt, setLaedt] = useState(true)
  const [neuOffen, setNeuOffen] = useState(false)
  const [neuBereich, setNeuBereich] = useState<string>(BEREICHE[0])
  const [neuWenn, setNeuWenn] = useState('')
  const [neuDann, setNeuDann] = useState('')
  const [neuFehler, setNeuFehler] = useState('')

  useEffect(() => { loadRegeln() }, [])

  async function loadRegeln() {
    const res = await fetch('/api/settings/bauweise')
    if (res.ok) {
      const json = await res.json() as { regeln?: Regel[] }
      setRegeln(json.regeln ?? [])
    }
    setLaedt(false)
  }

  const aktive = regeln.filter(r => r.aktiv)
  // Reihenfolge wie im Prompt (siehe ladeAktiveRegeln): zuletzt gesendet zuerst,
  // dann neueste zuerst — muss die Backend-Sortierung spiegeln, sonst stimmt
  // die "wird nicht mitgeschickt"-Markierung nicht mit der Realität überein.
  const imPromptIds = new Set(
    [...aktive]
      .sort((a, b) => {
        const za = a.zuletzt_gesendet ? Date.parse(a.zuletzt_gesendet) : -1
        const zb = b.zuletzt_gesendet ? Date.parse(b.zuletzt_gesendet) : -1
        if (za !== zb) return zb - za
        return Date.parse(b.created_at) - Date.parse(a.created_at)
      })
      .slice(0, MAX_REGELN_IM_PROMPT)
      .map(r => r.id),
  )

  const aendern = async (id: string, patch: { wenn?: string; dann?: string; aktiv?: boolean }) => {
    await fetch('/api/settings/bauweise', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    void loadRegeln()
  }

  const loeschen = async (id: string) => {
    if (!confirm('Regel wirklich löschen?')) return
    await fetch('/api/settings/bauweise', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    void loadRegeln()
  }

  const anlegen = async () => {
    if (!neuDann.trim()) return
    // Client-seitige Dublettenprüfung: verhindert, dass zwei Regeln mit
    // gleichem Bereich und gleicher Bedingung, aber widersprüchlichem "Dann"
    // entstehen — die Route selbst prüft das bei manuell angelegten Regeln
    // nicht. Lieber hier blocken und zur bestehenden Regel schicken, als der
    // KI zwei widersprüchliche Vorgaben mitzugeben.
    const dupe = regeln.find(r => istGleicheRegel(r, { bereich: neuBereich, wenn: neuWenn }))
    if (dupe) {
      setNeuFehler(
        `Für „${neuBereich}"${neuWenn.trim() ? ` bei „${neuWenn.trim()}"` : ' (gilt immer)'} gibt es schon eine Regel `
        + `(„${dupe.dann}"). Bitte bearbeite diese Regel oben, statt eine zweite, widersprüchliche anzulegen.`,
      )
      return
    }
    setNeuFehler('')
    await fetch('/api/settings/bauweise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bereich: neuBereich, wenn: neuWenn, dann: neuDann, herkunft: 'manuell' }),
    })
    setNeuWenn(''); setNeuDann(''); setNeuOffen(false)
    void loadRegeln()
  }

  if (laedt) return <div style={{ fontSize: 12, color: C.textMid, padding: 16 }}>Lade Regeln…</div>

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: C.white }}>Meine Bauweise</h2>
      <p style={{ fontSize: 12, color: C.textMid, marginBottom: 16 }}>Was CraftFlow von dir gelernt hat</p>

      <div style={{ fontSize: 12, color: C.textMid, marginBottom: 14, lineHeight: 1.5 }}>
        Diese Regeln fließen in jede Kalkulation ein und gelten nur für dein Konto. Stundensätze und
        Materialaufschläge gehören weiterhin in die jeweiligen Bereiche — hier geht es um Bauweise,
        Material und Zeitgefühl.
      </div>

      {aktive.length >= WARNUNG_AB_REGELN && (
        <div style={{ border: `1px solid ${C.copper}55`, background: `${C.copper}15`, borderRadius: 3, padding: 10, marginBottom: 14, fontSize: 11, color: C.white, lineHeight: 1.5 }}>
          Du hast {aktive.length} aktive Regeln. Ab {MAX_REGELN_IM_PROMPT} werden nicht mehr alle
          mitgeschickt — räume am besten auf, was nicht mehr stimmt.
        </div>
      )}

      {regeln.length === 0 && (
        <div style={{ fontSize: 12, color: C.textMid, marginBottom: 14 }}>
          Noch keine Regeln. CraftFlow fragt dich nach dem Speichern eines Angebots, wenn ihm etwas
          auffällt — oder du legst hier selbst eine an.
        </div>
      )}

      {BEREICHE.filter(b => regeln.some(r => r.bereich === b)).map(bereich => (
        <div key={bereich} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.copper, fontFamily: 'Helvetica Neue,sans-serif', marginBottom: 8 }}>
            {bereich.toUpperCase()}
          </div>
          {regeln.filter(r => r.bereich === bereich).map(r => (
            <div key={r.id} style={{ border: `1px solid ${C.border}`, borderRadius: 3, padding: 12, marginBottom: 8, background: C.gray1, opacity: r.aktiv ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={r.aktiv}
                  onChange={() => void aendern(r.id, { aktiv: !r.aktiv })}
                  style={{ accentColor: C.copper, cursor: 'pointer', flexShrink: 0 }}
                  title={r.aktiv ? 'Regel ist aktiv' : 'Regel ist aus'}
                />
                <span style={{ fontSize: 11, color: C.textMid, flex: 1 }}>
                  {r.herkunft === 'manuell' ? 'von mir eingetippt' : r.quelle_text || 'gelernt'}
                </span>
                <button
                  onClick={() => void loeschen(r.id)}
                  style={{ background: 'transparent', border: 'none', color: C.textMid, cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                  title="Regel löschen"
                >×</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.textMid, width: 38, flexShrink: 0 }}>Wenn</span>
                <input
                  defaultValue={r.wenn}
                  onBlur={e => { if (e.target.value !== r.wenn) void aendern(r.id, { wenn: e.target.value }) }}
                  placeholder="gilt immer"
                  style={{ flex: 1, background: C.black, color: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 8px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: C.textMid, width: 38, flexShrink: 0 }}>Dann</span>
                <input
                  defaultValue={r.dann}
                  onBlur={e => { if (e.target.value !== r.dann && e.target.value.trim()) void aendern(r.id, { dann: e.target.value }) }}
                  style={{ flex: 1, background: C.black, color: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 8px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif' }}
                />
              </div>

              {r.beleg && <div style={{ fontSize: 10, color: C.textMid, marginTop: 6 }}>↳ belegt: {r.beleg}</div>}

              <div style={{ fontSize: 10, color: C.textMid, marginTop: 6 }}>
                {r.gesendet_zahl === 0
                  ? 'noch nicht mitgeschickt'
                  : `${r.gesendet_zahl}× mitgeschickt${r.zuletzt_gesendet ? `, zuletzt ${new Date(r.zuletzt_gesendet).toLocaleDateString('de-DE')}` : ''}`}
              </div>

              {r.konflikt_hinweis && (
                <div style={{ fontSize: 10, color: '#E0B05A', marginTop: 6 }}>
                  ⚠ Du hast das kürzlich wieder anders gemacht — greift diese Regel noch?
                </div>
              )}
              {r.aktiv && !imPromptIds.has(r.id) && (
                <div style={{ fontSize: 10, color: '#E05A5A', marginTop: 6 }}>
                  Wird derzeit NICHT mitgeschickt — Obergrenze von {MAX_REGELN_IM_PROMPT} Regeln erreicht.
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {!neuOffen ? (
        <button
          onClick={() => { setNeuOffen(true); setNeuFehler('') }}
          style={{ background: 'transparent', color: C.copper, border: `1px solid ${C.copper}55`, borderRadius: 3, padding: '10px 14px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700, cursor: 'pointer' }}
        >
          + Regel selbst anlegen
        </button>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 3, padding: 12, background: C.gray1 }}>
          <select
            value={neuBereich}
            onChange={e => { setNeuBereich(e.target.value); setNeuFehler('') }}
            style={{ background: C.black, color: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 8px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', marginBottom: 8, width: '100%' }}
          >
            {BEREICHE.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <input
            value={neuWenn}
            onChange={e => { setNeuWenn(e.target.value); setNeuFehler('') }}
            placeholder="Wenn … (leer lassen für: gilt immer)"
            style={{ width: '100%', background: C.black, color: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 8px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', marginBottom: 8 }}
          />
          <input
            value={neuDann}
            onChange={e => setNeuDann(e.target.value)}
            placeholder="Dann … (z.B. Rückwand 8mm Multiplex, kein HPL)"
            style={{ width: '100%', background: C.black, color: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 8px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', marginBottom: 10 }}
          />
          {neuFehler && (
            <div style={{ fontSize: 11, color: '#E05A5A', marginBottom: 10, lineHeight: 1.5 }}>{neuFehler}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setNeuOffen(false); setNeuWenn(''); setNeuDann(''); setNeuFehler('') }}
              style={{ flex: 1, background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '9px 0', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', cursor: 'pointer' }}
            >Abbrechen</button>
            <button
              onClick={() => void anlegen()}
              disabled={!neuDann.trim()}
              style={{ flex: 1, background: neuDann.trim() ? C.copper : C.gray2, color: neuDann.trim() ? C.black : C.textMid, border: 'none', borderRadius: 3, padding: '9px 0', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, cursor: neuDann.trim() ? 'pointer' : 'not-allowed' }}
            >Regel speichern</button>
          </div>
        </div>
      )}
    </div>
  )
}
