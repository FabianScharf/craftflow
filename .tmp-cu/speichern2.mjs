import puppeteer from 'puppeteer-core'
const b = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null })
const app = (await b.pages()).find(p => p.url().includes('vercel.app'))
await app.bringToFront()
const d = await app.evaluate(() => {
  const t = document.body.innerText
  const treffer = [...document.querySelectorAll('button, div, span')].filter(e => /speicher/i.test(e.textContent || '') && e.children.length <= 2)
    .map(e => { const r = e.getBoundingClientRect(); return `${e.tagName} "${e.textContent.replace(/\s+/g,' ').trim().slice(0,60)}" @${Math.round(r.x)},${Math.round(r.y)} sichtbar=${r.width>0}` })
  return { enthaelt: /speicher/i.test(t), treffer, ende: t.replace(/\s+/g,' ').slice(-260) }
})
console.log(JSON.stringify(d, null, 1))
await b.disconnect()
