'use client'
import { useEffect, useState } from 'react'
import { C } from '@/lib/types'
import { BAENDER } from '@/lib/kalibrierung'

// Einstellungen -> Mein Betrieb. Zeigt dieselben neun Fragen wie die Erst-Anmeldung
// und die vier daraus abgeleiteten Faktoren in Klartext.
//
// Warum die Faktoren sichtbar sind: Wer nicht sieht, womit gerechnet wird, kann es
// auch nicht korrigieren. Genau daran ist die alte Loesung gescheitert — CraftFlow
// erklaerte den Nutzern, wo die Stellschrauben liegen, und sie rechneten trotzdem
// mit Kammerwerten.

type Kalibrierung = {
  mitarbeiter: string
  maschinen: string[]
  schwerpunkt: string
  montage_selbst: string
  stueckzahlen: string
  antwort_grund: string
  antwort_lack: string
  antwort_massiv: string
  antwort_montage: string
  faktor_werkstatt: number
  faktor_oberflaeche: number
  faktor_massivholz: number
  faktor_montage: number
  abgeschlossen: boolean
  hinweis_gezeigt: boolean
}

const LEER: Kalibrierung = {
  mitarbeiter: '', maschinen: [], schwerpunkt: '', montage_selbst: '', stueckzahlen: '',
  antwort_grund: '', antwort_lack: '', antwort_massiv: '', antwort_montage: '',
  faktor_werkstatt: 1, faktor_oberflaeche: 1, faktor_massivholz: 1, faktor_montage: 1,
  abgeschlossen: false, hinweis_gezeigt: false,
}

export const MITARBEITER = [
  { wert: 'solo',  text: 'nur ich' },
  { wert: '2-3',   text: '2 bis 3' },
  { wert: '4-10',  text: '4 bis 10' },
  { wert: 'mehr',  text: 'mehr' },
]
export const MASCHINEN = [
  { wert: 'formatsaege',  text: 'Formatkreissäge' },
  { wert: 'kantenanleim', text: 'Kantenanleimmaschine' },
  { wert: 'cnc',          text: 'CNC' },
  { wert: 'lackierkabine', text: 'Lackierkabine' },
  { wert: 'keine',        text: 'keine davon' },
]
export const SCHWERPUNKT = [
  { wert: 'moebel',      text: 'Möbel nach Maß' },
  { wert: 'innenausbau', text: 'Innenausbau und Einbauschränke' },
  { wert: 'kuechen',     text: 'Küchen' },
  { wert: 'tueren',      text: 'Türen und Böden' },
  { wert: 'gemischt',    text: 'gemischt' },
]
export const MONTAGE_SELBST = [
  { wert: 'immer',     text: 'immer' },
  { wert: 'manchmal',  text: 'manchmal' },
  { wert: 'nie',       text: 'nie' },
]
export const STUECKZAHLEN = [
  { wert: 'einzel',   text: 'fast nur Einzelstücke' },
  { wert: 'gemischt', text: 'gemischt' },
  { wert: 'serien',   text: 'oft Serien' },
]

const FAKTOR_TEXTE: Array<{ feld: keyof Kalibrierung; name: string; was: string }> = [
  { feld: 'faktor_werkstatt',   name: 'Werkstatt',  was: 'Zuschnitt, Bekantung, CNC, Zusammenbau' },
  { feld: 'faktor_oberflaeche', name: 'Oberfläche', was: 'Lackieren, Ölen, Schleifen' },
  { feld: 'faktor_massivholz',  name: 'Massivholz', was: 'Zuschlag bei Massivholzmöbeln' },
  { feld: 'faktor_montage',     name: 'Montage',    was: 'Montage vor Ort und Lieferung' },
]

function erklaere(f: number): string {
  if (Math.abs(f - 1) < 0.005) return 'noch nicht kalibriert — ich rechne mit dem Branchenwert.'
  const p = Math.round(Math.abs(1 - f) * 100)
  return f < 1
    ? `ich rechne diese Zeiten ${p} % knapper als den Branchenrichtwert.`
    : `ich rechne diese Zeiten ${p} % großzügiger als den Branchenrichtwert.`
}

