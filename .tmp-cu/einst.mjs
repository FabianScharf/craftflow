import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === '⚙️'); if (k) k.click() })
await new Promise(r => setTimeout(r, 2500))
const t = await app.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 900))
console.log(t)
await b.disconnect()
