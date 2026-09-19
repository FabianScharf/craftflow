import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = await b.newPage()
await t.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 })
await t.goto('http://localhost:4322/werkstatt#naechstes', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 1500))
const m = await t.evaluate(() => {
  const brett = [...document.querySelectorAll('div')].find(e => /VORGESCHLAGEN/.test(e.textContent || '') && e.children.length === 4)
  const r = brett.getBoundingClientRect()
  return { x: Math.round(r.x) - 12, y: Math.round(r.y + window.pageYOffset) - 12, width: Math.round(r.width) + 24, height: Math.round(r.height) + 24 }
})
console.log('Bretthöhe:', m.height, 'px')
await t.screenshot({ path: '.tmp-cu/brett.png', clip: m })
await b.disconnect()