export default function BetriebSettings() {
  const [k, setK] = useState<Kalibrierung>(LEER)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [gespeichert, setGespeichert] = useState(false)

  useEffect(() => { void laden() }, [])

  async function laden() {
    const res = await fetch('/api/settings/kalibrierung')
    if (res.ok) {
      const j = await res.json() as { kalibrierung?: Kalibrierung | null }
      if (j.kalibrierung) {
        setK({ ...LEER, ...j.kalibrierung,
          maschinen: Array.isArray(j.kalibrierung.maschinen) ? j.kalibrierung.maschinen : [],
          faktor_werkstatt: Number(j.kalibrierung.faktor_werkstatt),
          faktor_oberflaeche: Number(j.kalibrierung.faktor_oberflaeche),
          faktor_massivholz: Number(j.kalibrierung.faktor_massivholz),
          faktor_montage: Number(j.kalibrierung.faktor_montage) })
      }
    } else {
      // Der echte Grund gehoert auf den Bildschirm, nicht ins Log.
      const j = await res.json().catch(() => ({})) as { error?: string }
      setFehler(j.error ?? `Laden fehlgeschlagen (${res.status})`)
    }
    setLaedt(false)
  }

  async function speichern(mitFaktoren = false) {
    setFehler(''); setGespeichert(false)
    const koerper: Record<string, unknown> = { ...k }
    // Ohne "mitFaktoren" rechnet der Server die Faktoren neu aus den Antworten.
    // Mit "mitFaktoren" gilt, was von Hand dasteht.
    if (!mitFaktoren) {
      delete koerper.faktor_werkstatt; delete koerper.faktor_oberflaeche
      delete koerper.faktor_massivholz; delete koerper.faktor_montage
    }
    const res = await fetch('/api/settings/kalibrierung', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(koerper),
    })
    const j = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) { setFehler(j.error ?? 'Speichern fehlgeschlagen'); return }
    setGespeichert(true)
    await laden()
  }

  const knopf = (aktiv: boolean) => ({
    background: aktiv ? '#2A2018' : '#1C1C1C',
    border: `1px solid ${aktiv ? C.copper : '#2E2E2E'}`,
    color: aktiv ? C.white : '#B0B0B0',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer',
    textAlign: 'left' as const,
  })

  const gruppe = (
    titel: string, hinweis: string, werte: Array<{ wert: string; text: string }>,
    aktuell: string, setzen: (w: string) => void,
  ) => (
    <div style={{ marginBottom: 26 }}>
      <div style={{ color: C.white, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{titel}</div>
      {hinweis && <div style={{ color: '#7A7A7A', fontSize: 12, marginBottom: 10 }}>{hinweis}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {werte.map(w => (
          <button key={w.wert} onClick={() => setzen(w.wert)} style={knopf(aktuell === w.wert)}>
            {w.text}
          </button>
        ))}
      </div>
    </div>
  )

  if (laedt) return <div style={{ color: '#7A7A7A', fontSize: 13 }}>Lädt …</div>

  return (
    <div>
      <h2 style={{ color: C.white, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Mein Betrieb</h2>
      <p style={{ color: '#8A8A8A', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
        Aus diesen Angaben rechnet CraftFlow mit deinen Zeiten statt mit Branchenwerten.
        Deine Preise sieht niemand außer dir.
      </p>

      {fehler && (
        <div style={{ background: '#3A1A1A', border: '1px solid #6A2A2A', borderRadius: 8,
          padding: '10px 14px', color: '#FFB0B0', fontSize: 13, marginBottom: 20 }}>{fehler}</div>
      )}

      {gruppe('Wie viele arbeiten in der Werkstatt mit?', '', MITARBEITER, k.mitarbeiter,
        w => setK({ ...k, mitarbeiter: w }))}

      <div style={{ marginBottom: 26 }}>
        <div style={{ color: C.white, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Welche Maschinen hast du?</div>
        <div style={{ color: '#7A7A7A', fontSize: 12, marginBottom: 10 }}>Mehrfachauswahl</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MASCHINEN.map(m => {
            const an = k.maschinen.includes(m.wert)
            return (
              <button key={m.wert} style={knopf(an)} onClick={() => setK({ ...k,
                maschinen: an ? k.maschinen.filter(x => x !== m.wert) : [...k.maschinen, m.wert] })}>
                {m.text}
              </button>
            )
          })}
        </div>
      </div>

      {gruppe('Was baust du hauptsächlich?', '', SCHWERPUNKT, k.schwerpunkt,
        w => setK({ ...k, schwerpunkt: w }))}
      {gruppe('Montierst du selbst beim Kunden?', '', MONTAGE_SELBST, k.montage_selbst,
        w => setK({ ...k, montage_selbst: w }))}
      {gruppe('Einzelstücke oder auch größere Stückzahlen?',
        'Diese Frage ändert deine Kalkulation nicht — sie hilft uns zu verstehen, wofür CraftFlow gebraucht wird.',
        STUECKZAHLEN, k.stueckzahlen, w => setK({ ...k, stueckzahlen: w }))}

      <div style={{ height: 1, background: '#2E2E2E', margin: '30px 0' }} />

      <div style={{ background: '#1C1C1C', borderRadius: 8, padding: 16, marginBottom: 22 }}>
        <div style={{ color: C.white, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Das Referenzmöbel</div>
        <div style={{ color: '#B0B0B0', fontSize: 13, lineHeight: 1.7 }}>
          <b>Einbauschrank Flur</b>, 2,00 m breit × 2,40 m hoch × 0,60 m tief.<br />
          Korpus und Fronten <b>Egger Dekorspanplatte 19 mm weiß</b>, Kanten ABS 1 mm.<br />
          <b>4 Drehtüren</b> mit Topfscharnieren, <b>2 Schubkästen</b> auf Systemauszügen,
          Kleiderstange, je Fach 2 Einlegeböden, Sockel 100 mm, Rückwand.<br />
          <b>Lieferung und Montage</b> beim Kunden, 20 km entfernt, Neubau, gerade Wände.
        </div>
        <div style={{ color: '#7A7A7A', fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
          Genau diese fünf Dinge braucht CraftFlow immer: Möbelart, Maße, Material,
          Ausstattung, Montage.
        </div>
      </div>

      {gruppe('Was nimmst du für so einen Schrank, netto?', '',
        BAENDER.grund.map(b => ({ wert: b.schluessel, text: b.text })),
        k.antwort_grund, w => setK({ ...k, antwort_grund: w }))}

      {gruppe('Derselbe Schrank, aber alles weiß lackiert seidenmatt statt Dekor. Was kommt dazu?', '',
        BAENDER.lack.map(b => ({ wert: b.schluessel, text: b.text })),
        k.antwort_lack, w => setK({ ...k, antwort_lack: w }))}

      {gruppe('Derselbe Schrank in Eiche massiv, geölt. Was nimmst du?', '',
        BAENDER.massiv.map(b => ({ wert: b.schluessel, text: b.text })),
        k.antwort_massiv, w => setK({ ...k, antwort_massiv: w }))}

      {gruppe('Derselbe Schrank im Altbau: Wände nicht im Lot, Dielenboden, zweiter Stock ohne Aufzug. Wie lange bist du dran?',
        '', BAENDER.montage.map(b => ({ wert: b.schluessel, text: b.text })),
        k.antwort_montage, w => setK({ ...k, antwort_montage: w }))}

      <div style={{ color: '#7A7A7A', fontSize: 12, lineHeight: 1.6, marginBottom: 24 }}>
        &bdquo;Weiß ich gerade nicht&ldquo; ist eine gültige Antwort: Dann rechne ich in diesem
        Bereich mit dem Branchenwert. Du kannst es jederzeit hier nachtragen.
      </div>

      <button onClick={() => void speichern(false)} style={{
        background: C.copper, border: 'none', borderRadius: 8, color: '#0D0D0D',
        padding: '12px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Speichern und neu berechnen
      </button>
      {gespeichert && <span style={{ color: '#7ACC7A', fontSize: 13, marginLeft: 14 }}>Gespeichert.</span>}

      <div style={{ height: 1, background: '#2E2E2E', margin: '30px 0' }} />

      <div style={{ color: C.white, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Deine Zeitfaktoren</div>
      <p style={{ color: '#8A8A8A', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
        So rechnet CraftFlow deine Zeiten gegenüber dem Branchenrichtwert. Du kannst
        jeden Wert von Hand überschreiben — dann gilt deine Zahl statt der abgeleiteten.
      </p>

      {FAKTOR_TEXTE.map(({ feld, name, was }) => {
        const wert = Number(k[feld])
        return (
          <div key={feld} style={{ display: 'flex', alignItems: 'center', gap: 14,
            background: '#1C1C1C', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
            <input type="number" step="0.01" min="0.6" max="1.4" value={wert}
              onChange={e => setK({ ...k, [feld]: Number(e.target.value) })}
              style={{ width: 80, background: '#141414', border: '1px solid #2E2E2E',
                borderRadius: 6, color: C.white, padding: '8px 10px', fontSize: 14 }} />
            <div>
              <div style={{ color: C.white, fontSize: 13, fontWeight: 700 }}>{name}</div>
              <div style={{ color: '#7A7A7A', fontSize: 12, lineHeight: 1.5 }}>
                {was} — {erklaere(wert)}
              </div>
            </div>
          </div>
        )
      })}

      <button onClick={() => void speichern(true)} style={{
        background: 'transparent', border: '1px solid #3A3A3A', borderRadius: 8,
        color: '#B0B0B0', padding: '10px 18px', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
        Faktoren von Hand übernehmen
      </button>
    </div>
  )
}
