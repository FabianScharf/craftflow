import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 })
const warte = ms => new Promise(r => setTimeout(r, ms))
const klick = t => app.evaluate(x => {
  const el = [...document.querySelectorAll('button, a')].find(e => e.textContent?.trim().includes(x))
  if (el) { el.click(); return true } return false
}, t)

// 1) Export-Menü
await klick('Export')
await warte(1200)
await app.screenshot({ path: '.tmp-cu/w-export.png', clip: { x: 900, y: 150, width: 500, height: 300 } })
console.log('✓ w-export.png')
await app.keyboard.press('Escape')
await warte(600)

// 2) KI-Optimierung öffnen — nur die Oberfläche, keine Anfrage senden
await klick('KI-Optimierung')
await warte(3500)
await app.screenshot({ path: '.tmp-cu/w-optimieren.png' })
console.log('✓ w-optimieren.png')
const hatChat = await app.evaluate(() => document.body.innerText.includes('Versionen'))
console.log('  Versionen sichtbar:', hatChat)
await b.disconnect()
