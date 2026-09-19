import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 1100 })
await page.goto('https://vercel.com/fabian-scharf-s-projects/craftflow/settings/environment-variables', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 2500))
const felder = await page.evaluate(() => [...document.querySelectorAll('input, textarea, button')].slice(0, 60).map(e => `${e.tagName}:${e.getAttribute('name') || ''}|${e.getAttribute('placeholder') || ''}|${e.getAttribute('aria-label') || ''}|${(e.innerText || '').trim().slice(0, 25)}`).filter(s => !/^BUTTON:\|\|\|$/.test(s)))
console.log(JSON.stringify(felder, null, 0))
await page.screenshot({ path: '.tmp-cu/vercel-env.png' })
await page.close(); browser.disconnect()
