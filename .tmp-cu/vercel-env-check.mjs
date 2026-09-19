import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://vercel.com/fabian-scharf-s-projects/craftflow/settings/environment-variables', { waitUntil: 'networkidle2', timeout: 60000 })
const info = await page.evaluate(() => ({ url: location.href, title: document.title, hatKeyFeld: !!document.querySelector('input[name="key"], input[placeholder*="EXAMPLE"], input[placeholder*="KEY"]'), text: document.body.innerText.slice(0, 300).replace(/\s+/g, ' ') }))
console.log(JSON.stringify(info, null, 1))
await page.close(); browser.disconnect()
