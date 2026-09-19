import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = await b.newPage()
const fehler = []
t.on('requestfailed', r => fehler.push('FEHLGESCHLAGEN ' + r.url().slice(-60)))
t.on('response', r => { if (r.status() >= 400) fehler.push(r.status() + ' ' + r.url().slice(-60)) })
t.on('console', m => { if (m.type() === 'error') fehler.push('KONSOLE ' + m.text().slice(0, 120)) })
await t.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 })
await t.goto('http://localhost:4322/werkstatt/kalkulation-optimieren', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 1500))
const p = await t.evaluate(() => ({
  hintergrund: getComputedStyle(document.body).backgroundColor,
  stylesheets: document.styleSheets.length,
  bilder: [...document.images].map(i => `${i.currentSrc.split('/').pop()}=${i.naturalWidth > 0 ? 'ok' : 'KAPUTT'}`),
}))
console.log(JSON.stringify(p))
console.log('Fehler:', fehler.length ? fehler.join('\n  ') : 'keine')
await t.screenshot({ path: '.tmp-cu/pruefe2.png', captureBeyondViewport: false })
await b.disconnect()
