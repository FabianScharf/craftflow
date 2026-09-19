import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 60000 })
const page = (await browser.pages()).find(p => p.url().includes('resend.com'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
await page.evaluate(() => { const b = [...document.querEctorAll ? [] : document.querySelectorAll('button, a')].find(b => b.innerText.trim() === 'Manual setup'); b && b.click() })
await sleep(4000)
console.log('URL:', page.url())
const t = await page.evaluate(() => document.body.innerText)
const i = t.indexOf('DNS Records'); console.log(t.slice(i, i + 3000))
// Tabellenzellen strukturiert
const rows = await page.evaluate(() => [...document.querySelectorAll('table tr')].map(tr => [...tr.querySelectorAll('th,td')].map(td => td.innerText.trim().replace(/\n/g, ' ')).join(' | ')))
console.log('--- TABELLE ---\n' + rows.join('\n'))
await page.screenshot({ path: '/tmp/cfshots/resend-dns.png', fullPage: true })
browser.disconnect()
