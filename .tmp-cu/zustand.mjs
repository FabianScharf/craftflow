import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
// Chat schliessen
await app.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === '×' && e.getBoundingClientRect().x > 1300)
  if (x) x.click()
})
await new Promise(r => setTimeout(r, 800))
await app.screenshot({ path: '.tmp-cu/z-projekt.png' })
const t = await app.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 900))
console.log(t)
await b.disconnect()
