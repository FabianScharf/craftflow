import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const page = (await browser.pages()).find(p => p.url().includes('craftflow-git-dev'))
await page.bringToFront()
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
const clickText = (t) => page.evaluate((t) => { const el = [...document.querySelectorAll('button')].find(b => b.innerText.includes(t)); if (!el) return false; el.click(); return true }, t)
const setTa = (phTeil, v) => page.evaluate((phTeil, v) => { const ta = [...document.querySelectorAll('textarea')].find(x => (x.placeholder||'').includes(phTeil)); if (!ta) return false; const d = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value'); d.set.call(ta, v); ta.dispatchEvent(new Event('input', { bubbles: true })); return true }, phTeil, v)
const show = (label, needle, n = 1500) => text().then(t => { const i = t.indexOf(needle); console.log(`--- ${label} ---\n` + (i < 0 ? '(nicht gefunden)' : t.slice(i, i + n))) })
const waitIdle = async (max = 150000) => { const t0 = Date.now(); await sleep(3000); while (Date.now() - t0 < max) { if (!(await text()).includes('KI denkt')) return; await sleep(2500) } }

// Lernfrage bejahen
console.log('ja gesetzt:', await setTa('Position 2 hat', 'Ja, merk dir das.'))
await sleep(300); console.log('Senden:', await clickText('Senden'))
await waitIdle(); await sleep(1000)
await page.screenshot({ path: '/tmp/cfshots/check-gelernt.png' })
let t = await text(); let i = t.lastIndexOf('DU'); console.log('--- LERNEN ---\n' + t.slice(i, i + 900))

// Angebot-Tab
console.log('Angebot-Tab:', await clickText('📄 Angebot')); await sleep(1500)
await page.screenshot({ path: '/tmp/cfshots/tab-angebot.png' })
await page.screenshot({ path: '/tmp/cfshots/tab-angebot-full.png', fullPage: true })
await show('ANGEBOT', 'ANGEBOTSNUMMER', 1600)
// Speichern
console.log('Speichern:', await clickText('Speichern')); await sleep(2500)
console.log('Kopf:', (await text()).slice(0, 120).replace(/\n/g, ' ⏎ '))
// PDF Vorschau
const pdfBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /PDF/i.test(b.innerText)); if (!b) return null; b.click(); return b.innerText })
console.log('PDF-Button:', pdfBtn); await sleep(6000)
await page.screenshot({ path: '/tmp/cfshots/pdf-vorschau.png' })
console.log('URL jetzt:', page.url())
console.log((await text()).slice(0, 400).replace(/\n/g, ' ⏎ '))
browser.disconnect()
