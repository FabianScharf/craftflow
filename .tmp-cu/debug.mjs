import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
const f = await t.evaluate(() => [...document.querySelectorAll('input, textarea')].map((e, i) =>
  `${i} ${e.tagName}/${e.type} ph="${(e.placeholder||'').slice(0,28)}" wert="${(e.value||'').slice(0,26)}"`))
console.log(f.join('\n'))
await b.disconnect()
