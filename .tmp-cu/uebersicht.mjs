import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
// beide Positionen zuklappen
await app.evaluate(() => {
  const zu = [...document.querySelectorAll('button, div, span')].filter(x => x.textContent.trim() === '▼')
  zu.forEach(e => e.click())
})
await new Promise(r => setTimeout(r, 900))
await app.evaluate(() => window.scrollTo(0, 0))
await new Promise(r => setTimeout(r, 400))
await app.screenshot({ path: '.tmp-cu/p-ganz.png' })
const t = await app.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 700))
console.log(t)
await b.disconnect()
