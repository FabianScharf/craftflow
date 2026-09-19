import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(3000)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Textbausteine'); el && el.click() }); await sleep(5000)
await page.screenshot({ path: '/tmp/cfshots/hell2-textbausteine.png', clip: { x: 380, y: 100, width: 700, height: 520 } })
await page.close(); browser.disconnect()
