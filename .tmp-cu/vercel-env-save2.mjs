import puppeteer from 'puppeteer-core'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const WERT = 'ccc76f9d850d4371ace32844d6d3b3bf54a645e9f579348c'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1100 })
await page.goto('https://vercel.com/fabian-scharf-s-projects/craftflow/settings/environment-variables', { waitUntil: 'networkidle2', timeout: 60000 }); await sleep(3000)
if (await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'CRON_SECRET'))) { console.log('existiert bereits'); await page.close(); browser.disconnect(); process.exit(0) }
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Add Environment Variable'); b && b.click() }); await sleep(2500)
const key = await page.waitForSelector('input[placeholder^="CLIENT_KEY"]', { visible: true, timeout: 10000 })
await key.focus(); await page.keyboard.type('CRON_SECRET', { delay: 30 }); await sleep(300)
const val = await page.$('textarea[aria-label="secret value"], input[placeholder="Enter a value"]')
await val.focus(); await page.keyboard.type(WERT, { delay: 8 }); await sleep(500)
const werte = await page.evaluate(() => ({ key: document.querySelector('input[placeholder^="CLIENT_KEY"]')?.value, valLen: (document.querySelector('textarea[aria-label="secret value"], input[placeholder="Enter a value"]')?.value || '').length }))
console.log('eingetragen:', JSON.stringify(werte))
if (werte.key !== 'CRON_SECRET' || werte.valLen !== WERT.length) { console.log('ABBRUCH: Felder nicht gefüllt'); await page.screenshot({ path: '.tmp-cu/vercel-env-fehler.png' }); await page.close(); browser.disconnect(); process.exit(1) }
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Save' && !b.disabled); b && b.click() })
await sleep(5000)
const offen = await page.evaluate(() => !!document.querySelector('input[placeholder^="CLIENT_KEY"]'))
const drin = await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'CRON_SECRET') || document.body.innerText.includes('CRON_SECRET'))
console.log('Dialog noch offen:', offen, '| CRON_SECRET sichtbar:', drin)
await page.screenshot({ path: '.tmp-cu/vercel-env-nachher2.png' })
await page.close(); browser.disconnect()
