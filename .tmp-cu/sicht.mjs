import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
for (const s of ['textbausteine', 'stueckzahl', 'alternativpositionen', 'positionen-gruppieren', 'positionen-sortieren']) {
  const t = await b.newPage()
  await t.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 })
  await t.goto(`http://localhost:4322/werkstatt/${s}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 800))
  const d = await t.evaluate(() => ({
    titel: document.querySelector('h1')?.textContent,
    bilder: [...document.images].map(i => `${i.currentSrc.split('/').pop()}=${i.naturalWidth > 0 ? 'ok' : 'KAPUTT'}`),
  }))
  console.log(`${s}: "${d.titel}" — ${d.bilder.join(', ')}`)
  if (s === 'textbausteine') await t.screenshot({ path: '.tmp-cu/seite-tb.png', captureBeyondViewport: false })
  if (s === 'stueckzahl') await t.screenshot({ path: '.tmp-cu/seite-stk.png', captureBeyondViewport: false })
  await t.close()
}
await b.disconnect()
