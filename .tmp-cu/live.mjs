import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 900 })
await page.goto('https://www.getcraftflow.de/willkommen#optimierung', { waitUntil: 'networkidle2', timeout: 90000 })
await new Promise(r => setTimeout(r, 2500))
console.log('Bilder geladen:', await page.evaluate(() => [...document.images].filter(i => i.complete && i.naturalWidth > 0).length), '/', await page.evaluate(() => document.images.length))
await page.screenshot({ path: '/tmp/cfshots/live-optimierung.png' })
await page.close(); browser.disconnect()
