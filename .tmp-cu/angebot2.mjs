import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
// schwebende Hilfe ausblenden
await app.evaluate(() => {
  [...document.querySelectorAll('button, div')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.position === 'fixed' && r.width < 120 && r.height < 120 && r.x > 1200 && r.y > 800 }).forEach(e => (e.dataset.weg = '1', e.style.visibility = 'hidden'))
})
const schuss = async (d, x, y, w, h) => { await app.screenshot({ path: `.tmp-cu/${d}`, clip: { x, y, width: Math.min(1400-x, w), height: Math.min(1000-y, h) } }); console.log('->', d) }
await schuss('a-textbausteine.png', 335, 335, 730, 95)
await schuss('a-leistungsuebersicht.png', 335, 583, 730, 215)
await schuss('a-speichern.png', 335, 875, 730, 120)
await schuss('a-empfaenger.png', 335, 222, 730, 100)
await app.evaluate(() => document.querySelectorAll('[data-weg]').forEach(e => (e.style.visibility = '', delete e.dataset.weg)))
await b.disconnect()
