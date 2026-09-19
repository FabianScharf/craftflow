import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const page = (await browser.pages()).find(p => p.url().includes('craftflow-git-dev'))
await page.bringToFront()
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
const clickText = (t) => page.evaluate((t) => { const el = [...document.querySelectorAll('button')].find(b => b.innerText.includes(t)); if (!el) return false; el.click(); return true }, t)
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 2 })
await page.evaluate(() => document.querySelector('[title="Meine Projekte"]')?.click()); await sleep(2500)
const opened = await page.evaluate(() => { const cards = [...document.querySelectorAll('div')].filter(d => d.innerText && d.innerText.includes('Demo-Mustermann') && d.innerText.length < 400); const c = cards[cards.length - 1]; if (!c) return false; const b = [...c.querySelectorAll('button')].find(b => b.innerText.includes('Öffnen')) || c; b.click(); return true })
console.log('geöffnet:', opened); await sleep(3000)
console.log('Kalkulation:', await clickText('Kalkulation')); await sleep(1500)
// Panels zu, Position auf
await page.evaluate(() => { [...document.querySelectorAll('button')].filter(b => b.innerText.trim() === '×' || b.innerText.trim() === '✕').forEach(b => b.click()) }); await sleep(500)
const op = await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.innerText && e.innerText.trim() === 'Einbaugarderobe – Korpus und Fronten'); if (!el) return false; el.click(); return true })
console.log('Position auf:', op); await sleep(1200)
await page.evaluate(() => window.scrollTo(0, 0))
// Ist die Egger-Zeile da?
const t = await text(); console.log('Egger-Zeile vorhanden:', t.includes('Egger Dekorspanplatte 19'), '| Netto:', (t.match(/NETTO\n([^\n]+)/) || [])[1])
// so scrollen, dass Positionskopf oben steht
await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.innerText && e.innerText.trim() === 'Einbaugarderobe – Korpus und Fronten'); el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -140) }); await sleep(600)
await page.screenshot({ path: '/tmp/cfshots/position-offen.png' })
browser.disconnect()
