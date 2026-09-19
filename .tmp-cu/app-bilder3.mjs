import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().startsWith('https://app.getcraftflow.de'))
await app.bringToFront()
await app.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 })
const warte = ms => new Promise(r => setTimeout(r, ms))
const klick = async (t) => app.evaluate(x => {
  const el = [...document.querySelectorAll('button, a')].find(e => e.textContent?.includes(x))
  if (el) { el.click(); return true } return false
}, t)

await app.goto('https://app.getcraftflow.de/settings', { waitUntil: 'networkidle0' })
await warte(3000)

/* Fester Ausschnitt des Inhaltsbereichs: links die Navigation weg (sie zeigt unten
   die E-Mail und den Admin-Eintrag), oben ab der Überschrift. */
const AUSSCHNITT = { x: 330, y: 55, width: 1010, height: 600 }

for (const [nav, datei] of [
  ['Meine Bauweise', 'b-bauweise.png'],
  ['Buchhaltung', 'b-buchhaltung.png'],
  ['Textbausteine', 'b-textbausteine.png'],
  ['Lieferanten', 'b-lieferanten.png'],
  ['Warenaufschläge', 'b-warenaufschlaege.png'],
]) {
  await klick(nav)
  await warte(2600)
  await app.mouse.move(1370, 960)
  await warte(300)
  await app.screenshot({ path: '.tmp-cu/' + datei, clip: AUSSCHNITT })
  console.log('✓', datei)
}
await b.disconnect()
