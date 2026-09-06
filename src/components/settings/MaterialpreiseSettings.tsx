'use client'
import { useEffect, useState } from 'react'
import { C } from '@/lib/types'
import { istVeraltet, VERALTET_NACH_TAGEN } from '@/lib/materialpreise'

type Preis = {
  id: string
  bezeichnung: string
  ek: number
  einheit: string
  lieferant: string
  stand: string
  aktiv: boolean
}

const EINHEITEN = ['Stk', 'm2', 'lfdm', 'm3', 'kg', 'pauschal']

function heute(): string {
  return new Date().toISOString().slice(0, 10)
}

function alsDatum(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE')
}

export default function MaterialpreiseSettings() {
  const [preise, setPreise] = useState<Preis[]>([])
  const [laedt, setLaedt] = useState(true)
  const [neuOffen, setNeuOffen] = useState(false)
  const [neuBezeichnung, setNeuBezeichnung] = useState('')
  const [neuEk, setNeuEk] = useState('')
  const [neuEinheit, setNeuEinheit] = useState(EINHEITEN[0])
  const [fehler, setFehler] = useState('')

  useEffect(() => { void laden() }, [])

  async function laden() {
    const res = await fetch('/api/settings/materialpreise')
    if (res.ok) {
      const json = await res.json() as { preise?: Preis[] }
      setPreise((json.preise ?? []).map(p => ({ ...p, ek: Number(p.ek) })))
    } else {
      // Der echte Grund gehört auf den Bildschirm. "Konnte nicht geladen
      // werden" ohne Ursache hat am 05.09. zwanzig Minuten gekostet.
      const j = await res.json().catch(() => ({})) as { error?: string }
      setFehler(j.error ?? `Laden fehlgeschlagen (${res.status})`)
    }
    setLaedt(false)
  }

  async function anlegen() {
    setFehler('')
    const res = await fetch('/api/settings/materialpreise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bezeichnung: neuBezeichnung, ek: neuEk, einheit: neuEinheit }),
    })
    const j = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) { setFehler(j.error ?? 'Speichern fehlgeschlagen'); return }
    setNeuBezeichnung(''); setNeuEk(''); setNeuEinheit(EINHEITEN[0]); setNeuOffen(false)
    await laden()
  }

  async function aendern(id: string, patch: Partial<Preis>) {
    setFehler('')
    const res = await fetch('/api/settings/materialpreise', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { error?: string }
      setFehler(j.error ?? 'Ändern fehlgeschlagen'); return
    }
    await laden()
  }

  async function loeschen(id: string) {
    setFehler('')
    const res = await fetch('/api/settings/materialpreise', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { error?: string }
      setFehler(j.error ?? 'Löschen fehlgeschlagen'); return
    }
    await laden()
  }

  const heuteStr = heute()
  const veraltete = preise.filter(p => p.aktiv && istVeraltet(p.stand, heuteStr)).length

  const feld: React.CSSProperties = {
    background: C.black, color: C.white, border: `1px solid ${C.border}`,
    borderRadius: 3, padding: '8px 10px', fontSize: 12,
    fontFamily: 'Helvetica Neue,sans-serif',
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: C.white }}>Materialpreise</h2>
      <div style={{ fontSize: 12, color: C.textMid, marginBottom: 16, lineHeight: 1.6 }}>
        Fixierte Einkaufspreise. Trifft eine Materialbezeichnung zu, rechnet CraftFlow mit
        genau diesem Preis statt zu schätzen. Der Aufschlag bleibt davon unberührt — der
        kommt weiterhin aus den Warenaufschlägen.
      </div>

      {veraltete > 0 && (
        <div style={{ background: '#3a2a1a', border: '1px solid #6a4a2a', borderRadius: 3, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#E0A860' }}>
          {veraltete === 1
            ? '1 Preis ist älter als ein Jahr.'
            : `${veraltete} Preise sind älter als ein Jahr.`}
          {' '}Prüf sie kurz — ein veralteter Einkaufspreis verfälscht jede Kalkulation, in die er einfließt.
        </div>
      )}

      {fehler && (
        <div style={{ background: '#3a1a1a', border: '1px solid #6a3a3a', borderRadius: 3, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#E08080' }}>
          {fehler}
        </div>
      )}

      {laedt && <div style={{ fontSize: 12, color: C.textMid }}>Lädt…</div>}

      {!laedt && preise.length === 0 && (
        <div style={{ fontSize: 12, color: C.textMid, marginBottom: 16, lineHeight: 1.6 }}>
          Noch keine Preise hinterlegt. Sag im Optimieren-Chat einfach, was ein Material bei
          dir kostet — CraftFlow fragt dann, ob es sich den Preis merken soll. Oder leg hier
          selbst einen an.
        </div>
      )}

      {preise.map(p => {
        const alt = istVeraltet(p.stand, heuteStr)
        return (
          <div key={p.id} style={{
            border: `1px solid ${alt ? '#6a4a2a' : C.border}`, borderRadius: 3,
            padding: 12, marginBottom: 8, opacity: p.aktiv ? 1 : 0.5,
            display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
          }}>
            <input
              defaultValue={p.bezeichnung}
              onBlur={e => { if (e.target.value !== p.bezeichnung) void aendern(p.id, { bezeichnung: e.target.value }) }}
              style={{ ...feld, flex: '2 1 220px' }}
            />
            <input
              defaultValue={String(p.ek)}
              onBlur={e => { if (e.target.value !== String(p.ek)) void aendern(p.id, { ek: e.target.value as unknown as number }) }}
              style={{ ...feld, width: 90, textAlign: 'right' }}
            />
            <select
              defaultValue={p.einheit}
              onChange={e => void aendern(p.id, { einheit: e.target.value })}
              style={{ ...feld, width: 100 }}
            >
              {EINHEITEN.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <div style={{ fontSize: 11, color: alt ? '#E0A860' : C.textMid, minWidth: 130 }}>
              Stand {alsDatum(p.stand)}
              {alt && ` — über ${Math.round(VERALTET_NACH_TAGEN / 365)} Jahr alt`}
            </div>
            <button
              onClick={() => void aendern(p.id, { aktiv: !p.aktiv })}
              style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              {p.aktiv ? 'Aus' : 'An'}
            </button>
            <button
              onClick={() => void loeschen(p.id)}
              title="Löschen"
              style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )
      })}

      {!neuOffen && (
        <button
          onClick={() => setNeuOffen(true)}
          style={{ background: 'transparent', color: C.copper, border: 'none', padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}
        >
          + Preis selbst anlegen
        </button>
      )}

      {neuOffen && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 3, padding: 12, marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="z. B. Blum Movento Softclose-Auszug"
            value={neuBezeichnung}
            onChange={e => setNeuBezeichnung(e.target.value)}
            style={{ ...feld, flex: '2 1 220px' }}
          />
          <input
            placeholder="26,27"
            value={neuEk}
            onChange={e => setNeuEk(e.target.value)}
            style={{ ...feld, width: 90, textAlign: 'right' }}
          />
          <select value={neuEinheit} onChange={e => setNeuEinheit(e.target.value)} style={{ ...feld, width: 100 }}>
            {EINHEITEN.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <button
            onClick={() => void anlegen()}
            disabled={!neuBezeichnung.trim() || !neuEk.trim()}
            style={{ background: neuBezeichnung.trim() && neuEk.trim() ? C.copper : C.gray2, color: neuBezeichnung.trim() && neuEk.trim() ? C.black : C.textMid, border: 'none', borderRadius: 3, padding: '9px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
          >
            Anlegen
          </button>
          <button
            onClick={() => { setNeuOffen(false); setFehler('') }}
            style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '9px 14px', fontSize: 12, cursor: 'pointer' }}
          >
            Abbrechen
          </button>
        </div>
      )}
    </div>
  )
}
