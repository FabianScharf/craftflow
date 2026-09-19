import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
const d = await t.evaluate(() => ({
  text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400),
  knoepfe: [...document.querySelectorAll('button')].map(e => e.textContent.trim().slice(0, 22)).slice(0, 14),
  felder: document.querySelectorAll('input, textarea').length,
}))
console.log(JSON.stringify(d, null, 1))
await b.disconnect()
