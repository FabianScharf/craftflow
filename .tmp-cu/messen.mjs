import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const seiten = await b.pages()
for (const p of seiten) console.log('TAB:', p.url().slice(0, 110))
const app = seiten.find(p => p.url().includes('vercel.app'))
if (!app) { console.log('keine App-Seite'); await b.disconnect(); process.exit(0) }
await app.bringToFront()
const vp = await app.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio, url: location.href }))
console.log('VIEWPORT:', JSON.stringify(vp))
await b.disconnect()
