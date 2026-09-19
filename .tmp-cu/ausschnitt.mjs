import puppeteer from 'puppeteer-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 })
await p.goto('http://localhost:4321/werkstatt', { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 800))
// Nur den Bereich mit den vier kleinen Kacheln fotografieren.
const el = await p.$('section#neu')
const box = await el.boundingBox()
await p.screenshot({
  path: '.tmp-cu/kacheln.png',
  clip: { x: box.x, y: box.y + 700, width: box.width, height: 900 },
})
await b.close()
console.log('Ausschnitt fertig')
