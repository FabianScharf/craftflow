'use client'
import { useEffect, useState } from 'react'
import { C } from '@/lib/types'
import { BETRIEBSFRAGEN, referenzFuer, referenzPreis, RANDHINWEIS, RANDBAENDER } from '@/lib/kalibrierung'

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
  schwerpunkt: string[]
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
  mitarbeiter: '', maschinen: [], schwerpunkt: [], montage_selbst: '', stueckzahlen: '',
  antwort_grund: '', antwort_lack: '', antwort_massiv: '', antwort_montage: '',
  faktor_werkstatt: 1, faktor_oberflaeche: 1, faktor_massivholz: 1, faktor_montage: 1,
  abgeschlossen: false, hinweis_gezeigt: false,
}

const FAKTOR_TEXTE: Array<{ feld: keyof Kalibrierung; name: string; was: string }> = [
  { feld: 'faktor_werkstatt',   name: 'Werkstatt',  was: 'Zuschnitt, Bekantung, CNC, Zusammenbau' },
  { feld: 'faktor_oberflaeche', name: 'Oberfläche', was: 'Lackieren, Ölen, Schleifen' },
  { feld: 'faktor_massivholz',  name: 'Massivholz', was: 'Zuschlag bei Massivholzmöbeln' },
  { feld: 'faktor_montage',     name: 'Montage',    was: 'Montage vor Ort und Lieferung' },
]

function erklaere(f: number): string {
  if (Math.abs(f - 1) < 0.005) return 'noch nicht kalibriert — ich rechne mit den CraftFlow-Werten.'
  const p = Math.round(Math.abs(1 - f) * 100)
  return f < 1
    ? `ich rechne diese Zeiten ${p} % knapper als die CraftFlow-Werte.`
    : `ich rechne diese Zeiten ${p} % großzügiger als die CraftFlow-Werte.`
}

