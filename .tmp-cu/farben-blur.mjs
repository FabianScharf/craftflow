import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2500)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Marketing & CI'); el && el.click() }); await sleep(1000)
const feld = (await page.$$('input[maxlength="7"]'))[1]
await feld.click(); await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta'); await page.keyboard.type('c8102e'); await sleep(200)
console.log('getippt:', await page.evaluate(() => document.querySelectorAll('input[maxlength="7"]')[1].value), '| Picker:', await page.evaluate(() => document.querySelectorAll('input[type="color"]')[1].value))
await page.keyboard.press('Tab'); await sleep(300)
console.log('nach Tab:', await page.evaluate(() => document.querySelectorAll('input[maxlength="7"]')[1].value))
await page.screenshot({ path: '/tmp/cfshots/dev-blur.png', clip: { x: 380, y: 80, width: 700, height: 420 } })
await page.close(); browser.disconnect()
