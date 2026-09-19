import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.evaluate(() => {
  [...document.querySelectorAll('button, div')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.position === 'fixed' && r.width < 120 && r.height < 120 && r.x > 1200 }).forEach(e => (e.dataset.weg = '1', e.style.visibility = 'hidden'))
})
const mass = await app.evaluate(() => {
  const e = [...document.querySelectorAll('*')].find(x => /KALKULATION GENERIEREN/.test(x.textContent || '') && x.getBoundingClientRect().width > 300 && x.getBoundingClientRect().width < 900)
  const r = e.getBoundingClientRect()
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
})
console.log('Bereich:', JSON.stringify(mass))
await app.screenshot({ path: '.tmp-cu/startseite.png', clip: { x: 438, y: 88, width: 524, height: 700 }, captureBeyondViewport: false })
await app.evaluate(() => document.querySelectorAll('[data-weg]').forEach(e => (e.style.visibility = '', delete e.dataset.weg)))
await b.disconnect()
