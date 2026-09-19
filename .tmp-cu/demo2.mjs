import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const page = (await browser.pages()).find(p => p.url().includes('craftflow-git-dev'))
await page.bringToFront()
const base = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
const clickText = (t) => page.evaluate((t) => { const el = [...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith(t) || b.innerText.includes(t)); if (!el) return false; el.click(); return true }, t)
const waitFor = async (needle, max = 150000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if ((await text()).includes(needle)) return true; await sleep(2500) } return false }

await page.goto(base + '/', { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForSelector('textarea', { timeout: 20000 })
const beschreibung = 'Einbaugarderobe für Familie Demo-Mustermann, Hanauer Landstraße 12, 63450 Hanau. Nische 1.800 mm breit, 2.200 mm hoch, 400 mm tief. Korpus und Fronten Egger Dekorspanplatte 19 mm weiß, ABS-Kante 1 mm. 3 Drehtüren mit Blum Topfscharnieren, 1 Kleiderstange, 1 Hutablage, 2 Schubkästen Blum Tandembox unten. Sockel 100 mm, Rückwand. Lieferung und Montage vor Ort, Neubau, Erdgeschoss, gerade Wände.'
await page.evaluate((v) => { const ta = document.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, v); ta.dispatchEvent(new Event('input', { bubbles: true })) }, beschreibung)
await sleep(800)
await page.screenshot({ path: '/tmp/cfshots/eingabe-gut.png' })
await clickText('KALKULATION GENERIEREN')
const t0 = Date.now()
const ok = await waitFor('Brutto', 180000)
console.log('Kalkulation fertig:', ok, 'nach', Math.round((Date.now()-t0)/1000), 's')
await sleep(2000)
await page.screenshot({ path: '/tmp/cfshots/kalkulation.png' })
await page.screenshot({ path: '/tmp/cfshots/kalkulation-full.png', fullPage: true })
let t = await text(); let i = t.indexOf('Positionen'); console.log('--- KALK ---\n' + t.slice(i, i + 1500))

// KI-Optimierung
console.log('KI-Optimierung öffnen:', await clickText('KI-Optimierung'))
await waitFor('KI-OPTIMIERUNG', 20000)
const t1 = Date.now()
// warten bis erste KI-Antwort (kein "KI analysiert" / "KI denkt" mehr)
while (Date.now() - t1 < 120000) { const x = await text(); if (x.includes('KI-OPTIMIERUNG') && !x.includes('KI analysiert das Angebot') && !x.includes('KI denkt')) break; await sleep(2500) }
await sleep(1000)
await page.screenshot({ path: '/tmp/cfshots/optimierung-analyse.png' })
t = await text(); i = t.indexOf('KI-OPTIMIERUNG'); console.log('--- OPTIM 1 ---\n' + t.slice(i, i + 1200))

// Änderung per Chat
const msg = 'Die Türen bitte mit Soft-Close-Scharnieren. Und leg eine Alternativposition an: dieselbe Garderobe in Eiche massiv, geölt.'
await page.evaluate((v) => { const tas = [...document.querySelectorAll('textarea')]; const ta = tas.find(x => x.placeholder && x.placeholder.includes('Holzart ist Eiche')); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, v); ta.dispatchEvent(new Event('input', { bubbles: true })) }, msg)
await sleep(500)
await clickText('Senden')
const t2 = Date.now()
await sleep(4000)
while (Date.now() - t2 < 150000) { const x = await text(); if (!x.includes('KI denkt')) break; await sleep(2500) }
await sleep(1500)
await page.screenshot({ path: '/tmp/cfshots/optimierung-aenderung.png' })
await page.screenshot({ path: '/tmp/cfshots/optimierung-aenderung-full.png', fullPage: true })
t = await text(); i = t.indexOf('KI-OPTIMIERUNG'); console.log('--- OPTIM 2 ---\n' + t.slice(i, i + 1800))

// Kalkulations-Check
console.log('Check öffnen:', await clickText('Kalkulations-Check'))
const t3 = Date.now(); await sleep(3000)
while (Date.now() - t3 < 150000) { const x = await text(); if (x.includes('KALKULATIONS-CHECK') && !x.includes('KI erklärt die Stundenkalkulation') && !x.includes('KI denkt')) break; await sleep(2500) }
await sleep(1000)
await page.screenshot({ path: '/tmp/cfshots/check.png' })
t = await text(); i = t.indexOf('KALKULATIONS-CHECK'); console.log('--- CHECK ---\n' + t.slice(i, i + 1800))

// Tabs
await clickText('Kunde'); await sleep(1500); await page.screenshot({ path: '/tmp/cfshots/tab-kunde.png' })
await clickText('Angebot'); await sleep(1500); await page.screenshot({ path: '/tmp/cfshots/tab-angebot.png' }); await page.screenshot({ path: '/tmp/cfshots/tab-angebot-full.png', fullPage: true })
t = await text(); i = t.indexOf('Angebotsnummer'); console.log('--- ANGEBOT ---\n' + t.slice(i, i + 1200))
browser.disconnect()
