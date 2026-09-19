import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
// schwebende Hilfe kurz ausblenden
const versteckt = await app.evaluate(() => {
  const kandidaten = [...document.querySelectorAll('button, div')].filter(e => {
    const s = getComputedStyle(e)
    if (s.position !== 'fixed') return false
    const r = e.getBoundingClientRect()
    return r.width < 120 && r.height < 120 && r.x > 1200 && r.y > 800
  })
  kandidaten.forEach(e => (e.dataset.weg = '1', e.style.visibility = 'hidden'))
  return kandidaten.length
})
console.log('ausgeblendet:', versteckt)
await app.screenshot({ path: '.tmp-cu/w-optimieren-oben.png', clip: { x: 1052, y: 94, width: 348, height: 400 } })
await app.screenshot({ path: '.tmp-cu/w-optimieren-eingabe.png', clip: { x: 1052, y: 790, width: 348, height: 205 } })
await app.evaluate(() => document.querySelectorAll('[data-weg]').forEach(e => (e.style.visibility = '', delete e.dataset.weg)))
console.log('fertig, Hilfe wieder sichtbar')
await b.disconnect()
