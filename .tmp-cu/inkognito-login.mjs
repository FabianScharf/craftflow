import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const ctx = await browser.createBrowserContext()
const page = await ctx.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
console.log('Inkognito-Fenster offen:', page.url())
browser.disconnect()
