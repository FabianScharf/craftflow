import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const info = await app.evaluate(() => {
  const el = [...document.querySelectorAll('*')].filter(x => x.children.length === 0 && /arbeitszeit/i.test(x.textContent || ''))
  const r = el.map(x => { const b = x.getBoundingClientRect(); return `"${x.textContent.trim().slice(0,20)}" @${Math.round(b.x)},${Math.round(b.y)}` })
  return { r, doc: document.documentElement.scrollHeight, win: innerHeight, sy: Math.round(scrollY) }
})
console.log(JSON.stringify(info))
await b.disconnect()
