import puppeteer from 'puppeteer-core'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const WERT = 'ccc76f9d850d4371ace32844d6d3b3bf54a645e9f579348c'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1100 })
await page.goto('https://vercel.com/fabian-scharf-s-projects/craftflow/settings/environment-variables', { waitUntil: 'networkidle2', timeout: 60000 }); await sleep(2500)
if (await page.evaluate(() => document.body.innerText.includes('CRON_SECRET'))) { console.log('existiert bereits'); await page.close(); browser.disconnect(); process.exit(0) }
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Add Environment Variable'); b && b.click() }); await sleep(2000)
const key = await page.$('input[aria-label="environment variable key"]'); await key.click(); await key.type('CRON_SECRET', { delay: 20 })
const val = await page.$('textarea[aria-label="secret value"]'); await val.click(); await val.type(WERT, { delay: 5 })
await sleep(500)
const gespeichert = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /^Save$/.test(b.innerText.trim()) && !b.disabled); if (b) { b.click(); return true } return false })
console.log('Save geklickt:', gespeichert); await sleep(4000)
await page.reload({ waitUntil: 'networkidle2' }); await sleep(2500)
console.log('CRON_SECRET in Liste:', await page.evaluate(() => document.body.innerText.includes('CRON_SECRET')))
await page.screenshot({ path: '.tmp-cu/vercel-env-nachher.png' })
await page.close(); browser.disconnect()
