import puppeteer from 'puppeteer-core'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const WERT = 'ccc76f9d850d4371ace32844d6d3b3bf54a645e9f579348c'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1100 })
await page.goto('https://vercel.com/fabian-scharf-s-projects/craftflow/settings/environment-variables', { waitUntil: 'networkidle2', timeout: 60000 }); await sleep(3000)
const schon = () => page.evaluate(() => [...document.querySelectorAll('button, span, div')].some(e => e.childElementCount === 0 && e.innerText?.trim() === 'CRON_SECRET'))
if (await schon()) { console.log('existiert bereits'); await page.close(); browser.disconnect(); process.exit(0) }
const add = await page.$$('button'); for (const b of add) { if ((await b.evaluate(e => e.innerText.trim())) === 'Add Environment Variable') { await b.click(); break } }
await sleep(2500)
const key = await page.waitForSelector('input[placeholder^="CLIENT_KEY"]', { visible: true, timeout: 10000 })
await key.click({ clickCount: 3 }); await page.keyboard.type('CRON_SECRET', { delay: 30 })
const val = await page.$('textarea[aria-label="secret value"], input[placeholder="Enter a value"]')
await val.click(); await page.keyboard.type(WERT, { delay: 8 }); await sleep(500)
const buttons = await page.$$('button'); let save = null
for (const b of buttons) { const t = await b.evaluate(e => e.innerText.trim()); if (t === 'Save') save = b }
if (!save) { console.log('kein Save-Knopf'); process.exit(1) }
await save.click(); console.log('Save per Maus geklickt'); await sleep(6000)
const offen = await page.evaluate(() => !!document.querySelector('input[placeholder^="CLIENT_KEY"]'))
console.log('Dialog offen:', offen, '| CRON_SECRET sichtbar:', await schon())
await page.screenshot({ path: '.tmp-cu/vercel-env-nachher3.png' })
await page.close(); browser.disconnect()
