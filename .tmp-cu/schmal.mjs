import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
for (const breite of [1440, 1100, 950, 880, 800, 420]) {
  const t = await b.newPage()
  await t.setViewport({ width: breite, height: 1200, deviceScaleFactor: 1 })
  await t.goto('http://localhost:4322/werkstatt', { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 900))
  const m = await t.evaluate(() => {
    const g = document.querySelector('[class*="gross"]')
    const r = document.querySelector('[class*="raster"]')
    const rk = e => { const b = e.getBoundingClientRect(); return `${Math.round(b.x)}–${Math.round(b.right)}` }
    return {
      motiv: rk(g.firstElementChild), text: rk(g.children[1]),
      k1: rk(r.children[0]), k2: r.children[1] ? rk(r.children[1]) : '-',
      ueberlauf: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
  console.log(breite + 'px:', JSON.stringify(m))
  await t.close()
}
await b.disconnect()
