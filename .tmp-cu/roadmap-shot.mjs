import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 900 })
const r = await page.goto(process.argv[2] + '/roadmap', { waitUntil: 'domcontentloaded', timeout: 90000 }); await new Promise(r => setTimeout(r, 4000))
const t = await page.evaluate(() => document.body.innerText)
console.log(JSON.stringify({ status: r.status(), titel: t.includes('Was als Nächstes kommt'), spalten: ['Geplant','In Arbeit','Fertig'].map(s => t.includes(s)), leer: t.includes('Gerade nichts'), hinweis: t.includes('Einstellungen → Wünsche') }))
await page.screenshot({ path: '/tmp/cfshots/roadmap.png' })
await page.close(); browser.disconnect()
