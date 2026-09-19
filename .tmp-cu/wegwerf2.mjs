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

// Kundendaten: erkennbar ein Beispiel, damit niemand denkt, das sei ein echter Kunde.
await app.evaluate(() => {
  const setze = (platzhalterTeil, wert) => {
    const el = [...document.querySelectorAll('input, textarea')]
      .find(i => i.placeholder?.toLowerCase().includes(platzhalterTeil) || i.previousElementSibling?.textContent?.toLowerCase().includes(platzhalterTeil))
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, wert)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }
  setze('kundenname', 'Beispielkunde (Testprojekt)')
  setze('bauvorha', 'Einbauschrank Flur — Beispiel für die Anleitung')
})
await warte(1200)

console.log('Kalkulation:', await klick('Kalkulation'))
await warte(2500)
console.log('Position hinzufügen:', await klick('Position hinzufügen'))
await warte(2500)
await app.screenshot({ path: '.tmp-cu/w-kalkulation.png' })
const text = await app.evaluate(() => document.body.innerText.slice(0, 300).replace(/\n+/g, ' | '))
console.log('Inhalt:', text)
await b.disconnect()
