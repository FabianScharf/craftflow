import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
// Export-Menue schliessen
await app.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => e.textContent.includes('Export')); if (k) k.click() })
await new Promise(r => setTimeout(r, 600))

const schuss = async (datei, x, y, w, h) => {
  const cx = Math.max(0, x), cy = Math.max(0, y)
  await app.screenshot({ path: `.tmp-cu/${datei}`, clip: { x: cx, y: cy, width: Math.min(1400 - cx, w), height: Math.min(1000 - cy, h) } })
  console.log('->', datei)
}
// Werkzeugleiste: Anfragen / Export / Kopieren
await schuss('s-werkzeugleiste.png', 330, 110, 740, 55)
// Kennzahlenblock
await schuss('s-kennzahlen.png', 330, 255, 740, 110)
// Positionskopf mit Pfeilen
await schuss('s-positionskopf.png', 340, 385, 720, 60)
await b.disconnect()
