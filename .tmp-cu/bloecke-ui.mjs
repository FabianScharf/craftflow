// Live-Test Teil C im Browser: Upload über die Kacheln, Blockweg, Abbrechen ODER voller Durchlauf. KI-KOSTEN!
// Aufruf: node .tmp-cu/bloecke-ui.mjs <abbrechen|voll>
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const modus = process.argv[2]
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 900000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const B = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
const blockAnfragen = []; const laufzeiten = []
page.on('request', req => { if (req.url().includes('/api/analyze/block')) blockAnfragen.push({ t: Date.now(), body: req.postData()?.slice(0, 80) }) })
page.on('response', async res => { if (res.url().includes('/api/analyze/block')) { const a = blockAnfragen[laufzeiten.length]; laufzeiten.push({ status: res.status(), sekunden: a ? Math.round((Date.now() - a.t) / 1000) : null }) } })
await page.goto(B + '/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(5000)
const text = () => page.evaluate(() => document.body.innerText)
const out = { modus }
// 1) Dateien über die versteckten Inputs (Kacheln) hochladen
const inputs = await page.$$('input[type=file]')
const pdfInput = (await Promise.all(inputs.map(async i => [(await (await i.getProperty('accept')).jsonValue()), i]))).find(([a]) => a.includes('pdf'))?.[1]
const fotoInput = (await Promise.all(inputs.map(async i => [(await (await i.getProperty('accept')).jsonValue()), i]))).find(([a]) => a.includes('image'))?.[1]
if (!pdfInput || !fotoInput) { console.log('Inputs nicht gefunden'); process.exit(1) }
await pdfInput.uploadFile('/tmp/lvtest/leistungsverzeichnis.pdf')
await fotoInput.uploadFile(...[1, 2, 3, 4, 5, 6, 7, 8].map(i => `/tmp/lvtest/foto-${i}.png`))
// warten bis alle Kacheln fertig (Fehler-Liste leer, Blockknopf klickbar)
let t = ''
for (let i = 0; i < 90; i++) { await sleep(1000); t = await text(); if (t.includes('Großes Projekt in Blöcken kalkulieren')) break }
await sleep(2000)
out.uploadFehler = (await text()).includes('nicht hochgeladen') || (await text()).includes('Fehlgeschlagen')
await page.screenshot({ path: '/tmp/cfshots/bloecke-1-uploads.png' })
await page.evaluate(() => { const ta = document.querySelector('textarea'); if (ta) { const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; s.call(ta, 'Bitte alle Positionen des Leistungsverzeichnisses kalkulieren. Kunde: Beispiel Bau GmbH, Musterstraße 12, 63450 Hanau.'); ta.dispatchEvent(new Event('input', { bubbles: true })) } })
// 2) Blockweg starten
const t0 = Date.now()
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.includes('Großes Projekt in Blöcken kalkulieren')); b && b.click() })
// Fortschritt beobachten
const gesehen = new Set(); let abgebrochen = false; let ende = false
for (let i = 0; i < 900; i++) {
  await sleep(1000); t = await text()
  const m = t.match(/Block (\d+) von (\d+)/); if (m) gesehen.add(m[0])
  const pm = t.match(/(\d+) Position/); if (pm) out.letztePositionenAnzeige = pm[0]
  if (m && !abgebrochen && i === 12) await page.screenshot({ path: '/tmp/cfshots/bloecke-2-laeuft.png' })
  if (modus === 'abbrechen' && laufzeiten.length >= 1 && !abgebrochen) {
    await sleep(3000) // Block 2 soll bereits laufen, damit der Abbruch den laufenden fetch trifft
    abgebrochen = true
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.startsWith('Abbrechen')); b && b.click() })
    out.abbruchNachSekunden = Math.round((Date.now() - t0) / 1000)
    await sleep(4000); out.nachAbbruchText = (await text()).slice(0, 200).replace(/\n/g, ' | '); out.nachAbbruchAufKalkulation = !(await text()).includes('Großes Projekt in Blöcken kalkulieren'); break
  }
  if (t.includes('mögliche Doppelungen') || (/GESAMT|Gesamtsumme|PREISFAKTOR/i.test(t) && !t.includes('Großes Projekt in Blöcken kalkulieren')) || t.includes('Vorbereiten fehlgeschlagen') || /Block \d+: /.test(t)) { ende = true; break }
  if (i % 30 === 0) console.log('… ' + i + 's, Blöcke bisher: ' + laufzeiten.length + ' ' + (m ? m[0] : ''))
}
await sleep(3000); t = await text()
out.gesamtSekunden = Math.round((Date.now() - t0) / 1000)
out.fortschrittGesehen = [...gesehen]
out.blockAnfragen = blockAnfragen.length; out.laufzeiten = laufzeiten
out.doppelungenKasten = t.includes('mögliche Doppelungen') ? t.slice(t.indexOf('Bitte nachsehen'), t.indexOf('Bitte nachsehen') + 400) : null
out.fehlertext = (t.match(/Block \d+: [^\n]{0,160}/) || [null])[0]
out.aufKalkulation = /PREISFAKTOR|Gesamt/i.test(t) && !t.includes('Großes Projekt in Blöcken kalkulieren')
await page.screenshot({ path: `/tmp/cfshots/bloecke-3-${modus}-ende.png`, fullPage: true })
// Positionen aus der Seite zählen (Titelzeilen mit laufender Nummer) und Usage
out.positionenImText = (t.match(/^\s*\d{1,3}\s*$/gm) || []).length
out.usage = await page.evaluate(async () => { const u = await fetch('/api/usage', { cache: 'no-store' }); const j = await u.json().catch(() => ({})); return { count: j.count, limit: j.limit, plan: j.plan } })
out.kunde = (t.match(/Beispiel Bau GmbH[^\n]*/) || [null])[0]
await page.evaluate(() => { const b = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 1 && /^Positionen$/.test((e.innerText || '').trim())); b && b.click() }); await sleep(2500); t = (await text()) + '\n' + t; await page.screenshot({ path: `/tmp/cfshots/bloecke-4-${modus}-positionen.png`, fullPage: true })
const titel = ['Einbauschrank Flur','Einbauschrank Schlafzimmer','Ankleide','LED-Beleuchtung','Küchenzeile','Hängeschränke','Arbeitsplatte','Nischenrückwand','Hochschrank','Apothekerauszug','Griffe','Innentür Röhrenspan','Innentür Vollspan','Schiebetür','Türdrücker','Akustikpaneele','Deckenverkleidung','Fußleisten','Treppe','Holzgeländer','Handlauf','Waschtischunterschrank','Spiegelschrank','Sideboard','Schreibtisch','Regalwand','Garderobenbank','Fensterbank','Reparatur','Anfahrt']
out.titelGefunden = titel.filter(x => t.includes(x)).length + ' von ' + titel.length; out.titelFehlend = titel.filter(x => !t.includes(x))
out.nullStunden = (t.match(/\b0(?:,0)? h\b/g) || []).length
fs.writeFileSync(`/tmp/cfshots/bloecke-${modus}.json`, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1))
await page.close(); browser.disconnect()
