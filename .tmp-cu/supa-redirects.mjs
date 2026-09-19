import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://supabase.com/dashboard/project/fepfjvixfxksvduzwsgq/auth/url-configuration', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 4000))
const t = await page.evaluate(() => document.body.innerText)
const zeilen = t.split('\n').filter(l => /getcraftflow|localhost|vercel\.app|Site URL|Redirect URLs/i.test(l)).slice(0, 20)
console.log(page.url()); console.log(JSON.stringify(zeilen, null, 1))
await page.close(); browser.disconnect()
