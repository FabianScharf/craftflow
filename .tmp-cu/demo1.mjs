import puppeteer from 'puppeteer-core'
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null, protocolTimeout: 240000 })
const page = (await browser.pages()).find(p => p.url().includes('craftflow-git-dev'))
await page.bringToFront()
const base = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
await page.goto(base + '/', { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForSelector('textarea', { timeout: 20000 })
// React-kompatibel setzen
await page.evaluate((v) => {
  const ta = document.querySelector('textarea')
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  setter.call(ta, v); ta.dispatchEvent(new Event('input', { bubbles: true }))
}, 'Schrank für Herrn Müller, soll hochwertig sein.')
await new Promise(r => setTimeout(r, 800))
await page.screenshot({ path: '/tmp/cfshots/eingabe-schlecht.png' })
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.includes('KALKULATION GENERIEREN')).click())
const t0 = Date.now(); let state = ''
while (Date.now() - t0 < 150000) {
  await new Promise(r => setTimeout(r, 3000))
  const txt = await page.evaluate(() => document.body.innerText)
  if (txt.includes('KI BRAUCHT NOCH INFORMATIONEN')) { state = 'fragen'; break }
  if (txt.includes('Netto') && txt.includes('Positionen') && txt.includes('Brutto')) { state = 'kalkulation'; break }
}
console.log('Ergebnis nach', Math.round((Date.now()-t0)/1000), 's:', state)
await page.screenshot({ path: '/tmp/cfshots/rueckfragen.png' })
const txt = await page.evaluate(() => document.body.innerText)
const i = txt.indexOf('KI BRAUCHT')
console.log(txt.slice(Math.max(0,i), Math.max(0,i) + 700))
browser.disconnect()
