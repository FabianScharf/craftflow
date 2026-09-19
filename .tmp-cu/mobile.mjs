import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const page = await browser.newPage()
const sleep = ms => new Promise(r => setTimeout(r, ms))
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.goto('http://localhost:3457/willkommen', { waitUntil: 'domcontentloaded', timeout: 120000 }); await sleep(3000)
await page.screenshot({ path: '/tmp/cfshots/mob-hero.png' })
for (const id of ['einrichtung', 'beschreiben', 'optimierung', 'praxis']) {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView(), id); await sleep(1500)
  await page.screenshot({ path: `/tmp/cfshots/mob-${id}.png` })
}
console.log('Mobile horizontaler Überlauf:', await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth ? document.documentElement.scrollWidth : 'nein'))
await page.close(); browser.disconnect()
