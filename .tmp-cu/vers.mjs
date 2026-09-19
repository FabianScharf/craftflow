import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === '📋'); if (k) k.click() })
await new Promise(r => setTimeout(r, 2000))
await app.evaluate(() => { const k = [...document.querySelectorAll('button')].find(e => /Öffnen/.test(e.textContent)); if (k) k.click() })
await new Promise(r => setTimeout(r, 3500))
const d = await app.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g, ' ')
  return { versionen: /Version/i.test(t), knopf: [...document.querySelectorAll('button')].filter(e => /Version/i.test(e.textContent)).map(e => e.textContent.trim().slice(0,30)) }
})
console.log(JSON.stringify(d))
await b.disconnect()
