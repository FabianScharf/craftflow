import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const pages = await browser.pages()
const page = pages.find(p => p.url().includes('craftflow-git-dev'))
await page.bringToFront()
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
const clickText = (t) => page.evaluate((t) => { const el = [...document.querySelectorAll('button')].find(b => b.innerText.includes(t)); if (!el) return false; el.click(); return true }, t)
const clickTitle = (t) => page.evaluate((t) => { const el = document.querySelector(`[title="${t}"]`); if (!el) return false; el.click(); return true }, t)
const setTa = (phTeil, v) => page.evaluate((phTeil, v) => { const ta = [...document.querySelectorAll('textarea, input')].find(x => (x.placeholder||'').includes(phTeil)); if (!ta) return false; const proto = ta.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(ta, v); ta.dispatchEvent(new Event('input', { bubbles: true })); return true }, phTeil, v)
const waitIdle = async (max = 150000) => { const t0 = Date.now(); await sleep(3000); while (Date.now() - t0 < max) { if (!(await text()).includes('KI denkt')) return; await sleep(2500) } }

// PDF-Vorschau ist offen
await sleep(1000)
await page.screenshot({ path: '/tmp/cfshots/pdf-vorschau.png' })
const frames = page.frames().map(f => f.url().slice(0, 80)); console.log('Frames:', frames)
console.log('Zurück:', await clickText('Zurück')); await sleep(1500)

console.log('Kalkulation-Tab:', await clickText('Kalkulation')); await sleep(1200)
console.log('Check öffnen:', await clickText('Kalkulations-Check')); await sleep(1500)
console.log('ja gesetzt:', await setTa('Position 2 hat', 'Ja, merk dir das.'))
console.log('Senden:', await clickText('Senden')); await waitIdle(); await sleep(800)
await page.screenshot({ path: '/tmp/cfshots/check-gelernt.png' })
let t = await text(); let i = t.lastIndexOf('Ja, merk dir das.'); console.log('--- LERNEN ---\n' + t.slice(i, i + 600))

// Hilfe-Assistent
const helpOpened = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '?'); if (!b) return false; b.click(); return true })
console.log('Hilfe geöffnet:', helpOpened); await sleep(1500)
console.log('Frage gesetzt:', await setTa('Frage stellen', 'Wie ändere ich meinen Stundensatz für die Montage?'))
const sent = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(b => /Senden|→|↑/.test(b.innerText.trim())); const x = b[b.length-1]; if (!x) return false; x.click(); return x.innerText })
console.log('Hilfe senden:', sent); await waitIdle(60000); await sleep(1000)
await page.screenshot({ path: '/tmp/cfshots/hilfe-assistent.png' })
t = await text(); i = t.indexOf('Wie ändere ich'); console.log('--- HILFE ---\n' + t.slice(Math.max(0,i-200), Math.max(0,i) + 900))

// Projekte
console.log('Projekte:', await clickTitle('Meine Projekte')); await sleep(2500)
await page.screenshot({ path: '/tmp/cfshots/projekte.png' })
console.log('--- PROJEKTE ---\n' + (await text()).slice(0, 600).replace(/\n/g, ' ⏎ '))
browser.disconnect()
