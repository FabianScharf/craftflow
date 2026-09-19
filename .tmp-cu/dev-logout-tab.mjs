import puppeteer from 'puppeteer-core'
const DEV = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto(DEV + '/', { waitUntil: 'networkidle2', timeout: 60000 })
// Inhaber abmelden, damit Fabian sich als iCloud-Konto anmelden kann
await page.evaluate(async () => { const m = await import('/_next/static/chunks/main-app.js').catch(() => null); return !!m })
await page.evaluate(() => { const b = [...document.querySelectorAll('button, a')].find(e => /🚪|Abmelden/.test(e.innerText || e.getAttribute('title') || '')); b && b.click() })
await new Promise(r => setTimeout(r, 3000))
if (!/\/login/.test(page.url())) await page.goto(DEV + '/login', { waitUntil: 'networkidle2', timeout: 60000 })
await page.bringToFront()
console.log('Tab bereit:', page.url())
browser.disconnect()
