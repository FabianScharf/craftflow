import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const pages = await browser.pages()
console.log('TABS:'); for (const p of pages) console.log(' -', (await p.title()).slice(0,50), '|', p.url().slice(0,110))
const page = pages.find(p => p.url().includes('craftflow-git-dev') && !p.url().includes('pdf'))
await page.bringToFront()
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
const clickText = (t) => page.evaluate((t) => { const el = [...document.querySelectorAll('button')].find(b => b.innerText.includes(t)); if (!el) return false; el.click(); return true }, t)
const clickTitle = (t) => page.evaluate((t) => { const el = document.querySelector(`[title="${t}"]`); if (!el) return false; el.click(); return true }, t)
const setTa = (phTeil, v) => page.evaluate((phTeil, v) => { const ta = [...document.querySelectorAll('textarea, input')].find(x => (x.placeholder||'').includes(phTeil)); if (!ta) return false; const proto = ta.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(ta, v); ta.dispatchEvent(new Event('input', { bubbles: true })); return true }, phTeil, v)
const waitIdle = async (max = 150000) => { const t0 = Date.now(); await sleep(3000); while (Date.now() - t0 < max) { if (!(await text()).includes('KI denkt')) return; await sleep(2500) } }

// PDF-Tab, falls vorhanden
const pdfTab = pages.find(p => p !== page && (p.url().includes('blob:') || p.url().includes('pdf') || p.url().includes('craftflow-git-dev')))
if (pdfTab) { await pdfTab.bringToFront(); await sleep(1500); await pdfTab.setViewport({ width: 1100, height: 1400, deviceScaleFactor: 2 }); await pdfTab.screenshot({ path: '/tmp/cfshots/pdf-dokument.png' }); console.log('PDF-Tab gescreenshottet:', pdfTab.url().slice(0, 80)); await page.bringToFront() }

// Lernen im Check bejahen
console.log('Kalkulation-Tab:', await clickText('🔢 Kalkulation')); await sleep(1200)
console.log('Check öffnen:', await clickText('Kalkulations-Check')); await sleep(1500)
console.log('ja gesetzt:', await setTa('Position 2 hat', 'Ja, merk dir das.'))
console.log('Senden:', await clickText('Senden')); await waitIdle(); await sleep(800)
await page.screenshot({ path: '/tmp/cfshots/check-gelernt.png' })
let t = await text(); let i = t.lastIndexOf('Ja, merk dir das.'); console.log('--- LERNEN ---\n' + t.slice(i, i + 600))

// Hilfe-Assistent (?)
const helpOpened = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '?'); if (!b) return false; b.click(); return true })
console.log('Hilfe geöffnet:', helpOpened); await sleep(1500)
console.log('Frage gesetzt:', await setTa('Frage stellen', 'Wie ändere ich meinen Stundensatz für die Montage?'))
await page.keyboard.press('Enter'); await waitIdle(60000); await sleep(800)
await page.screenshot({ path: '/tmp/cfshots/hilfe-assistent.png' })
t = await text(); i = t.indexOf('CraftFlow-Assistent'); console.log('--- HILFE ---\n' + t.slice(Math.max(0,i), Math.max(0,i) + 900))
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '×' || b.innerText.trim() === '✕'); b && b.click() })

// Projekte
console.log('Projekte:', await clickTitle('Meine Projekte')); await sleep(2500)
await page.screenshot({ path: '/tmp/cfshots/projekte.png' })
console.log('--- PROJEKTE ---\n' + (await text()).slice(0, 500).replace(/\n/g, ' ⏎ '))

// Onboarding-Wizard erneut starten (Settings → Hilfe)
await page.goto(page.url().split('?')[0].replace(/\/$/, '') + '/settings', { waitUntil: 'networkidle2' }); await sleep(2000)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim().endsWith('Hilfe')); el && el.click() }); await sleep(1500)
await page.screenshot({ path: '/tmp/cfshots/settings-hilfe.png' })
console.log('--- HILFE-SEKTION ---\n' + (await text()).slice((await text()).indexOf('Hilfe\nDer'), (await text()).indexOf('Hilfe\nDer') + 400))
const wiz = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Wizard|Einführung|erneut|starten/i.test(b.innerText)); if (!b) return null; const t = b.innerText; b.click(); return t })
console.log('Wizard-Button:', wiz); await sleep(3500)
console.log('URL:', page.url())
for (let s = 0; s < 9; s++) {
  await page.screenshot({ path: `/tmp/cfshots/wizard-${s + 1}.png` })
  const tt = await text(); const j = tt.indexOf('Willkommen') >= 0 && s === 0 ? tt.indexOf('Willkommen') : 0
  console.log(`--- WIZARD ${s + 1} ---\n` + tt.slice(0, 700).replace(/\n/g, ' ⏎ '))
  const next = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /^Weiter/.test(b.innerText.trim()) || b.innerText.trim() === '→' || /Weiter →/.test(b.innerText)); if (!b) return null; const t = b.innerText; b.click(); return t })
  console.log('next:', next)
  if (!next) break
  await sleep(1200)
}
browser.disconnect()
