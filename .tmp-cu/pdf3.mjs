import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const t = await app.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400))
console.log(t)
const r = await app.evaluate(() => ({ iframes: [...document.querySelectorAll('iframe, embed, object')].map(e => (e.src || '').slice(0, 80)) }))
console.log(JSON.stringify(r))
await b.disconnect()
