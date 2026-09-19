import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /DOKUMENT ALS PDF/i.test(e.textContent)); if (k) k.click() })
await new Promise(r => setTimeout(r, 3000))
await app.screenshot({ path: '.tmp-cu/pdf-ansicht.png' })
console.log('ok')
await b.disconnect()
