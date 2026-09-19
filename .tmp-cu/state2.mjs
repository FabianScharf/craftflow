import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const page = (await browser.pages()).find(p => p.url().includes('craftflow-git-dev'))
await page.screenshot({ path: '/tmp/cfshots/state.png' })
const t = await page.evaluate(() => document.body.innerText)
console.log(t.slice(0, 2500))
browser.disconnect()
