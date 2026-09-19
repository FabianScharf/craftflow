import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const t = await app.evaluate(() => { const h = document.body.innerText.replace(/\s+/g, ' '); const i = h.indexOf('Abmelden'); return h.slice(i + 9, i + 1400) })
console.log(t)
await b.disconnect()
