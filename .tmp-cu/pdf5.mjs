import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.evaluate(() => {
  [...document.querySelectorAll('button, div')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.position === 'fixed' && r.width < 120 && r.height < 120 && r.x > 1200 && r.y > 400 }).forEach(e => (e.dataset.weg = '1', e.style.visibility = 'hidden'))
})
await app.screenshot({ path: '.tmp-cu/pdf-angebot.png', clip: { x: 452, y: 120, width: 796, height: 878 } })
await app.screenshot({ path: '.tmp-cu/pdf-briefkopf.png', clip: { x: 452, y: 160, width: 796, height: 300 } })
await app.evaluate(() => document.querySelectorAll('[data-weg]').forEach(e => (e.style.visibility = '', delete e.dataset.weg)))
console.log('ok')
await b.disconnect()
