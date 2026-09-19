import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = await b.newPage()
await t.setViewport({ width: 1440, height: 1900, deviceScaleFactor: 1 })
await t.goto('http://localhost:4322/werkstatt', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 1500))
const m = await t.evaluate(() => {
  const g = document.querySelector('[class*="gross"]')
  const r = document.querySelector('[class*="raster"]')
  const a = g.getBoundingClientRect(), c = r.getBoundingClientRect()
  return { oben: Math.round(a.top + window.pageYOffset), unten: Math.round(c.top + window.pageYOffset + 340) }
})
console.log(JSON.stringify(m))
await t.screenshot({ path: '.tmp-cu/raster.png', clip: { x: 180, y: m.oben - 20, width: 1090, height: Math.min(1400, m.unten - m.oben + 40) } })
await b.disconnect()
