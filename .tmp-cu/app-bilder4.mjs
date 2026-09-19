import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().startsWith('https://app.getcraftflow.de'))
await app.bringToFront()
await app.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 })
const warte = ms => new Promise(r => setTimeout(r, ms))
const klick = t => app.evaluate(x => {
  const el = [...document.querySelectorAll('button, a')].find(e => e.textContent?.includes(x))
  if (el) { el.click(); return true } return false
}, t)

/** Wartet, bis der Inhaltsbereich nicht mehr „Lädt" zeigt. */
async function fertig(max = 15) {
  for (let i = 0; i < max; i++) {
    const laedt = await app.evaluate(() => document.body.innerText.includes('Lädt'))
    if (!laedt) return true
    await warte(700)
  }
  return false
}

await app.goto('https://app.getcraftflow.de/settings', { waitUntil: 'networkidle0' })
await warte(3000)

// x=348 beginnt rechts der Navigationsleiste, damit sie nicht angeschnitten wird.
const AUS = { x: 348, y: 58, width: 992, height: 580 }

for (const [nav, datei] of [
  ['Meine Bauweise', 'b-bauweise.png'],
  ['Textbausteine', 'b-textbausteine.png'],
  ['Lieferanten', 'b-lieferanten.png'],
  ['Buchhaltung', 'b-buchhaltung.png'],
]) {
  await klick(nav)
  await warte(1500)
  const ok = await fertig()
  await app.mouse.move(1380, 970)
  await warte(500)
  await app.screenshot({ path: '.tmp-cu/' + datei, clip: AUS })
  console.log(ok ? '✓' : '⚠ (lud noch)', datei)
}
await b.disconnect()
