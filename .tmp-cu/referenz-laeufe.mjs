// Rechnet jede Referenz (Grundtext + Varianten je Frage) real durch /api/analyze und speichert die Rohantworten.
// KI-KOSTEN: ~0,15 $ je Lauf. Aufruf: node .tmp-cu/referenz-laeufe.mjs [nurSchluessel]
import puppeteer from 'puppeteer-core'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { REFERENZEN } from '../src/lib/kalibrierung.ts'
const nur = process.argv[2]
const AUS = '/tmp/lvtest/referenz-laeufe.json'
const ergebnisse = existsSync(AUS) ? JSON.parse(readFileSync(AUS, 'utf8')) : {}
const KUNDE = 'Kunde: Familie Muster, Musterstraße 12, 63517 Rodenbach.\n\n'
// Varianten als UMGESCHRIEBENER Text (nicht „Abweichung"), sonst legt die KI Alternativpositionen an.
const VARIANTEN = {
  einbauschrank: {
    lack: [['Korpus und Fronten Egger Dekorspanplatte 19 mm weiß, Kanten ABS 1 mm.', 'Korpus Egger Dekorspanplatte 19 mm, alle Fronten und Sichtflächen weiß lackiert seidenmatt (3-Schicht-Aufbau).']],
    massiv: [['Korpus und Fronten Egger Dekorspanplatte 19 mm weiß, Kanten ABS 1 mm.', 'Korpus und Fronten Eiche massiv, geölt.']],
    montage: [['Neubau, gerade Wände.', 'Altbau: Wände nicht im Lot, Dielenboden, zweiter Stock ohne Aufzug.']],
  },
  kueche: {
    lack: [['Fronten weiß matt,', 'Fronten weiß lackiert seidenmatt (3-Schicht-Aufbau),']],
    massiv: [['Fronten weiß matt,', 'Fronten Eiche massiv, geölt,']],
    montage: [['Neubau.', 'Altbau: Wände nicht im Lot, alte Leitungen, kein Aufzug.']],
  },
  tueren: {
    lack: [['weiß beschichtet,', 'von uns weiß lackiert seidenmatt (3-Schicht-Aufbau),']],
    massiv: [['weiß beschichtet,', 'Eiche massiv, geölt,']],
  },
  treppen: {
    lack: [['Buche massiv,', 'Buche massiv, weiß lackiert seidenmatt statt geölt,']],
    montage: [['Einbau und Anpassung vor Ort.', 'Einbau und Anpassung vor Ort im Altbau: schiefe Wände, Podest anpassen, enges Treppenhaus.']],
  },
  solitaer: {
    lack: [['geölt,', 'weiß lackiert seidenmatt,']],
    montage: [['Lieferung, keine Montage vor Ort.', 'Lieferung in den zweiten Stock ohne Aufzug, Gestell vor Ort montiert.']],
  },
}
const laeufe = []
for (const [key, r] of Object.entries(REFERENZEN)) {
  if (nur && key !== nur) continue
  laeufe.push({ key, frage: 'grund', text: KUNDE + r.text })
  for (const [f, ersetzungen] of Object.entries(VARIANTEN[key] || {})) {
    let t = r.text
    for (const [a, b] of ersetzungen) { if (!t.includes(a)) { console.log('WARNUNG: Ersetzung nicht gefunden', key, f, a); } t = t.replace(a, b) }
    laeufe.push({ key, frage: f, text: KUNDE + t })
  }
}
console.log('Läufe:', laeufe.length)
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 400000 })
for (const l of laeufe) {
  const id = `${l.key}:${l.frage}`
  if (ergebnisse[id]?.ok) { console.log('übersprungen (vorhanden):', id); continue }
  const t0 = Date.now()
  let page = await browser.newPage() // je Lauf eine eigene Seite — die geteilte Seite wurde zwischendurch navigiert (Fabian testet parallel)
  await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 2500))
  const r = await page.evaluate(async (text) => {
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
    const j = await res.json().catch(() => ({}))
    return { status: res.status, success: j.success, error: j.error, data: j.data }
  }, l.text).catch(e => ({ status: 0, success: false, error: 'Puppeteer: ' + e.message }))
  const sek = Math.round((Date.now() - t0) / 1000)
  await page.close().catch(() => {})
  const pos = r.data?.positionen || []
  ergebnisse[id] = { ok: r.status === 200 && r.success, status: r.status, error: r.error, sekunden: sek, text: l.text, fragen: r.data?.fragen, positionen: pos, kunde: r.data?.kunde }
  writeFileSync(AUS, JSON.stringify(ergebnisse, null, 1))
  console.log(id, r.status, sek + 's', 'Positionen:', pos.length, r.error ? 'FEHLER ' + String(r.error).slice(0, 80) : '', r.data?.fragen ? 'RÜCKFRAGEN' : '')
}
browser.disconnect()
