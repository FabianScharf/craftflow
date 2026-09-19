import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await new Promise(r => setTimeout(r, 800))
await app.screenshot({ path: '.tmp-cu/pdf-briefkopf.png', clip: { x: 452, y: 150, width: 796, height: 320 }, captureBeyondViewport: false })
console.log('ok')
await b.disconnect()
