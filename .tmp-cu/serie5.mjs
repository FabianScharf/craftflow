import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.screenshot({ path: '.tmp-cu/s-arbeitszeit.png', clip: { x: 340, y: 818, width: 720, height: 182 } })
console.log('ok')
await b.disconnect()
