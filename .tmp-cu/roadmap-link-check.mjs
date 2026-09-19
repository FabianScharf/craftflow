import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 900 })
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings?nc=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(5000)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Wünsche'); el && el.click() }); await sleep(3000)
console.log(JSON.stringify(await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(a => a.innerText.trim() === 'Roadmap'); return a ? { text: a.innerText, href: a.href, target: a.target } : null })))
await page.screenshot({ path: '/tmp/cfshots/roadmap-link.png' })
await page.close(); browser.disconnect()
