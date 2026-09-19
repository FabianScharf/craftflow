import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://supabase.com/dashboard/project/fepfjvixfxksvduzwsgq/sql/new', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 4000))
console.log('URL:', page.url(), '| eingeloggt:', !page.url().includes('sign-in') && !page.url().includes('login'))
await page.close(); browser.disconnect()
