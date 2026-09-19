import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().startsWith('https://app.getcraftflow.de'))
await app.bringToFront()
await app.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 })
const warte = ms => new Promise(r => setTimeout(r, ms))

await app.goto('https://app.getcraftflow.de/settings', { waitUntil: 'networkidle0' })
await warte(3000)
await app.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Warenaufschläge'))?.click())
await warte(3500)
await app.mouse.move(1380, 970)
await warte(600)

// Setzen und SOFORT fotografieren — React soll keine Gelegenheit zum Neuzeichnen haben.
await app.evaluate(() => {
  [...document.querySelectorAll('input')].filter(i => /^\d+$/.test(i.value)).forEach(i => { i.value = '30' })
})
await app.screenshot({ path: '.tmp-cu/b-warenaufschlaege.png', clip: { x: 348, y: 58, width: 992, height: 540 } })

const geblieben = await app.evaluate(() =>
  [...document.querySelectorAll('input')].filter(i => /^\d+$/.test(i.value)).map(i => i.value).join(','))
console.log('Werte im Bild:', geblieben)
await app.reload({ waitUntil: 'networkidle0' })
console.log('neu geladen — nichts gespeichert')
await b.disconnect()
