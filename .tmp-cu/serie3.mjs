import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const pos = await app.evaluate(() => {
  const finde = (re) => [...document.querySelectorAll('*')].filter(x => x.children.length === 0 && re.test((x.textContent||'').trim())).map(x => { const r = x.getBoundingClientRect(); return { t: x.textContent.trim().slice(0,24), x: Math.round(r.x), y: Math.round(r.y) } })
  return { arbeit: finde(/^ARBEITSZEIT/), ges: finde(/POSITIONSGESAMT/), scroll: Math.round(scrollY) }
})
console.log(JSON.stringify(pos))
await b.disconnect()
