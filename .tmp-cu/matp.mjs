import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.evaluate(() => { const k = [...document.querySelectorAll('button, a, div')].filter(e => e.textContent.trim().endsWith('Materialpreise') && e.textContent.trim().length < 26 && e.getBoundingClientRect().x < 300); if (k.length) k[k.length-1].click() })
await new Promise(r => setTimeout(r, 2500))
const t = await app.evaluate(() => { const h = document.body.innerText.replace(/\s+/g,' '); const i = h.indexOf('Abmelden'); return h.slice(i+9, i+900) })
console.log(t)
await b.disconnect()
