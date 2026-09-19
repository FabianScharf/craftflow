import puppeteer from 'puppeteer-core'
const BASIS = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const HELL = JSON.parse(process.argv[2])
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
await page.goto(BASIS + '/settings', { waitUntil: 'networkidle2', timeout: 90000 })
await sleep(3000)
console.log('URL nach Aufruf:', page.url())
if (!page.url().includes('/settings')) { console.log('NICHT EINGELOGGT — Fabian muss sich im Fernsteuer-Chrome auf der dev-Vorschau anmelden.'); await page.screenshot({ path: '/tmp/cfshots/dev-login.png' }); browser.disconnect(); process.exit(2) }

const setInput = (el, v) => page.evaluate((el, v) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }, el, v)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Marketing & CI'); el && el.click() })
await sleep(1200)
await page.screenshot({ path: '/tmp/cfshots/dev-dunkel-settings.png' })

// 1) Farbcode-Feld: ohne Raute, klein
const felder = await page.$$('input[maxlength="7"]')
console.log('Farbcode-Textfelder gefunden:', felder.length)
await setInput(felder[1], 'c8102e'); await sleep(300)
let probe = await page.evaluate(() => ({ text: document.querySelectorAll('input[maxlength="7"]')[1].value, picker: document.querustSelectorAll ? 1 : document.querySelectorAll('input[type="color"]')[1].value }))
console.log('Eingabe "c8102e" →', JSON.stringify(probe))
await page.evaluate(() => document.querySelectorAll('input[maxlength="7"]')[1].blur()); await sleep(300)
console.log('nach Verlassen des Feldes:', await page.evaluate(() => document.querySelectorAll('input[maxlength="7"]')[1].value))
// 2) Unsinn
await setInput(felder[1], 'rot'); await sleep(300)
console.log('Eingabe "rot" → Fehlermeldung sichtbar:', await page.evaluate(() => document.body.innerText.includes('Kein gültiger Farbcode')))
await page.screenshot({ path: '/tmp/cfshots/dev-farbcode-fehler.png' })
// Zurueck auf den echten Wert, damit nichts Falsches im Formular bleibt
await setInput(felder[1], '#C8885A'); await sleep(300)

// 3) Toenungen: irgendein Element mit color-mix hat eine sichtbare Farbe?
const toen = await page.evaluate(() => {
  const els = [...document.querySelectorAll('[style*="color-mix"]')]
  return { anzahl: els.length, beispiel: els[0] ? getComputedStyle(els[0]).borderColor + ' / ' + getComputedStyle(els[0]).backgroundColor : '-' }
})
console.log('Toenungen (color-mix) auf der Seite:', JSON.stringify(toen))

// 4) Helle Palette einspielen (nur im Browser, NICHT speichern)
const setze = (p) => page.evaluate((p) => { const r = document.documentElement; const V = { primary: '--c-primary', accent: '--c-accent', text: '--c-text', textMid: '--c-text-mid', surface1: '--c-surface1', surface2: '--c-surface2', border: '--c-border', darkbg: '--c-darkbg' }; for (const k in V) r.style.setProperty(V[k], p[k]) }, p)
await setze(HELL); await sleep(500)
await page.screenshot({ path: '/tmp/cfshots/dev-hell-settings.png' })
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Kostenstellen'); el && el.click() }); await sleep(800)
await page.screenshot({ path: '/tmp/cfshots/dev-hell-kostenstellen.png' })
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Lieferanten'); el && el.click() }); await sleep(800)
await page.screenshot({ path: '/tmp/cfshots/dev-hell-lieferanten.png' })

await page.goto(BASIS + '/', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(3000)
await setze(HELL); await sleep(500)
await page.screenshot({ path: '/tmp/cfshots/dev-hell-start.png' })
// Projektliste / Angebot oeffnen, falls vorhanden
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.title && /projekt|liste|ordner/i.test(b.title)); b && b.click() }); await sleep(1500)
await page.screenshot({ path: '/tmp/cfshots/dev-hell-projekte.png' })

// 5) Server-Pruefung: Unsinn wird abgewiesen, Kleinbuchstaben werden bereinigt (Wert = Fabians heutiger)
const api = await page.evaluate(async () => {
  const a = await fetch('/api/settings/betriebsprofil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farbe_akzent: 'rot' }) })
  const aj = await a.json()
  const b = await fetch('/api/settings/betriebsprofil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farbe_akzent: 'c8885a' }) })
  const bj = await b.json()
  const g = await (await fetch('/api/settings/betriebsprofil')).json()
  return { unsinn: { status: a.status, ...aj }, klein: { status: b.status, ...bj }, gespeichert: { primaer: g.profil?.farbe_primaer, akzent: g.profil?.farbe_akzent } }
})
console.log('API:', JSON.stringify(api))
await page.close(); browser.disconnect()
