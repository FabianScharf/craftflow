import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
// Ausschnitte aus dem bereits offenen Bildschirm.
await app.screenshot({ path: '.tmp-cu/w-export-menue.png', clip: { x: 1140, y: 160, width: 240, height: 440 } })
await app.screenshot({ path: '.tmp-cu/w-chat.png', clip: { x: 1516, y: 150, width: 490, height: 560 } })
console.log('zwei Ausschnitte')
await b.disconnect()
