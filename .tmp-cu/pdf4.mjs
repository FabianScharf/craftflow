import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await new Promise(r => setTimeout(r, 1500))
await app.screenshot({ path: '.tmp-cu/pdf-vorschau.png' })
console.log('ok')
await b.disconnect()
