import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2500)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Mein Betrieb'); el && el.click() }); await sleep(4000)
const zustand = () => page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(b => /Faktoren von Hand|Speichert/.test(b.innerText))
  if (!b) return { gefunden: false, knoepfe: [...document.querySelectorAll('button')].map(x => x.innerText.trim()).filter(Boolean).slice(0, 25) }
  const cs = getComputedStyle(b); const nachbar = b.parentElement?.querySelector('span')
  return { gefunden: true, text: b.innerText.trim(), disabled: b.disabled, bg: cs.backgroundColor, meldung: nachbar?.innerText ?? '' }
})
console.log('Start:', JSON.stringify(await zustand()))
const setze = (delta) => page.evaluate((delta) => { const inp = [...document.querySelectorAll('input[type="number"][step="0.01"]')][0]; if (!inp) return 'kein Feld'; const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); const neu = (Number(inp.value) + delta).toFixed(2); d.set.call(inp, neu); inp.dispatchEvent(new Event('input', { bubbles: true })); return neu }, delta)
console.log('Wert geaendert auf:', await setze(0.01)); await sleep(300)
console.log('Nach Aenderung:', JSON.stringify(await zustand()))
await page.screenshot({ path: '/tmp/cfshots/faktoren-geaendert.png' })
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Faktoren von Hand/.test(b.innerText)); b && b.click() }); await sleep(3500)
console.log('Nach Klick:', JSON.stringify(await zustand()))
await page.screenshot({ path: '/tmp/cfshots/faktoren-gespeichert.png' })
// Ungueltig: leer lassen
await page.evaluate(() => { const inp = [...document.querySelectorAll('input[type="number"][step="0.01"]')][0]; const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(inp, ''); inp.dispatchEvent(new Event('input', { bubbles: true })) }); await sleep(300)
console.log('Leeres Feld:', JSON.stringify(await zustand()))
// Zurueck auf den alten Wert und speichern
await page.reload({ waitUntil: 'networkidle2' }); await sleep(2500)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Mein Betrieb'); el && el.click() }); await sleep(4000)
console.log('Wert zurueck auf:', await setze(-0.01)); await sleep(300)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Faktoren von Hand/.test(b.innerText)); b && b.click() }); await sleep(3500)
console.log('Ende:', JSON.stringify(await zustand()))
await page.close(); browser.disconnect()
