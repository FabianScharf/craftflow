import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const seiten = await b.pages()
for (const p of seiten) console.log('TAB:', p.url().slice(0, 80))
await b.disconnect()
