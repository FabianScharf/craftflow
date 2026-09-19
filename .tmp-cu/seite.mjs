import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = await b.newPage()
await t.goto('http://localhost:4322/werkstatt', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 1500))
const d = await t.evaluate(() => ({
  ids: [...document.querySelectorAll('[id]')].map(e => e.id).slice(0, 12),
  hatNaechstes: /Was als Nächstes kommt/.test(document.body.innerText),
  ausschnitt: (document.body.innerText.match(/Was als Nächstes kommt[\s\S]{0,260}/) || ['—'])[0].replace(/\s+/g, ' '),
}))
console.log(JSON.stringify(d, null, 1))
await b.disconnect()