export default function BetriebSettings() {
  const [k, setK] = useState<Kalibrierung>(LEER)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [gespeichert, setGespeichert] = useState(false)
  const [schleife, setSchleife] = useState<{ angebote: number; begruendung: string[] } | null>(null)
  const [schleifeLaeuft, setSchleifeLaeuft] = useState(false)
  // SEINE Stundensaetze und SEIN Materialaufschlag — daraus rechnet die Oberflaeche
  // den Ankerpreis, mit DEMSELBEN ref wie der Text darueber.
  const [saetze, setSaetze] = useState<Record<string, number> | null>(null)
  const [aufschlag, setAufschlag] = useState(0.30)

  useEffect(() => { void laden() }, [])

  async function laden() {
    const res = await fetch('/api/settings/kalibrierung')
    if (res.ok) {
      const j = await res.json() as {
        kalibrierung?: Kalibrierung | null
        saetze?: Record<string, number>
        aufschlag?: number
      }
      if (j.saetze) setSaetze(j.saetze)
      if (typeof j.aufschlag === 'number') setAufschlag(j.aufschlag)
      if (j.kalibrierung) {
        setK({ ...LEER, ...j.kalibrierung,
          maschinen: Array.isArray(j.kalibrierung.maschinen) ? j.kalibrierung.maschinen : [],
          schwerpunkt: Array.isArray(j.kalibrierung.schwerpunkt) ? j.kalibrierung.schwerpunkt : [],
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

  async function schleifeNachsehen() {
    setSchleifeLaeuft(true); setFehler('')
    const res = await fetch('/api/lernschleife')
    const j = await res.json().catch(() => ({})) as { angebote?: number; begruendung?: string[]; error?: string }
    if (!res.ok) setFehler(j.error ?? 'Auswertung fehlgeschlagen')
    else setSchleife({ angebote: j.angebote ?? 0, begruendung: j.begruendung ?? [] })
    setSchleifeLaeuft(false)
  }

  async function schleifeUebernehmen() {
    setSchleifeLaeuft(true); setFehler('')
    const res = await fetch('/api/lernschleife', { method: 'POST' })
    const j = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) setFehler(j.error ?? 'Übernehmen fehlgeschlagen')
    else { setSchleife(null); await laden() }
    setSchleifeLaeuft(false)
  }

  const liste = (frage: string) =>
    (BETRIEBSFRAGEN[frage] ?? []).map(b => ({ wert: b.schluessel, text: b.text }))

  // Mehrfachauswahl mit Erlaeuterung je Eintrag. Ohne den Zusatz war unklar, was
  // wohin gehoert — "Möbel nach Maß" gegen "Einbauschränke" war keine Trennung.
  const mehrfach = (frage: string, gewaehlt: string[], setzen: (w: string[]) => void) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {(BETRIEBSFRAGEN[frage] ?? []).map(b => {
        const an = gewaehlt.includes(b.schluessel)
        return (
          <button key={b.schluessel} style={{ ...knopf(an), maxWidth: 260 }}
            onClick={() => setzen(an ? gewaehlt.filter(x => x !== b.schluessel) : [...gewaehlt, b.schluessel])}>
            <div style={{ fontWeight: 600 }}>{b.text}</div>
            {b.hinweis && (
              <div style={{ color: an ? '#9A8A7A' : '#6A6A6A', fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
                {b.hinweis}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )

  const knopf = (aktiv: boolean) => ({
    background: aktiv ? '#2A2018' : '#1C1C1C',
    border: `1px solid ${aktiv ? C.copper : '#2E2E2E'}`,
    color: aktiv ? C.white : '#B0B0B0',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer',
    textAlign: 'left' as const,
  })

  const gruppe = (
    titel: string, hinweis: string, werte: Array<{ wert: string; text: string }>,
    aktuell: string, setzen: (w: string) => void, fussnote = '',
  ) => (
    <div style={{ marginBottom: 26 }}>
      <div style={{ color: C.white, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{titel}</div>
      {hinweis && <div style={{ color: '#7A7A7A', fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>{hinweis}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {werte.map(w => (
          <button key={w.wert} onClick={() => setzen(w.wert)} style={knopf(aktuell === w.wert)}>
            {w.text}
          </button>
        ))}
      </div>
      {fussnote && (
        <div style={{ marginTop: 10, background: '#1F1B16', border: '1px solid #3A2E22',
          borderRadius: 8, padding: '9px 12px', color: '#C0AE9A', fontSize: 12, lineHeight: 1.55 }}>
          {fussnote}
        </div>
      )}
    </div>
  )

  // Das Referenzmoebel folgt dem Schwerpunkt — sofort, ohne Speichern. Dieselbe
  // Ableitung nutzt die Route beim Rechnen (referenzFuer), sonst wuerde gegen andere
  // Zahlen gerechnet als hier gefragt wurde.
  const ref = referenzFuer(k.schwerpunkt)

  // Der Ankerpreis kommt aus DEMSELBEN ref wie der Text — deshalb kann er nicht mehr
  // zu einem anderen Moebel gehoeren. Bei Fragen ohne Material ist es der reine
  // Arbeitspreis, bei Referenzen mit Teiler der Wert je Stueck.
  const anker = (() => {
    if (!saetze) return null
    const p = referenzPreis(saetze, aufschlag, ref)
    const ohneMaterial = (ref.ohneMaterial ?? []).includes('grund')
    const teiler = ref.teiler?.grund ?? 1
    return {
      preis: Math.round((ohneMaterial ? p.gesamt - p.material : p.gesamt) / teiler),
      ohneMaterial, teiler,
    }
  })()

  const schluesselZuFeld: Record<string, keyof Kalibrierung> = {
    grund: 'antwort_grund', lack: 'antwort_lack',
    massiv: 'antwort_massiv', montage: 'antwort_montage',
  }
  const antwort = (frage: string) => String(k[schluesselZuFeld[frage]] ?? '')
  const setzeAntwort = (frage: string, w: string) => setK({ ...k, [schluesselZuFeld[frage]]: w })

  if (laedt) return <div style={{ color: '#7A7A7A', fontSize: 13 }}>Lädt …</div>

  return (
    <div>
      <h2 style={{ color: C.white, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Mein Betrieb</h2>
      <p style={{ color: '#8A8A8A', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
        Aus diesen Angaben gelten deine Zeiten statt der CraftFlow-Werte.
        Deine Preise sieht niemand außer dir.
      </p>

      {fehler && (
        <div style={{ background: '#3A1A1A', border: '1px solid #6A2A2A', borderRadius: 8,
          padding: '10px 14px', color: '#FFB0B0', fontSize: 13, marginBottom: 20 }}>{fehler}</div>
      )}

      <div style={{ marginBottom: 26 }}>
        <div style={{ color: C.white, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Welche Maschinen hast du?</div>
        <div style={{ color: '#7A7A7A', fontSize: 12, marginBottom: 10 }}>Mehrfachauswahl</div>
        {mehrfach('maschinen', k.maschinen, w => setK({ ...k, maschinen: w }))}
      </div>

      <div style={{ marginBottom: 26 }}>
        <div style={{ color: C.white, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Was baust du?</div>
        <div style={{ color: '#7A7A7A', fontSize: 12, marginBottom: 10 }}>
          Mehrfachauswahl — wähl alles, was bei dir regelmäßig vorkommt.
        </div>
        {mehrfach('schwerpunkt', k.schwerpunkt, w => setK({ ...k, schwerpunkt: w }))}
      </div>
      {gruppe('Montierst du selbst beim Kunden?', '', liste('montage_selbst'), k.montage_selbst,
        w => setK({ ...k, montage_selbst: w }))}
      {gruppe('Einzelstücke oder auch größere Stückzahlen?',
        'Diese Frage ändert deine Kalkulation nicht — sie hilft uns zu verstehen, wofür CraftFlow gebraucht wird.',
        liste('stueckzahlen'), k.stueckzahlen, w => setK({ ...k, stueckzahlen: w }))}

      <div style={{ height: 1, background: '#2E2E2E', margin: '30px 0' }} />

      <div style={{ background: '#1C1C1C', borderRadius: 8, padding: 16, marginBottom: 22 }}>
        <div style={{ color: C.white, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          Das Referenzmöbel: {ref.name}
        </div>
        <div style={{ color: '#B0B0B0', fontSize: 13, lineHeight: 1.7 }}>{ref.text}</div>
        <div style={{ color: '#7A7A7A', fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
          Es richtet sich nach dem, was du oben angekreuzt hast. Genau diese fünf Dinge
          braucht CraftFlow immer: Möbelart, Maße, Material, Ausstattung, Montage.
        </div>
        {anker && (
          <div style={{ color: '#8A8A8A', fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
            Mit deinen Stundensätzen rechnet CraftFlow dafür zurzeit{' '}
            <b style={{ color: C.copper }}>{anker.preis.toLocaleString('de-DE')} €</b>
            {anker.teiler > 1 ? ' je Stück' : ''}
            {anker.ohneMaterial ? ' für die Arbeit, ohne Material' : ' netto'}.
            Weicht deine Zahl stark ab, passt CraftFlow die Zeiten an.
          </div>
        )}
      </div>

      {ref.fragenliste.map(f => (
        <div key={f.schluessel}>
          {gruppe(f.text, f.hinweis, f.baender.map(b => ({ wert: b.schluessel, text: b.text })),
            antwort(f.schluessel), w => setzeAntwort(f.schluessel, w),
            RANDBAENDER.includes(antwort(f.schluessel)) ? RANDHINWEIS : '')}
        </div>
      ))}

      <div style={{ color: '#7A7A7A', fontSize: 12, lineHeight: 1.6, marginBottom: 24 }}>
        &bdquo;Weiß ich gerade nicht&ldquo; ist eine gültige Antwort: Dann rechne ich in diesem
        Bereich mit dem CraftFlow-Wert. Du kannst es jederzeit hier nachtragen.
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
        Deine Zeiten im Verhältnis zu den CraftFlow-Werten. Du kannst
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

      <div style={{ height: 1, background: '#2E2E2E', margin: '30px 0' }} />

      <div style={{ color: C.white, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
        Aus gewonnenen Angeboten lernen
      </div>
      <p style={{ color: '#8A8A8A', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
        CraftFlow vergleicht, was es vorgeschlagen hat, mit dem, was in deinen
        gewonnenen Angeboten wirklich stand — und zieht die Faktoren nach. Das ist
        Marktwahrheit, keine Schätzung. Ab drei gewonnenen Angeboten je Bereich.
      </p>

      {schleife && (
        <div style={{ background: '#1C1C1C', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ color: '#8A8A8A', fontSize: 12, marginBottom: schleife.begruendung.length ? 10 : 0 }}>
            {schleife.angebote} gewonnene Angebote ausgewertet.
          </div>
          {schleife.begruendung.length === 0
            ? <div style={{ color: '#7A7A7A', fontSize: 12 }}>Noch zu wenig Material — es ändert sich nichts.</div>
            : schleife.begruendung.map(z => (
                <div key={z} style={{ color: '#C0C0C0', fontSize: 12.5, lineHeight: 1.7 }}>{z}</div>
              ))}
        </div>
      )}

      <button disabled={schleifeLaeuft} onClick={() => void schleifeNachsehen()} style={{
        background: 'transparent', border: '1px solid #3A3A3A', borderRadius: 8,
        color: '#B0B0B0', padding: '10px 18px', fontSize: 13,
        cursor: schleifeLaeuft ? 'default' : 'pointer', marginRight: 10 }}>
        {schleifeLaeuft ? 'Rechnet …' : 'Nachsehen, was sich ändern würde'}
      </button>

      {schleife && schleife.begruendung.length > 0 && (
        <button disabled={schleifeLaeuft} onClick={() => void schleifeUebernehmen()} style={{
          background: C.copper, border: 'none', borderRadius: 8, color: '#0D0D0D',
          padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Übernehmen
        </button>
      )}
    </div>
  )
}
