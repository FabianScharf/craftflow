import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://supabase.com/dashboard/project/fepfjvixfxksvduzwsgq/sql/new', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.bringToFront()
await new Promise(r => setTimeout(r, 2500))
console.log('Tab offen:', page.url().includes('sign-in') ? 'Anmeldeseite von Supabase' : page.url())
browser.disconnect()
