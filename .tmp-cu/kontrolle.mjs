import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = await b.newPage()
await t.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 })
await t.goto('http://localhost:4322/werkstatt/bauweise', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 1200))
const p = await t.evaluate(() => ({
  hintergrund: getComputedStyle(document.body).backgroundColor,
  bilder: [...document.images].map(i => `${i.currentSrc.split('/').pop()}=${i.naturalWidth > 0 ? 'ok' : 'KAPUTT'}`),
}))
console.log(JSON.stringify(p))
await t.screenshot({ path: '.tmp-cu/kontrolle.png', captureBeyondViewport: false })
await b.disconnect()
