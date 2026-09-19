import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
await t.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === '📋'); if (k) k.click() })
await new Promise(r => setTimeout(r, 1500))
const d = await t.evaluate(() => {
  const txt = document.body.innerText.replace(/\s+/g, ' ')
  return {
    dialog: /Nicht gespeicherte Änderungen/.test(txt) && /Verwerfen/.test(txt),
    knoepfe: [...document.querySelectorAll('button')].map(e => e.textContent.trim()).filter(x => /Speichern und weiter|Verwerfen|Zurück/.test(x)),
  }
})
console.log('Warnung beim Verlassen:', JSON.stringify(d))
await t.screenshot({ path: '.tmp-cu/verlassen.png', captureBeyondViewport: false })
// verwerfen, damit kein Testprojekt entsteht
await t.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Verwerfen'); if (k) k.click() })
await new Promise(r => setTimeout(r, 2000))
const nachher = await t.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 120))
console.log('danach:', nachher)
await b.disconnect()
