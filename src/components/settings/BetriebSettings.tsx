'use client'
import { useEffect, useState } from 'react'
import { akzentTon, ton } from '@/lib/theme'
import { C } from '@/lib/types'
import { BETRIEBSFRAGEN, referenzFuer } from '@/lib/kalibrierung'
import { klemmePreisfaktor, PREISFAKTOR_STANDARD } from '@/lib/preisfaktor'
import { PlanGate } from '@/components/PlanGate'
import ReferenzprojektKasten, { type ReferenzprojektDaten } from '@/components/settings/ReferenzprojektKasten'

// Einstellungen -> Mein Betrieb. Zeigt dieselben Fragen wie die Erst-Anmeldung
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
  // GEFUNDEN 2026-09-15 von Fabian: "Faktoren von Hand übernehmen" wirkte tot. Der
  // Knopf funktionierte, aber sein "Gespeichert." stand weit oben neben dem anderen
  // Speichern-Knopf, und Fehler ganz oben auf der Seite. Jetzt: eigener Zustand,
  // Rueckmeldung direkt daneben, Knopf nur aktiv (und in Akzentfarbe), wenn sich
  // ein Faktor gegenueber dem gespeicherten Stand geaendert hat.
  const [faktorenGeladen, setFaktorenGeladen] = useState<Record<string, number>>({})
  const [faktorenMeldung, setFaktorenMeldung] = useState<{ ok: boolean; text: string } | null>(null)
  const [faktorenSpeichern, setFaktorenSpeichern] = useState(false)
  const [schleife, setSchleife] = useState<{ angebote: number; begruendung: string[] } | null>(null)
  const [schleifeLaeuft, setSchleifeLaeuft] = useState(false)
  // Task R4: die ECHTE Kalkulation des Referenzprojekts, mit SEINEN Saetzen
  // gerechnet — kommt fertig von der Route, hier wird nichts nachgerechnet.
  const [referenzprojekt, setReferenzprojekt] = useState<ReferenzprojektDaten | null>(null)
  // Preisfaktor: eigener Zustand, eigenes Laden, eigener Knopf — dasselbe Muster wie
  // "Faktoren von Hand uebernehmen" (aktiv nur bei Aenderung, Meldung daneben).
  const [preisfaktor, setPreisfaktor] = useState<number>(PREISFAKTOR_STANDARD)
  const [preisfaktorGeladen, setPreisfaktorGeladen] = useState<number>(PREISFAKTOR_STANDARD)
  const [preisfaktorMeldung, setPreisfaktorMeldung] = useState<{ ok: boolean; text: string } | null>(null)
  const [preisfaktorSpeichern, setPreisfaktorSpeichern] = useState(false)

  useEffect(() => { void laden() }, [])

  async function laden() {
    const res = await fetch('/api/settings/kalibrierung')
    if (res.ok) {
      const j = await res.json() as {
        kalibrierung?: Kalibrierung | null
        referenzprojekt?: ReferenzprojektDaten
      }
      if (j.referenzprojekt) setReferenzprojekt(j.referenzprojekt)
      if (j.kalibrierung) {
        setK({ ...LEER, ...j.kalibrierung,
          maschinen: Array.isArray(j.kalibrierung.maschinen) ? j.kalibrierung.maschinen : [],
          schwerpunkt: Array.isArray(j.kalibrierung.schwerpunkt) ? j.kalibrierung.schwerpunkt : [],
          faktor_werkstatt: Number(j.kalibrierung.faktor_werkstatt),
          faktor_oberflaeche: Number(j.kalibrierung.faktor_oberflaeche),
          faktor_massivholz: Number(j.kalibrierung.faktor_massivholz),
          faktor_montage: Number(j.kalibrierung.faktor_montage) })
        setFaktorenGeladen({
          faktor_werkstatt: Number(j.kalibrierung.faktor_werkstatt),
          faktor_oberflaeche: Number(j.kalibrierung.faktor_oberflaeche),
          faktor_massivholz: Number(j.kalibrierung.faktor_massivholz),
          faktor_montage: Number(j.kalibrierung.faktor_montage),
        })
      }
    } else {
      // Der echte Grund gehoert auf den Bildschirm, nicht ins Log.
      const j = await res.json().catch(() => ({})) as { error?: string }
      setFehler(j.error ?? `Laden fehlgeschlagen (${res.status})`)
    }
    // Der Preisfaktor steht im Betriebsprofil, nicht in der Kalibrierung.
    const resP = await fetch('/api/settings/betriebsprofil')
    if (resP.ok) {
      const jp = await resP.json() as { profil?: { preisfaktor?: number | string | null } | null }
      const wert = klemmePreisfaktor(jp.profil?.preisfaktor) ?? PREISFAKTOR_STANDARD
      setPreisfaktor(wert)
      setPreisfaktorGeladen(wert)
    }
    setLaedt(false)
  }

  async function speichern(mitFaktoren = false) {
    setFehler(''); setGespeichert(false); setFaktorenMeldung(null)
    if (mitFaktoren) {
      // Erst pruefen, dann senden — sonst landet eine leere Eingabe als 0 beim Server.
      // Grenzen wie serverseitig (deckeleHand): 0,50 bis 3,00.
      for (const { feld, name } of FAKTOR_TEXTE) {
        const w = Number(k[feld])
        if (!Number.isFinite(w) || w < 0.5 || w > 3) {
          setFaktorenMeldung({ ok: false, text: `${name}: Bitte einen Wert zwischen 0,50 und 3,00 eintragen.` })
          return
        }
      }
      setFaktorenSpeichern(true)
    }
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
    if (mitFaktoren) {
      setFaktorenSpeichern(false)
      if (!res.ok) { setFaktorenMeldung({ ok: false, text: j.error ?? 'Speichern fehlgeschlagen' }); return }
      setFaktorenMeldung({ ok: true, text: 'Gespeichert — die Faktoren gelten ab der nächsten Kalkulation.' })
      await laden()
      return
    }
    if (!res.ok) { setFehler(j.error ?? 'Speichern fehlgeschlagen'); return }
    setGespeichert(true)
    await laden()
  }

  const faktorenGeaendert = FAKTOR_TEXTE.some(({ feld }) =>
    Math.abs(Number(k[feld]) - Number(faktorenGeladen[feld] ?? k[feld])) > 0.0001)

  const preisfaktorGeaendert = Math.abs(Number(preisfaktor) - Number(preisfaktorGeladen)) > 0.0001

  async function speicherePreisfaktor() {
    setPreisfaktorMeldung(null)
    const wert = klemmePreisfaktor(preisfaktor)
    if (wert === null || Number(preisfaktor) < 0.5 || Number(preisfaktor) > 3) {
      setPreisfaktorMeldung({ ok: false, text: 'Bitte einen Wert zwischen 0,50 und 3,00 eintragen.' })
      return
    }
    setPreisfaktorSpeichern(true)
    const res = await fetch('/api/settings/betriebsprofil', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preisfaktor: wert }),
    })
    const j = await res.json().catch(() => ({})) as { error?: string }
    setPreisfaktorSpeichern(false)
    if (!res.ok) { setPreisfaktorMeldung({ ok: false, text: j.error ?? 'Speichern fehlgeschlagen' }); return }
    setPreisfaktor(wert); setPreisfaktorGeladen(wert)
    setPreisfaktorMeldung({ ok: true, text: 'Gespeichert — der Faktor gilt für neue Positionen.' })
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
              <div style={{ color: an ? C.textMid : C.textMid, fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
                {b.hinweis}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )

  const knopf = (aktiv: boolean) => ({
    background: aktiv ? akzentTon('22') : C.gray1,
    border: `1px solid ${aktiv ? C.copper : C.border}`,
    color: aktiv ? C.white : C.white,
    borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer',
    textAlign: 'left' as const,
  })

  const gruppe = (
    titel: string, hinweis: string, werte: Array<{ wert: string; text: string }>,
    aktuell: string, setzen: (w: string) => void, fussnote = '',
  ) => (
    <div style={{ marginBottom: 26 }}>
      <div style={{ color: C.white, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{titel}</div>
      {hinweis && <div style={{ color: C.textMid, fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>{hinweis}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {werte.map(w => (
          <button key={w.wert} onClick={() => setzen(w.wert)} style={knopf(aktuell === w.wert)}>
            {w.text}
          </button>
        ))}
      </div>
      {fussnote && (
        <div style={{ marginTop: 10, background: C.gray1, border: `1px solid ${akzentTon('44')}`,
          borderRadius: 8, padding: '9px 12px', color: C.white, fontSize: 12, lineHeight: 1.55 }}>
          {fussnote}
        </div>
      )}
    </div>
  )

  // Das Referenzmoebel folgt dem Schwerpunkt — sofort, ohne Speichern. Dieselbe
  // Ableitung nutzt die Route beim Rechnen (referenzFuer), sonst wuerde gegen andere
  // Zahlen gerechnet als hier gefragt wurde. Die eigentliche Kalkulation (Positionen,
  // Summen, Faustregel) kommt fertig gerechnet von der Route (referenzprojekt) —
  // ref liefert hier nur noch die Fragen/Baender und die Montage-Dauer.
  const ref = referenzFuer(k.schwerpunkt)

  // "Kalibriert am Einbauschrank" nur zeigen, wenn wirklich KEIN angekreuzter
  // Schwerpunkt eine eigene Referenz hat (referenzFuer faellt dann auf ihn zurueck).
  const eigeneReferenz = ref.schluessel !== 'einbauschrank' || k.schwerpunkt.includes('einbau')

  const schluesselZuFeld: Record<string, keyof Kalibrierung> = {
    grund: 'antwort_grund', lack: 'antwort_lack',
    massiv: 'antwort_massiv', montage: 'antwort_montage',
  }
  const antwort = (frage: string) => String(k[schluesselZuFeld[frage]] ?? '')
  const setzeAntwort = (frage: string, w: string) => setK({ ...k, [schluesselZuFeld[frage]]: w })

  if (laedt) return <div style={{ color: C.textMid, fontSize: 13 }}>Lädt …</div>

  return (
    <div>
      <h2 style={{ color: C.white, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Mein Betrieb</h2>
      <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
        Aus diesen Angaben gelten deine Zeiten statt der CraftFlow-Werte.
        Deine Preise sieht niemand außer dir.
      </p>

      {fehler && (
        <div style={{ background: ton(C.err, '22'), border: `1px solid ${ton(C.err, '55')}`, borderRadius: 8,
          padding: '10px 14px', color: C.err, fontSize: 13, marginBottom: 20 }}>{fehler}</div>
      )}

      <div style={{ marginBottom: 26 }}>
        <div style={{ color: C.white, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Welche Maschinen hast du?</div>
        <div style={{ color: C.textMid, fontSize: 12, marginBottom: 10 }}>Mehrfachauswahl</div>
        {mehrfach('maschinen', k.maschinen, w => setK({ ...k, maschinen: w }))}
        <div style={{ color: C.textMid, fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
          Ohne CNC oder Kantenanleimmaschine schaltet CraftFlow beim Speichern die Kostenstellen „CNC“ bzw. „Bekantung“ ab — und wieder an, sobald du sie hier auswählst.
        </div>
        <div style={{ color: C.textMid, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
          Ohne Lackierkabine bleibt die Kostenstelle „Oberfläche“ trotzdem an — Ölen,
          Wachsen und Schleifen machst du weiter selbst. Lackierte Flächen kalkuliert
          CraftFlow dann als Zukauf-Material, dessen Quadratmeterpreis du selbst einträgst.
        </div>
      </div>

      <div style={{ marginBottom: 26 }}>
        <div style={{ color: C.white, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Was baust du?</div>
        <div style={{ color: C.textMid, fontSize: 12, marginBottom: 10 }}>
          Mehrfachauswahl — wähl alles, was bei dir regelmäßig vorkommt.
        </div>
        {mehrfach('schwerpunkt', k.schwerpunkt, w => setK({ ...k, schwerpunkt: w }))}
      </div>
      {gruppe('Montierst du selbst beim Kunden?', '', liste('montage_selbst'), k.montage_selbst,
        w => setK({ ...k, montage_selbst: w }))}
      {gruppe('Einzelstücke oder auch größere Stückzahlen?',
        'Diese Frage ändert deine Kalkulation nicht — sie hilft uns zu verstehen, wofür CraftFlow gebraucht wird.',
        liste('stueckzahlen'), k.stueckzahlen, w => setK({ ...k, stueckzahlen: w }))}

      <div style={{ height: 1, background: C.border, margin: '30px 0' }} />

      {referenzprojekt && (
        <ReferenzprojektKasten
          daten={referenzprojekt}
          referenzmoebel={ref}
          antwort={antwort}
          setzeAntwort={setzeAntwort}
          gruppe={gruppe}
          eigeneReferenz={eigeneReferenz}
        />
      )}

      <div style={{ color: C.textMid, fontSize: 12, lineHeight: 1.6, marginBottom: 24 }}>
        &bdquo;Weiß ich gerade nicht&ldquo; ist eine gültige Antwort: Dann rechne ich in diesem
        Bereich mit dem CraftFlow-Wert. Du kannst es jederzeit hier nachtragen.
      </div>

      <button onClick={() => void speichern(false)} style={{
        background: C.copper, border: 'none', borderRadius: 8, color: C.onAccent,
        padding: '12px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Speichern und neu berechnen
      </button>
      {gespeichert && <span style={{ color: C.ok, fontSize: 13, marginLeft: 14 }}>Gespeichert.</span>}

      <div style={{ height: 1, background: C.border, margin: '30px 0' }} />

      <div style={{ color: C.white, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Deine Zeitfaktoren</div>
      <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
        Deine Zeiten im Verhältnis zu den CraftFlow-Werten. Du kannst
        jeden Wert von Hand überschreiben (0,50 bis 3,00) — dann gilt deine Zahl statt
        der abgeleiteten. Achtung: Zeitfaktoren verändern auch „Stunden gesamt“. Wenn du
        nur teurer verkaufen willst, nimm den Preisfaktor darunter.
      </p>

      {FAKTOR_TEXTE.map(({ feld, name, was }) => {
        const wert = Number(k[feld])
        return (
          <div key={feld} style={{ display: 'flex', alignItems: 'center', gap: 14,
            background: C.gray1, borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
            <input type="number" step="0.01" min="0.5" max="3" value={Number.isFinite(wert) ? wert : ''}
              onChange={e => { setFaktorenMeldung(null); setK({ ...k, [feld]: e.target.value === '' ? NaN : Number(e.target.value) }) }}
              style={{ width: 80, background: C.gray2, border: `1px solid ${C.border}`,
                borderRadius: 6, color: C.white, padding: '8px 10px', fontSize: 14 }} />
            <div>
              <div style={{ color: C.white, fontSize: 13, fontWeight: 700 }}>{name}</div>
              <div style={{ color: C.textMid, fontSize: 12, lineHeight: 1.5 }}>
                {was} — {erklaere(wert)}
              </div>
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
        <button onClick={() => void speichern(true)} disabled={!faktorenGeaendert || faktorenSpeichern} style={{
          background: faktorenGeaendert ? C.copper : 'transparent',
          border: faktorenGeaendert ? 'none' : `1px solid ${C.border}`, borderRadius: 8,
          color: faktorenGeaendert ? C.onAccent : C.textMid, fontWeight: faktorenGeaendert ? 700 : 400,
          padding: '10px 18px', fontSize: 13, cursor: faktorenGeaendert ? 'pointer' : 'default',
          opacity: faktorenSpeichern ? 0.6 : 1 }}>
          {faktorenSpeichern ? 'Speichert …' : 'Faktoren von Hand übernehmen'}
        </button>
        {faktorenMeldung && (
          <span style={{ fontSize: 13, color: faktorenMeldung.ok ? C.ok : C.err }}>{faktorenMeldung.text}</span>
        )}
        {!faktorenMeldung && !faktorenGeaendert && (
          <span style={{ fontSize: 12, color: C.textMid }}>Ändere einen Wert, dann kannst du ihn hier übernehmen.</span>
        )}
      </div>

      <div style={{ height: 1, background: C.border, margin: '30px 0' }} />

      <div style={{ color: C.white, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Preisfaktor</div>
      <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
        Multipliziert den Preis jeder neuen Position. Stunden und Stundensätze bleiben,
        wie sie sind. 1,00 = CraftFlow-Preis, 1,20 = 20 % teurer.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14,
        background: C.gray1, borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
        <input type="number" step="0.01" min="0.5" max="3"
          value={Number.isFinite(preisfaktor) ? preisfaktor : ''}
          onChange={e => { setPreisfaktorMeldung(null); setPreisfaktor(e.target.value === '' ? NaN : Number(e.target.value)) }}
          style={{ width: 80, background: C.gray2, border: `1px solid ${C.border}`,
            borderRadius: 6, color: C.white, padding: '8px 10px', fontSize: 14 }} />
        <div style={{ color: C.textMid, fontSize: 12, lineHeight: 1.5 }}>
          {Math.abs(Number(preisfaktor) - 1) < 0.005
            ? 'Ich rechne den CraftFlow-Preis.'
            : Number(preisfaktor) > 1
              ? `Ich schlage ${Math.round((Number(preisfaktor) - 1) * 100)} % auf jede neue Position auf.`
              : `Ich gebe ${Math.round((1 - Number(preisfaktor)) * 100)} % auf jede neue Position nach.`}
          <br />Bereits erstellte Angebote bleiben, wie sie sind.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
        <button onClick={() => void speicherePreisfaktor()} disabled={!preisfaktorGeaendert || preisfaktorSpeichern} style={{
          background: preisfaktorGeaendert ? C.copper : 'transparent',
          border: preisfaktorGeaendert ? 'none' : `1px solid ${C.border}`, borderRadius: 8,
          color: preisfaktorGeaendert ? C.onAccent : C.textMid, fontWeight: preisfaktorGeaendert ? 700 : 400,
          padding: '10px 18px', fontSize: 13, cursor: preisfaktorGeaendert ? 'pointer' : 'default',
          opacity: preisfaktorSpeichern ? 0.6 : 1 }}>
          {preisfaktorSpeichern ? 'Speichert …' : 'Preisfaktor übernehmen'}
        </button>
        {preisfaktorMeldung && (
          <span style={{ fontSize: 13, color: preisfaktorMeldung.ok ? C.ok : C.err }}>{preisfaktorMeldung.text}</span>
        )}
        {!preisfaktorMeldung && !preisfaktorGeaendert && (
          <span style={{ fontSize: 12, color: C.textMid }}>Ändere den Wert, dann kannst du ihn hier übernehmen.</span>
        )}
      </div>

      <div style={{ height: 1, background: C.border, margin: '30px 0' }} />

      <PlanGate funktion="lernschleife">
        <div style={{ color: C.white, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          Aus gewonnenen Angeboten lernen
        </div>
        <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
          CraftFlow vergleicht, was es vorgeschlagen hat, mit dem, was in deinen
          gewonnenen Angeboten wirklich stand — und zieht die Faktoren nach. Das ist
          Marktwahrheit, keine Schätzung. Ab drei gewonnenen Angeboten je Bereich.
        </p>

        {schleife && (
          <div style={{ background: C.gray1, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ color: C.textMid, fontSize: 12, marginBottom: schleife.begruendung.length ? 10 : 0 }}>
              {schleife.angebote} gewonnene Angebote ausgewertet.
            </div>
            {schleife.begruendung.length === 0
              ? <div style={{ color: C.textMid, fontSize: 12 }}>Noch zu wenig Material — es ändert sich nichts.</div>
              : schleife.begruendung.map(z => (
                  <div key={z} style={{ color: C.white, fontSize: 12.5, lineHeight: 1.7 }}>{z}</div>
                ))}
          </div>
        )}

        <button disabled={schleifeLaeuft} onClick={() => void schleifeNachsehen()} style={{
          background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8,
          color: C.white, padding: '10px 18px', fontSize: 13,
          cursor: schleifeLaeuft ? 'default' : 'pointer', marginRight: 10 }}>
          {schleifeLaeuft ? 'Rechnet …' : 'Nachsehen, was sich ändern würde'}
        </button>

        {schleife && schleife.begruendung.length > 0 && (
          <button disabled={schleifeLaeuft} onClick={() => void schleifeUebernehmen()} style={{
            background: C.copper, border: 'none', borderRadius: 8, color: C.onAccent,
            padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Übernehmen
          </button>
        )}
      </PlanGate>
    </div>
  )
}
