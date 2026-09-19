import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const pages = await browser.pages()
const page = pages.find(p => p.url().includes('craftflow-git-dev'))
if (!page) { console.log('kein Tab'); process.exit(1) }
await page.bringToFront()
const base = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
const clickText = (t) => page.evaluate((t) => { const el = [...document.querySelectorAll('button')].find(b => b.innerText.includes(t)); if (!el) return false; el.click(); return true }, t)
const clickTitle = (t) => page.evaluate((t) => { const el = document.querySelector(`[title="${t}"]`); if (!el) return false; el.click(); return true }, t)
const setTa = (phTeil, v) => page.evaluate((phTeil, v) => { const ta = [...document.querySelectorAll('textarea, input')].find(x => (x.placeholder||'').includes(phTeil)); if (!ta) return false; const proto = ta.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(ta, v); ta.dispatchEvent(new Event('input', { bubbles: true })); return true }, phTeil, v)
const waitIdle = async (max = 150000) => { const t0 = Date.now(); await sleep(3000); while (Date.now() - t0 < max) { if (!(await text()).includes('KI denkt')) return; await sleep(2500) } }
console.log('URL:', page.url())

// ── Wizard über Settings → Hilfe
if (!page.url().includes('/settings')) { await page.goto(base + '/settings', { waitUntil: 'domcontentloaded' }); await sleep(3000) }
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim().endsWith('Hilfe')); el && el.click() }); await sleep(1500)
await page.screenshot({ path: '/tmp/cfshots/settings-hilfe.png' })
let t = await text(); let i = t.indexOf('Hilfe\n'); console.log('--- HILFE-SEKTION ---\n' + t.slice(i, i + 500))
const wiz = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Wizard|Einführung|erneut|starten/i.test(b.innerText)); if (!b) return null; const tt = b.innerText; b.click(); return tt })
console.log('Wizard-Button:', wiz); await sleep(4000); console.log('URL:', page.url())
if (!(await text()).includes('Willkommen')) { await page.goto(base + '/', { waitUntil: 'domcontentloaded' }); await sleep(3500) }
for (let s = 0; s < 9; s++) {
  await page.screenshot({ path: `/tmp/cfshots/wizard-${s + 1}.png` })
  const tt = await text(); const j = Math.max(0, tt.indexOf('Willkommen') >= 0 ? tt.indexOf('Willkommen') : tt.indexOf('CRAFTFLOW'))
  console.log(`--- WIZARD ${s + 1} ---\n` + tt.slice(j, j + 600).replace(/\n/g, ' ⏎ '))
  const next = await page.evaluate(() => { const bs = [...document.querySelectorAll('button')]; const b = bs.find(b => /^Weiter/.test(b.innerText.trim())); if (!b) return null; const tt = b.innerText; b.click(); return tt })
  console.log('next:', next)
  if (!next) { const fin = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(x => x && x.length < 40)); console.log('Buttons:', fin.join(' | ')); break }
  await sleep(1000)
}
// Wizard schließen ohne Kalibrierung zu speichern: "Loslegen"/"Fertig"-Button
const close = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Loslegen|Fertig|Los geht|Schließen|Starten/i.test(b.innerText) && !/Einstellungen/i.test(b.innerText)); if (!b) return null; const tt = b.innerText; b.click(); return tt })
console.log('Wizard geschlossen mit:', close); await sleep(1500)

// ── Projekte
console.log('Projekte:', await clickTitle('Meine Projekte')); await sleep(2500)
await page.screenshot({ path: '/tmp/cfshots/projekte.png' })
console.log('--- PROJEKTE ---\n' + (await text()).slice(0, 700).replace(/\n/g, ' ⏎ '))
// Demo-Projekt öffnen
const opened = await page.evaluate(() => { const cards = [...document.querySelectorAll('div')].filter(d => d.innerText && d.innerText.includes('Demo-Mustermann') && d.innerText.length < 400); const c = cards[cards.length - 1]; if (!c) return false; const b = [...c.querySelectorAll('button')].find(b => b.innerText.includes('Öffnen')) || c; b.click(); return true })
console.log('Demo geöffnet:', opened); await sleep(3000)
console.log('Kalkulation-Tab:', await clickText('Kalkulation')); await sleep(1500)
await page.screenshot({ path: '/tmp/cfshots/kalkulation-2pos.png' })
// Position aufklappen
await page.evaluate(() => { const h = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.innerText && e.innerText.trim() === '▶'); h && h.click() }); await sleep(1200)
await page.screenshot({ path: '/tmp/cfshots/position-offen.png', fullPage: true })
t = await text(); i = t.indexOf('Kundentext'); console.log('--- POSITION OFFEN ---\n' + t.slice(i, i + 1400))

// ── Check + Lernen
console.log('Check öffnen:', await clickText('Kalkulations-Check')); await waitIdle(); await sleep(800)
console.log('Antwort gesetzt:', await setTa('Position 2 hat', 'Die Montage dauert bei mir für so eine Garderobe eher 5 Stunden. Merk dir das bitte als Regel.'))
console.log('Senden:', await clickText('Senden')); await waitIdle(); await sleep(800)
t = await text(); i = t.lastIndexOf('Merk dir das'); console.log('--- LERNEN 1 ---\n' + t.slice(i, i + 700))
console.log('ja gesetzt:', await setTa('Position 2 hat', 'Ja, genau so.'))
console.log('Senden:', await clickText('Senden')); await waitIdle(); await sleep(800)
await page.screenshot({ path: '/tmp/cfshots/check-gelernt.png' })
t = await text(); i = t.lastIndexOf('Ja, genau so.'); console.log('--- LERNEN 2 ---\n' + t.slice(i, i + 600))

// ── Hilfe-Assistent
const helpOpened = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '?'); if (!b) return false; b.click(); return true })
console.log('Hilfe geöffnet:', helpOpened); await sleep(1500)
console.log('Frage gesetzt:', await setTa('Frage stellen', 'Wie ändere ich meinen Stundensatz für die Montage?'))
const sent = await page.evaluate(() => { const ta = [...document.querySelectorAll('input, textarea')].find(x => (x.placeholder||'').includes('Frage stellen')); if (!ta) return false; ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true })
console.log('Enter:', sent); await waitIdle(60000); await sleep(1500)
await page.screenshot({ path: '/tmp/cfshots/hilfe-assistent.png' })
t = await text(); i = t.indexOf('Wie ändere ich'); console.log('--- HILFE ---\n' + t.slice(Math.max(0,i-100), Math.max(0,i) + 900))
browser.disconnect()
