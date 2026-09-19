import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/api/wuensche/oeffentlich', { waitUntil: 'networkidle2', timeout: 60000 })
console.log('DEV-App API:', (await page.evaluate(() => document.body.innerText)).slice(0, 400))
await page.goto('https://craftflow-web-git-dev-fabian-scharf-s-projects.vercel.app/roadmap', { waitUntil: 'networkidle2', timeout: 60000 })
const t = await page.evaluate(() => document.body.innerText)
console.log('DEV-Website Spalten:', t.split('\n').filter(l => /^(Vorgeschlagen|Geplant|In Arbeit|Fertig)$|Vorschlag|Stimme/.test(l)).join(' | '))
await page.close(); browser.disconnect()
