import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const page = await browser.newPage()
const sleep = ms => new Promise(r => setTimeout(r, ms))
await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 })
await page.goto('http://localhost:3457/willkommen', { waitUntil: 'networkidle0', timeout: 60000 })
await sleep(1500)
const h = await page.evaluate(() => document.body.scrollHeight)
console.log('Desktop Seitenhöhe:', h)
// Bilder alle geladen?
const imgs = await page.evaluate(() => [...document.images].map(i => ({ src: i.currentSrc.split('?')[0].slice(-40), ok: i.complete && i.naturalWidth > 0, w: i.clientWidth, h: i.clientHeight })))
console.log('Bilder:', imgs.length, 'kaputt:', imgs.filter(i => !i.ok).length)
// Abschnittsweise Screenshots (Viewport-Höhe) fuer die Sichtpruefung
const secs = ['prinzip','einrichtung','beschreiben','ergebnis','optimierung','check','angebot','praxis','faq']
await page.screenshot({ path: '/tmp/cfshots/web-hero.png' })
for (const id of secs) {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView(), id); await sleep(500)
  await page.screenshot({ path: `/tmp/cfshots/web-${id}.png` })
}
await page.screenshot({ path: '/tmp/cfshots/web-full.png', fullPage: true })
// Mobile
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.reload({ waitUntil: 'networkidle0' }); await sleep(1000)
await page.screenshot({ path: '/tmp/cfshots/mob-hero.png' })
await page.evaluate(() => document.getElementById('optimierung').scrollIntoView()); await sleep(500)
await page.screenshot({ path: '/tmp/cfshots/mob-optimierung.png' })
await page.evaluate(() => document.getElementById('beschreiben').scrollIntoView()); await sleep(500)
await page.screenshot({ path: '/tmp/cfshots/mob-beschreiben.png' })
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth ? document.documentElement.scrollWidth : 0)
console.log('Mobile horizontaler Überlauf:', overflow || 'nein')
await page.close()
browser.disconnect()
