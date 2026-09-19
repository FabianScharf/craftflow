import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const html = await app.evaluate(() => {
  const td = [...document.querySelectorAll('td')].find(e => /Produktion/.test(e.textContent || ''))
  return td ? td.innerHTML.slice(0, 600) : 'nichts'
})
console.log(html)
await b.disconnect()
