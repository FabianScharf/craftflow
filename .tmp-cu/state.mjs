import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = (await browser.pages()).find(p => p.url().includes('doc.clickup.com'))
console.log(page.url())
const items = await page.evaluate(() => [...document.querySelectorAll('.sidebar-name-text, [class*="sidebar"] [class*="name"]')].map(e => e.innerText.trim()).filter(Boolean))
console.log(items.join('\n'))
browser.disconnect()
