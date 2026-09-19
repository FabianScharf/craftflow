import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = await b.newPage()
await t.goto('http://localhost:4322/werkstatt', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 1500))
const link = await t.evaluate(() => { const a = [...document.querySelectorAll('a')].find(e => /werkstatt\/wunsch\//.test(e.href) && /Nachkalkulation/.test(e.textContent)); return a ? a.href : null })
console.log('Link:', link)
if (link) {
  await t.goto(link, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 1200))
  const d = await t.evaluate(() => ({
    titel: document.querySelector('h1')?.textContent,
    hatText: /je Position eintragen/.test(document.body.innerText),
    stimmen: (document.body.innerText.match(/\d+ Stimmen?/) || ['—'])[0],
  }))
  console.log(JSON.stringify(d))
}
await b.disconnect()
