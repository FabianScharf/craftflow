import puppeteer from 'puppeteer-core'
const DEV = 'https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app') || p.url().includes('getcraftflow'))
await app.bringToFront()
await app.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 2 })
const warte = ms => new Promise(r => setTimeout(r, ms))
const klick = t => app.evaluate(x => {
  const el = [...document.querySelectorAll('button, a')].find(e => e.textContent?.trim().includes(x))
  if (el) { el.click(); return true } return false
}, t)

await app.goto(DEV + '/', { waitUntil: 'networkidle0' })
await warte(2500)
await app.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Schließen')?.click())
await warte(500)

console.log('Manuell eingeben:', await klick('Manuell eingeben'))
await warte(3000)
const wo = await app.evaluate(() => document.body.innerText.slice(0, 200).replace(/\n+/g, ' | '))
console.log('Jetzt hier:', wo)
await app.screenshot({ path: '.tmp-cu/w-manuell.png' })
await b.disconnect()
