import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
const logs = []
page.on('console', m => { if (['error','warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 300)) })
page.on('pageerror', e => logs.push('pageerror: ' + String(e).slice(0, 300)))
page.on('response', r => { if (r.url().includes('/api/')) logs.push('api ' + r.status() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '')) })
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2500)
logs.length = 0
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Textbausteine'); el && el.click() }); await sleep(8000)
console.log('Text im Hauptbereich:', await page.evaluate(() => document.querySelector('h2')?.innerText + ' | ' + (document.body.innerText.includes('Lädt …') ? 'Lädt …' : 'geladen')))
console.log(logs.join('\n') || 'keine Logs')
await page.close(); browser.disconnect()
