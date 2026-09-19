import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const seiten = await b.pages()
console.log('Seiten:', seiten.length)
for (const p of seiten) console.log(' -', p.url().slice(0, 70))
await b.disconnect()
