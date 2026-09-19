import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(3000)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Textbausteine'); el && el.click() })
let i = 0; for (; i < 40; i++) { await sleep(500); if (!(await page.evaluate(() => document.body.innerText.includes('Lädt …')))) break }
console.log('gewartet (s):', i * 0.5, '| h2:', await page.evaluate(() => [...document.querySelectorAll('h2')].map(h => h.innerText).join(' / ')), '| Laedt noch:', await page.evaluate(() => document.body.innerText.includes('Lädt …')))
await page.screenshot({ path: '/tmp/cfshots/hell2-textbausteine.png' })
await page.close(); browser.disconnect()
