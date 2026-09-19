import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = await b.newPage()
await t.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 })
await t.goto('http://localhost:4322/werkstatt', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 1500))
const kanten = await t.evaluate(() => {
  const gross = document.querySelector('[class*="gross"]')
  const raster = document.querySelector('[class*="raster"]')
  const motiv = gross ? gross.firstElementChild : null
  const karten = raster ? [...raster.children] : []
  const r = e => { const b = e.getBoundingClientRect(); return { links: Math.round(b.x), rechts: Math.round(b.right), breit: Math.round(b.width) } }
  return {
    motivOben: motiv ? r(motiv) : null,
    textOben: gross && gross.children[1] ? r(gross.children[1]) : null,
    karteLinks: karten[0] ? r(karten[0]) : null,
    karteRechts: karten[1] ? r(karten[1]) : null,
  }
})
console.log(JSON.stringify(kanten, null, 1))
await t.screenshot({ path: '.tmp-cu/raster.png', captureBeyondViewport: false })
await b.disconnect()
