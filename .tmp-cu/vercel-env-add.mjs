import puppeteer from 'puppeteer-core'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const WERT = 'ccc76f9d850d4371ace32844d6d3b3bf54a645e9f579348c'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1100 })
await page.goto('https://vercel.com/fabian-scharf-s-projects/craftflow/settings/environment-variables', { waitUntil: 'networkidle2', timeout: 60000 }); await sleep(2500)
const schon = await page.evaluate(() => document.body.innerText.includes('CRON_SECRET'))
if (schon) { console.log('CRON_SECRET existiert bereits'); await page.close(); browser.disconnect(); process.exit(0) }
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Add Environment Variable'); b && b.click() }); await sleep(2000)
const felder = await page.evaluate(() => [...document.querySelectorAll('input, textarea')].map((e, i) => `${i}:${e.tagName}|${e.type}|${e.getAttribute('name') || ''}|${e.getAttribute('placeholder') || ''}|${e.getAttribute('aria-label') || ''}|${e.value.slice(0, 20)}`))
console.log('FELDER', JSON.stringify(felder))
await page.screenshot({ path: '.tmp-cu/vercel-env-form.png' })
await page.close(); browser.disconnect()
