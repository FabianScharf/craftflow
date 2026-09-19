// Live-Test Pipette: Testlogo hochladen, Wähler öffnen, auf blauen Punkt klicken → Akzent übernehmen; erneut öffnen, auf weiße Schrift klicken → Vorschlag/Lupe prüfen.
import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 180000 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1000 })
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(5000)
const geh = async (t) => { await page.evaluate((t) => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === t); el && el.click() }, t); await sleep(3000) }
await geh('Marketing & CI')
const out = {}
const inputs = await page.$$('input[type=file]')
const logoInput = (await Promise.all(inputs.map(async i => [(await (await i.getProperty('accept')).jsonValue()), i]))).find(([a]) => a === 'image/*')?.[1]
await logoInput.uploadFile(process.argv[2] || '/tmp/lvtest/testlogo-blau.png'); await sleep(6000)
const klick = async (t) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === t); if (!b) return false; b.click(); return true }, t)
out.knopf = await klick('Farbe aus dem Logo wählen'); await sleep(4000)
const box = await (await page.$('canvas[data-testid=logo-pipette]'))?.boundingBox()
out.canvas = box ? { w: Math.round(box.width), h: Math.round(box.height) } : null
if (!box) { console.log(JSON.stringify(out)); process.exit(1) }
// Punkt rechts unten (blau, keine Schrift)
await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.85); await sleep(300)
out.unterZeigerBlau = await page.evaluate(() => (document.body.innerText.match(/Unter dem Zeiger:\s*(#[0-9A-F]{6}|–)/) || [])[1])
await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.85); await sleep(300)
out.gewaehlt = await page.evaluate(() => (document.body.innerText.match(/Gewählt:\s*(#[0-9A-F]{6}|–)/) || [])[1])
out.vorschlag = await page.evaluate(() => (document.body.innerText.match(/Vorschlag[^:]*:\s*(#[0-9A-F]{6}|–)/) || [])[1])
await page.screenshot({ path: '/tmp/cfshots/pipette.png' })
out.uebernommen = await klick('Als Akzentfarbe übernehmen'); await sleep(1500)
out.feldNachher = await page.evaluate(() => [...document.querySelectorAll('input')].map(i => i.value).filter(v => /^#/.test(v)))
out.meldung = await page.evaluate(() => (document.body.innerText.match(/#[0-9A-F]{6} als Akzentfarbe übernommen[^\n]*/) || [null])[0])
out.geschlossen = !(await page.$('canvas[data-testid=logo-pipette]'))
console.log(JSON.stringify(out))
await page.close(); browser.disconnect()
