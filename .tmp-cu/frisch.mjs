import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
// alte Werkstatt-Tabs schliessen, damit kein alter Stand herumsteht
const alt = (await b.pages()).filter(p => p.url().includes('localhost:4322'))
console.log('alte Tabs gefunden:', alt.length)
for (const p of alt) { try { await p.close() } catch {} }
const t = await b.newPage()
await t.goto('http://localhost:4322/werkstatt/kalkulation-optimieren', { waitUntil: 'networkidle2', timeout: 60000 })
await t.bringToFront()
const p = await t.evaluate(() => ({
  hintergrund: getComputedStyle(document.body).backgroundColor,
  bilder: [...document.images].map(i => i.naturalWidth > 0 ? 'ok' : 'KAPUTT'),
}))
console.log('frischer Tab:', JSON.stringify(p))
await b.disconnect()
