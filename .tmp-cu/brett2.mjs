import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = await b.newPage()
await t.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 })
await t.goto('http://localhost:4322/werkstatt', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 1500))
const m = await t.evaluate(() => {
  const kopf = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^VORGESCHLAGEN$/i.test((e.textContent||'').trim()))
  let brett = kopf
  for (let i = 0; i < 6; i++) { brett = brett.parentElement; if (brett.children.length === 4) break }
  const r = brett.getBoundingClientRect()
  brett.scrollIntoView({ block: 'center' })
  return { h: Math.round(r.height), w: Math.round(r.width) }
})
await new Promise(r => setTimeout(r, 700))
const k = await t.evaluate(() => {
  const kopf = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^VORGESCHLAGEN$/i.test((e.textContent||'').trim()))
  let brett = kopf
  for (let i = 0; i < 6; i++) { brett = brett.parentElement; if (brett.children.length === 4) break }
  const r = brett.getBoundingClientRect()
  return { x: Math.round(r.x) - 12, y: Math.round(r.y) - 12, width: Math.round(r.width) + 24, height: Math.round(r.height) + 24 }
})
console.log('Bretthöhe:', m.h, 'px')
await t.screenshot({ path: '.tmp-cu/brett.png', clip: k, captureBeyondViewport: false })
await b.disconnect()
