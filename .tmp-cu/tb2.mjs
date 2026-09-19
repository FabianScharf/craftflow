import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
await t.evaluate(() => { [...document.querySelectorAll('button, div')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.position === 'fixed' && r.width < 120 && r.height < 120 && r.x > 1200 }).forEach(e => (e.dataset.weg='1', e.style.visibility='hidden')) })
await t.evaluate(() => window.scrollTo(0, 0))
await new Promise(r => setTimeout(r, 600))
const m = await t.evaluate(() => {
  const kopf = [...document.querySelectorAll('h2')].find(e => /Textbausteine/.test(e.textContent))
  const ende = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /Fristen und Prozents/.test(e.textContent || ''))
  const a = kopf.getBoundingClientRect(), z = ende.getBoundingClientRect()
  return { oben: Math.round(a.y), unten: Math.round(z.bottom), x: Math.round(a.x) }
})
console.log(JSON.stringify(m))
await t.screenshot({ path: '.tmp-cu/textbausteine.png', clip: { x: m.x - 14, y: m.oben - 14, width: 680, height: Math.min(1360, m.unten - m.oben + 32) }, captureBeyondViewport: false })
await t.evaluate(() => document.querySelectorAll('[data-weg]').forEach(e => (e.style.visibility='', delete e.dataset.weg)))
await b.disconnect()
