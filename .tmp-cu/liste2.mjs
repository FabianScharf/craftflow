import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const m = await app.evaluate(() => {
  const finde = (re) => { const e = [...document.querySelectorAll('*')].find(x => re.test((x.textContent||'').trim()) && x.getBoundingClientRect().height > 0); const r = e?.getBoundingClientRect(); return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null }
  return {
    filter: finde(/^Alle/),
    testprojekt: finde(/^Beispielkunde \(Testprojekt\)/),
    zweite: finde(/^Max Mustermann/),
  }
})
console.log(JSON.stringify(m, null, 1))
await b.disconnect()
