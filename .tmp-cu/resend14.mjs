import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 60000 })
const page = (await browser.pages()).find(p => p.url().includes('resend.com'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
// Team-Umschalter oben links
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'F\nfabianscharf' || b.innerText.trim() === 'Ffabianscharf'); b && b.click() }); await sleep(1500)
const menu = await page.evaluate(() => [...document.querySelectorAll('[role="menu"], [role="menuitem"], [role="option"], [role="dialog"], [data-radix-popper-content-wrapper], [data-state="open"]')].map(e => e.innerText.trim().replace(/\n/g, ' | ')).filter(Boolean))
console.log('Menü:', JSON.stringify(menu, null, 1))
await page.screenshot({ path: '/tmp/cfshots/resend-teams.png' })
await page.keyboard.press('Escape')
browser.disconnect()
