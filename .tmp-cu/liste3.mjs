import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.screenshot({ path: '.tmp-cu/projektliste.png', clip: { x: 340, y: 20, width: 720, height: 188 }, captureBeyondViewport: false })
console.log('ok')
await b.disconnect()
