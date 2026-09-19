import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 60000 })
const page = (await browser.pages()).find(p => p.url().includes('resend.com'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
console.log('URL:', page.url())
const set = await page.evaluate(() => {
  const inp = document.querySelector('input[placeholder="updates.example.com"]'); if (!inp) return 'kein Feld'
  const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(inp, 'getcraftflow.de'); inp.dispatchEvent(new Event('input', { bubbles: true })); return 'gesetzt: ' + inp.value
})
console.log(set); await sleep(600)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Advanced options'); b && b.click() }); await sleep(1200)
const t = await page.evaluate(() => document.body.innerText); const i = t.indexOf('Advanced options'); console.log('--- OPTIONEN ---\n' + t.slice(i, i + 700))
const opts = await page.evaluate(() => [...document.querySelectorAll('button, [role="radio"], [role="option"], [role="combobox"], label')].map(e => e.innerText.trim()).filter(x => x && x.length < 60))
console.log('Elemente:', JSON.stringify(opts))
await page.screenshot({ path: '/tmp/cfshots/resend-add2.png' })
browser.disconnect()
