import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })
const antworten = []
page.on('response', r => { if (r.url().includes('/api/')) antworten.push(r.request().method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '') + ' → ' + r.status()) })
await page.goto('https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app/settings', { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2500)
await page.evaluate(() => { const el = [...document.querySelectorAll('button, div, span, a')].find(e => e.children.length <= 2 && e.innerText && e.innerText.trim() === 'Mein Betrieb'); el && el.click() }); await sleep(2500)
const knopf = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Faktoren von Hand übernehmen'))
const info = await page.evaluate(b => b ? { disabled: b.disabled, sichtbar: !!b.offsetParent, rect: b.getBoundingClientRect().toJSON(), pointer: getComputedStyle(b).pointerEvents } : 'Knopf nicht gefunden', knopf)
console.log('Knopf:', JSON.stringify(info))
// Wert aendern, dann klicken
await page.evaluate(() => { const inp = [...document.querySelectorAll('input[type="number"][step="0.01"]')][0]; const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(inp, String((Number(inp.value) + 0.01).toFixed(2))); inp.dispatchEvent(new Event('input', { bubbles: true })) }); await sleep(300)
antworten.length = 0
await knopf.asElement().scrollIntoView(); await sleep(300)
const vorher = await page.evaluate(() => document.body.innerText.includes('Gespeichert.'))
await knopf.asElement().click(); await sleep(3000)
const nachher = await page.evaluate(() => document.body.innerText.includes('Gespeichert.'))
console.log('Gespeichert-Hinweis vorher/nachher:', vorher, nachher)
console.log('API-Antworten nach Klick:', JSON.stringify(antworten))
await page.screenshot({ path: '/tmp/cfshots/faktoren-klick.png' })
// Wert zurueck
await page.evaluate(() => { const inp = [...document.querySelectorAll('input[type="number"][step="0.01"]')][0]; const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(inp, String((Number(inp.value) - 0.01).toFixed(2))); inp.dispatchEvent(new Event('input', { bubbles: true })) }); await sleep(300)
await knopf.asElement().click(); await sleep(2500)
await page.close(); browser.disconnect()
