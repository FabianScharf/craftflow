import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 120000 })
const page = (await browser.pages()).find(p => p.url().includes('auth/url-configuration'))
const vals = await page.evaluate(() => [...document.querySelectorAll('input')].map(i => ({ id: i.id || i.name, v: i.value })).filter(x => x.v))
console.log(JSON.stringify(vals))
browser.disconnect()
