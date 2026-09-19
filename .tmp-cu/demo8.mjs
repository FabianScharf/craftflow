import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const page = (await browser.pages()).find(p => p.url().includes('craftflow-git-dev'))
await page.bringToFront()
const base = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
const clickText = (t) => page.evaluate((t) => { const el = [...document.querySelectorAll('button')].find(b => b.innerText.includes(t)); if (!el) return false; el.click(); return true }, t)

// ── Position aufklappen (wir sind im Demo-Projekt, Kalkulation)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '×'); b && b.click() }) // Check-Panel zu
await sleep(500)
const opened = await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.innerText && e.innerText.trim() === 'Einbaugarderobe – Korpus und Fronten'); if (!el) return false; el.click(); return true })
console.log('Position geklickt:', opened); await sleep(1200)
await page.screenshot({ path: '/tmp/cfshots/position-offen.png' })
await page.screenshot({ path: '/tmp/cfshots/position-offen-full.png', fullPage: true })
let t = await text(); let i = t.indexOf('KUNDENTEXT'); if (i < 0) i = t.indexOf('Kundentext'); console.log('--- POSITION OFFEN ---\n' + t.slice(Math.max(0,i), Math.max(0,i) + 1600))

// ── Meine Bauweise: Testregel löschen
await page.goto(base + '/settings', { waitUntil: 'domcontentloaded' }); await sleep(3000)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim().endsWith('Meine Bauweise')); el && el.click() }); await sleep(2000)
t = await text(); console.log('--- BAUWEISE VORHER ---\n' + t.slice(t.indexOf('Meine Bauweise\n'), t.indexOf('Meine Bauweise\n') + 1400))
page.on('dialog', async d => { console.log('Dialog:', d.message()); await d.accept() })
const del = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')].filter(i => /Einbaugarderobe|5 Stunden|300 min/i.test(i.value))
  if (!inputs.length) return 'keine Regel gefunden'
  let card = inputs[0]; for (let k = 0; k < 8 && card; k++) { card = card.parentElement; if (card && [...card.querySelectorAll('button')].some(b => b.innerText.trim() === '×')) break }
  const x = card && [...card.querySelectorAll('button')].find(b => b.innerText.trim() === '×'); if (!x) return 'kein ×'
  x.click(); return 'geklickt: ' + inputs.map(i => i.value).join(' / ')
})
console.log('Löschen:', del); await sleep(2500)
// evtl. Bestätigung in-App
const conf = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Löschen|Ja, löschen|Entfernen/i.test(b.innerText)); if (!b) return null; b.click(); return b.innerText }); console.log('Bestätigung:', conf); await sleep(2000)
t = await text(); console.log('--- BAUWEISE NACHHER ---\n' + t.slice(t.indexOf('Meine Bauweise\n'), t.indexOf('Meine Bauweise\n') + 1400))

// ── Wizard
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim().endsWith('Hilfe')); el && el.click() }); await sleep(1500)
console.log('Wizard:', await clickText('Programmvorstellung wiederholen')); await sleep(4500); console.log('URL:', page.url())
if (!(await text()).includes('Willkommen')) { await page.goto(base + '/', { waitUntil: 'domcontentloaded' }); await sleep(4000) }
for (let s = 0; s < 9; s++) {
  await page.screenshot({ path: `/tmp/cfshots/wizard-${s + 1}.png` })
  const tt = await text(); const j = tt.indexOf('Manuell eingeben'); 
  console.log(`--- WIZARD ${s + 1} ---\n` + tt.slice(j + 16, j + 16 + 900).replace(/\n/g, ' ⏎ '))
  const next = await page.evaluate(() => { const bs = [...document.querySelectorAll('button')]; const b = bs.find(b => /^Weiter/.test(b.innerText.trim())); if (!b) return null; const tt = b.innerText; b.click(); return tt })
  console.log('next:', next)
  if (!next) { const fin = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(x => x && x.length < 50)); console.log('Buttons:', fin.join(' | ')); break }
  await sleep(1000)
}
browser.disconnect()
