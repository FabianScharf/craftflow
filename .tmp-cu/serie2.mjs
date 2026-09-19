import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const schuss = async (datei, x, y, w, h) => {
  await app.screenshot({ path: `.tmp-cu/${datei}`, clip: { x, y, width: Math.min(1400 - x, w), height: Math.min(1000 - y, h) } })
  console.log('->', datei)
}
await schuss('s-material.png', 340, 583, 720, 232)
// zur Arbeitszeit scrollen
await app.evaluate(() => window.scrollBy(0, 560))
await new Promise(r => setTimeout(r, 600))
const t = await app.evaluate(() => {
  const e = [...document.querySelectorAll('*')].find(x => x.children.length === 0 && /^ARBEITSZEIT$/.test((x.textContent||'').trim()))
  const r = e ? e.getBoundingClientRect() : null
  return r ? { y: Math.round(r.y) } : null
})
console.log('Arbeitszeit bei y =', JSON.stringify(t))
await app.screenshot({ path: '.tmp-cu/s-seite-gescrollt.png' })
await b.disconnect()
