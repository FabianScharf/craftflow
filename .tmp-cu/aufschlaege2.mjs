import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().startsWith('https://app.getcraftflow.de'))
await app.bringToFront()
const warte = ms => new Promise(r => setTimeout(r, ms))

await app.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 })
await warte(600)
const breite = await app.evaluate(() => window.innerWidth)
console.log('Fensterbreite:', breite)
if (breite < 1000) { console.log('zu schmal — abgebrochen'); await b.disconnect(); process.exit(1) }

await app.goto('https://app.getcraftflow.de/settings', { waitUntil: 'networkidle0' })
await warte(3000)
await app.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Warenaufschläge'))?.click())
await warte(3500)

const da = await app.evaluate(() => document.body.innerText.includes('Aufschlag auf den Materialeinkaufspreis'))
console.log('Bereich offen:', da)

const anzahl = await app.evaluate(() => {
  const felder = [...document.querySelectorAll('input')].filter(i => /^\d+$/.test(i.value))
  felder.forEach(i => { i.value = '30' })   // nur Anzeige, kein Ereignis, kein Speichern
  return felder.length
})
console.log('Werte in der Anzeige auf 30 gesetzt:', anzahl)
await app.mouse.move(1380, 970)
await warte(400)
await app.screenshot({ path: '.tmp-cu/b-warenaufschlaege.png', clip: { x: 348, y: 58, width: 992, height: 540 } })
console.log('✓ Bild')
await app.reload({ waitUntil: 'networkidle0' })
console.log('neu geladen — nichts gespeichert')
await b.disconnect()
