import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.evaluate(() => {
  [...document.querySelectorAll('button, div')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.position === 'fixed' && r.width < 120 && r.height < 120 && r.x > 1200 }).forEach(e => (e.dataset.weg = '1', e.style.visibility = 'hidden'))
})
await app.screenshot({ path: '.tmp-cu/speicherleiste.png', clip: { x: 330, y: 938, width: 740, height: 62 }, captureBeyondViewport: false })
await app.evaluate(() => document.querySelectorAll('[data-weg]').forEach(e => (e.style.visibility = '', delete e.dataset.weg)))
console.log('ok')
await b.disconnect()
