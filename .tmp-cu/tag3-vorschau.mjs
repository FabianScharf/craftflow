import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage(); await page.setViewport({ width: 760, height: 1200 })
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/api/cron/tag3-mail?vorschau=1', { waitUntil: 'networkidle2', timeout: 60000 })
const t = await page.evaluate(() => document.body.innerText.slice(0, 200))
console.log('Seite:', t.replace(/\s+/g, ' '))
await page.screenshot({ path: '.tmp-cu/tag3-vorschau.png', fullPage: true })
await page.close(); browser.disconnect()
