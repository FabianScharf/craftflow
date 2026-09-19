import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const klick = async (text) => { await app.evaluate(t => { const k = [...document.querySelectorAll('button')].find(e => e.textContent.includes(t)); if (k) k.click() }, text); await new Promise(r => setTimeout(r, 500)) }
await klick('+ Materialzeile'); await klick('+ Materialzeile')
await klick('+ Arbeitszeitzeile'); await klick('+ Arbeitszeitzeile'); await klick('+ Arbeitszeitzeile')
const f = await app.evaluate(() => [...document.querySelectorAll('input, textarea, select')].map((e, i) =>
  `${i} ${e.tagName}/${e.type} ph="${e.placeholder || ''}" wert="${(e.value||'').slice(0,22)}" @${Math.round(e.getBoundingClientRect().x)},${Math.round(e.getBoundingClientRect().y)}`))
console.log(f.join('\n'))
await b.disconnect()
