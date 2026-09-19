import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const page = (await browser.pages()).find(p => p.url().includes('craftflow-git-dev'))
const r = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.includes('Direkt loslegen')); if (!b) return false; b.click(); return true })
console.log('Direkt loslegen:', r)
await new Promise(r => setTimeout(r, 1500))
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 200).replace(/\n/g, ' ⏎ '))
browser.disconnect()
