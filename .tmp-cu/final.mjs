import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const page = await browser.newPage()
const sleep = ms => new Promise(r => setTimeout(r, ms))
await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 })
await page.goto('http://localhost:3457/willkommen', { waitUntil: 'domcontentloaded', timeout: 120000 }); await sleep(2500)
await page.screenshot({ path: '/tmp/cfshots/web-hero.png' })
for (const id of ['ergebnis', 'check', 'praxis']) { await page.evaluate((id) => document.getElementById(id).scrollIntoView(), id); await sleep(1800); await page.screenshot({ path: `/tmp/cfshots/web-${id}.png` }) }
console.log('Kapitel-Leiste Breite/Scroll:', await page.evaluate(() => { const el = document.querySelector('[class*="chaptersInner"]'); return el.scrollWidth + ' / ' + el.clientWidth }))
await page.close(); browser.disconnect()
