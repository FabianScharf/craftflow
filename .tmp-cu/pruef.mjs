import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const f = await app.evaluate(() => [...document.querySelectorAll('input')].map(e => ({ typ: e.type, gefuellt: !!(e.value && e.value.trim()), laenge: (e.value||'').length })))
console.log('Buchhaltung-Felder:', JSON.stringify(f))
await b.disconnect()
