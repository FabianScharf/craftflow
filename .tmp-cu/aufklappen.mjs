import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
await app.evaluate(() => {
  const e = [...document.querySelectorAll('button, div, span')].find(x => x.textContent.trim() === '▶')
  if (e) e.click()
})
await new Promise(r => setTimeout(r, 900))
const felder = await app.evaluate(() => [...document.querySelectorAll('input, textarea, select')].map((e, i) => ({
  i, tag: e.tagName, typ: e.type, ph: e.placeholder || '', wert: (e.value || '').slice(0, 30),
  y: Math.round(e.getBoundingClientRect().y), x: Math.round(e.getBoundingClientRect().x),
})).filter(f => f.y > 0))
console.log(JSON.stringify(felder, null, 1).slice(0, 2500))
await b.disconnect()
