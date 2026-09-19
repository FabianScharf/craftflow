import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = await b.newPage()
await t.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 2 })
await t.goto('http://localhost:4322/werkstatt', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 1800))
await t.evaluate(() => {
  const a = document.getElementById('naechstes')
  const brett = [...a.querySelectorAll('div')].find(e => e.children.length === 4 && /Vorgeschlagen/i.test(e.textContent || ''))
  brett.id = 'probe-brett'
})
const el = await t.$('#probe-brett')
await el.screenshot({ path: '.tmp-cu/brett.png' })
const h = await t.evaluate(() => Math.round(document.getElementById('probe-brett').getBoundingClientRect().height))
console.log('Bretthöhe:', h, 'px')
await b.disconnect()
