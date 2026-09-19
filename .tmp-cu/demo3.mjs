import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const page = (await browser.pages()).find(p => p.url().includes('craftflow-git-dev'))
await page.bringToFront()
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
const clickText = (t) => page.evaluate((t) => { const el = [...document.querySelectorAll('button')].find(b => b.innerText.includes(t)); if (!el) return false; el.click(); return true }, t)
const setTa = (phTeil, v) => page.evaluate((phTeil, v) => { const ta = [...document.querySelectorAll('textarea')].find(x => (x.placeholder||'').includes(phTeil)); if (!ta) return false; const d = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value'); d.set.call(ta, v); ta.dispatchEvent(new Event('input', { bubbles: true })); return true }, phTeil, v)
const show = (label, needle, n = 1500) => text().then(t => { const i = t.indexOf(needle); console.log(`--- ${label} ---\n` + (i < 0 ? '(nicht gefunden)' : t.slice(i, i + n))) })

await page.screenshot({ path: '/tmp/cfshots/tab-kunde.png' })
console.log('Weiter zur Kalkulation:', await clickText('Weiter zur Kalkulation'))
await sleep(2500)
await page.screenshot({ path: '/tmp/cfshots/kalkulation.png' })
await page.screenshot({ path: '/tmp/cfshots/kalkulation-full.png', fullPage: true })
await show('KALK', 'Positionen', 2500)

console.log('KI-Optimierung öffnen:', await clickText('KI-Optimierung'))
const t1 = Date.now(); await sleep(3000)
while (Date.now() - t1 < 120000) { const x = await text(); if (x.includes('KI-OPTIMIERUNG') && !x.includes('KI analysiert das Angebot') && !x.includes('KI denkt')) break; await sleep(2500) }
await sleep(1000)
await page.screenshot({ path: '/tmp/cfshots/optimierung-analyse.png' })
await show('OPTIM 1', 'KI-OPTIMIERUNG', 1200)

const msg = 'Die Türen bitte mit Soft-Close-Scharnieren. Und leg eine Alternativposition an: dieselbe Garderobe in Eiche massiv, geölt.'
console.log('Nachricht gesetzt:', await setTa('Holzart ist Eiche', msg))
await sleep(500)
console.log('Senden:', await clickText('Senden'))
const t2 = Date.now(); await sleep(4000)
while (Date.now() - t2 < 150000) { const x = await text(); if (!x.includes('KI denkt')) break; await sleep(2500) }
await sleep(1500)
await page.screenshot({ path: '/tmp/cfshots/optimierung-aenderung.png' })
await page.screenshot({ path: '/tmp/cfshots/optimierung-aenderung-full.png', fullPage: true })
await show('OPTIM 2', 'KI-OPTIMIERUNG', 2200)

console.log('Check öffnen:', await clickText('Kalkulations-Check'))
const t3 = Date.now(); await sleep(3000)
while (Date.now() - t3 < 150000) { const x = await text(); if (x.includes('KALKULATIONS-CHECK') && !x.includes('KI erklärt die Stundenkalkulation') && !x.includes('KI denkt')) break; await sleep(2500) }
await sleep(1000)
await page.screenshot({ path: '/tmp/cfshots/check.png' })
await show('CHECK', 'KALKULATIONS-CHECK', 2000)

// Rückmeldung im Check
console.log('Check-Antwort gesetzt:', await setTa('Position 2 hat', 'Die Montage dauert bei mir für so eine Garderobe eher 5 Stunden, nicht weniger.'))
await sleep(400); console.log('Senden:', await clickText('Senden'))
const t4 = Date.now(); await sleep(4000)
while (Date.now() - t4 < 150000) { const x = await text(); if (!x.includes('KI denkt')) break; await sleep(2500) }
await sleep(1000)
await page.screenshot({ path: '/tmp/cfshots/check-antwort.png' })
await show('CHECK 2', 'KALKULATIONS-CHECK', 2600)

await clickText('Angebot'); await sleep(1500)
await page.screenshot({ path: '/tmp/cfshots/tab-angebot.png' })
await page.screenshot({ path: '/tmp/cfshots/tab-angebot-full.png', fullPage: true })
await show('ANGEBOT', 'Angebotsnummer', 1500)
browser.disconnect()
