import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const t = (await b.pages()).find(p => p.url().includes('craftflow-git-dev'))
await t.bringToFront()
await t.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === '📋'); if (k) k.click() })
await new Promise(r => setTimeout(r, 1500))
const hat = await t.evaluate(() => /Verwerfen/.test(document.body.innerText))
if (hat) { await t.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Verwerfen'); if (k) k.click() }) }
await new Promise(r => setTimeout(r, 2000))
console.log('Änderung verworfen:', hat)
await b.disconnect()
