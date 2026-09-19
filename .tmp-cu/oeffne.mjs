import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const seiten = ['bauweise', 'angebot-pdf', 'export-branchensoftware', 'speichern', 'kalkulation-optimieren']
for (const s of seiten) {
  const t = await b.newPage()
  await t.goto(`http://localhost:4322/werkstatt/${s}`, { waitUntil: 'domcontentloaded' })
}
console.log('fünf Seiten geöffnet')
await b.disconnect()
