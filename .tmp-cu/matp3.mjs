import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.evaluate(() => window.scrollTo(0, 0))
await new Promise(r => setTimeout(r, 500))
const m = await app.evaluate(() => {
  const kopf = [...document.querySelectorAll('*')].find(x => x.children.length === 0 && /^Materialpreise$/.test((x.textContent||'').trim()) && x.getBoundingClientRect().x > 400)
  const abbr = [...document.querySelectorAll('button')].find(e => /Abbrechen/.test(e.textContent))
  return { oben: Math.round(kopf.getBoundingClientRect().y), unten: Math.round(abbr.getBoundingClientRect().y + abbr.getBoundingClientRect().height) }
})
console.log(JSON.stringify(m))
await app.evaluate(() => { [...document.querySelectorAll('button, div')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.position === 'fixed' && r.width < 120 && r.height < 120 && r.x > 1200 }).forEach(e => (e.dataset.weg='1', e.style.visibility='hidden')) })
await app.screenshot({ path: '.tmp-cu/materialpreise.png', clip: { x: 440, y: m.oben - 14, width: 662, height: (m.unten - m.oben) + 30 }, captureBeyondViewport: false })
await app.evaluate(() => document.querySelectorAll('[data-weg]').forEach(e => (e.style.visibility='', delete e.dataset.weg)))
await b.disconnect()
