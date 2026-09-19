import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage(); await page.setViewport({ width: 760, height: 1200 })
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/api/cron/tag3-mail?vorschau=1', { waitUntil: 'networkidle2', timeout: 60000 })
const farben = await page.evaluate(() => [...document.querySelectorAll('h2')].map(h => getComputedStyle(h).color))
console.log('h2-Farben:', JSON.stringify(farben))
await page.screenshot({ path: '.tmp-cu/tag3-vorschau2.png', fullPage: true })
if (farben[1] === 'rgb(241, 236, 228)') {
  await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/api/cron/tag3-mail?test=fabianscharf@icloud.com', { waitUntil: 'networkidle2', timeout: 60000 })
  console.log('Testversand:', await page.evaluate(() => document.body.innerText))
} else console.log('Vorschau noch fehlerhaft — kein Versand')
await page.close(); browser.disconnect()
