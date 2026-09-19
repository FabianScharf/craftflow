// Live-Test: Test-Logo hochladen (Marketing & CI), „Farbton aus dem Logo übernehmen" drücken, Wert im Akzentfeld lesen. Keine KI-Kosten.
import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 180000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(5000)
const geh = async (t) => { await page.evaluate((t) => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === t); el && el.click() }, t); await sleep(3000) }
await geh('Marketing & CI')
const out = {}
out.vorher = await page.evaluate(() => [...document.querySelectorAll('input')].map(i => i.value).filter(v => /^#/.test(v)))
// Logo hochladen (Test-Datei: Kachel mit Kupferton)
const inputs = await page.$$('input[type=file]')
const logoInput = (await Promise.all(inputs.map(async i => [(await (await i.getProperty('accept')).jsonValue()), i]))).find(([a]) => a === 'image/*')?.[1]
if (!logoInput) { console.log('kein Logo-Input'); process.exit(1) }
await logoInput.uploadFile(process.argv[2] || '/tmp/lvtest/foto-1.png'); await sleep(6000)
out.knopfDa = await page.evaluate(() => !![...document.querySelectorAll('button')].find(b => b.innerText.includes('Farbton aus dem Logo')))
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.includes('Farbton aus dem Logo')); b && b.click() }); await sleep(4000)
out.meldung = await page.evaluate(() => (document.body.innerText.match(/Farbton #[0-9A-F]{6} aus dem Logo[^\n]*|Im Logo ist keine[^\n]*|Fehler: Das Logo[^\n]*/) || [null])[0])
out.nachher = await page.evaluate(() => [...document.querySelectorAll('input')].map(i => i.value).filter(v => /^#/.test(v)))
await page.screenshot({ path: '/tmp/cfshots/logofarbe.png' })
console.log(JSON.stringify(out))
await page.close(); browser.disconnect()
