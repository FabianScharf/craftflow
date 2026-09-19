import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ZIEL = process.argv[2] ?? 'http://localhost:4321/werkstatt'

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 })
await page.goto(ZIEL, { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise(r => setTimeout(r, 600))

// Ganze Seite, und zusätzlich der obere Teil für den ersten Eindruck.
await page.screenshot({ path: '.tmp-cu/werkstatt-ganz.png', fullPage: true })
await page.screenshot({ path: '.tmp-cu/werkstatt-oben.png' })

// Handy-Breite
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
await page.reload({ waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 400))
await page.screenshot({ path: '.tmp-cu/werkstatt-handy.png', fullPage: true })

await browser.close()
console.log('Bilder geschrieben')
